"""Optional development-only demo dataset for VendorIQ.

Purpose
-------
Populate a development database with a realistic, internally consistent
demo dataset so the full VendorIQ flow can be demonstrated end-to-end:

    Login → Vendors → Contracts → Purchase Orders → Deliveries →
    Quality & Incidents → Performance → Analytics → Decision Intelligence
    → Predictive Risk

The dataset deliberately includes:
    - a high-performing, low-risk vendor      (DEMO-001 Apex Circuits)
    - a solid, low-risk vendor                (DEMO-005 Nimbus IT)
    - an average performer                    (DEMO-002 Blue Horizon Logistics)
    - a poor performer (POOR, MEDIUM risk)    (DEMO-003 Crestline Packaging)
    - a critical risk vendor (CRITICAL/HIGH)  (DEMO-004 Vertex Steelworks)
    - a limited-data vendor                   (DEMO-006 Precision Devices)

Safety
------
- NEVER runs automatically. Execute it explicitly:
      python -m app.scripts.seed_demo_data
- Refuses to run when ENVIRONMENT == "production".
- Idempotent: re-running skips vendors whose code already exists.
- Demo data is clearly identifiable by the DEMO- prefix in codes.
- Existing (non-demo) data is never modified or deleted.
- Demo records are removed with:
      python -m app.scripts.seed_demo_data --clean
"""

import asyncio
import sys
from datetime import date, timedelta
from decimal import Decimal

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import settings
from ..core.database import get_database
from ..core.security import hash_password
from ..db.repository import find_doc, insert_doc
from ..models import (
    Contract,
    Incident,
    PurchaseOrder,
    QualityEvaluation,
    Role,
    User,
    Vendor,
    VendorCategory,
)
from ..models.enums import (
    ContractStatus,
    IncidentSeverity,
    IncidentStatus,
    IncidentType,
    PurchaseOrderStatus,
    QualityStatus,
    VendorStatus,
)
from .seed_roles import seed_roles

# (development-only) password shared by the demo users created by this script.
DEMO_PASSWORD = "DemoPass@123"
DEMO_USER_DOMAIN = "vendoriq.demo"

DEMO_USER_ROLES = {
    "demo.vendor-manager": "Vendor Manager",
    "demo.procurement": "Procurement Manager",
    "demo.project-manager": "Project Manager",
    "demo.analyst": "Analyst",
}


def _d(days_ago: int) -> date:
    """Date ``days_ago`` before today."""
    return date.today() - timedelta(days=days_ago)


def _d_plus(days_ago: int, days: int) -> date:
    """Date ``days`` after ``_d(days_ago)``."""
    return _d(days_ago) + timedelta(days=days)


def _quality_status(score: int) -> QualityStatus:
    """Consistent quality-status enum for a score (mirrors backend rules)."""
    if score >= 90:
        return QualityStatus.EXCELLENT
    if score >= 75:
        return QualityStatus.GOOD
    if score >= 60:
        return QualityStatus.ACCEPTABLE
    if score >= 40:
        return QualityStatus.POOR
    return QualityStatus.CRITICAL


def _money(value: float) -> Decimal:
    return Decimal(str(round(value, 2)))


def _on_time_orders(count, start, interval, label, value_base):
    """All deliveries on time (delivery score sits at 100)."""
    orders = []
    for i in range(count):
        age = start - i * interval
        orders.append(
            {
                "title": f"{label} — PO #{i + 1:02d}",
                "value": value_base * (10 + (i % 5)),
                "order_date": _d(age),
                "expected": _d_plus(age, 28),
                "actual": _d_plus(age, 28),
                "status": PurchaseOrderStatus.DELIVERED,
                "contract": None,
            }
        )
    return orders


def _mixed_orders(count, start, interval, delay_target, label, value_base, on_time_ratio=0.6):
    """A blend of on-time and delayed (completed) deliveries."""
    orders = []
    for i in range(count):
        age = start - i * interval
        expected = _d_plus(age, 28)
        on_time = (i % 5) < round(5 * on_time_ratio)
        actual = expected if on_time else _d_plus(age, 28 + delay_target + (i % 4))
        orders.append(
            {
                "title": f"{label} — PO #{i + 1:02d}",
                "value": value_base * (10 + (i % 5)),
                "order_date": _d(age),
                "expected": expected,
                "actual": actual,
                "status": PurchaseOrderStatus.DELIVERED,
                "contract": None,
            }
        )
    return orders


def _vertex_orders():
    """Mostly delayed; three outstanding (in-progress) open orders."""
    orders = []
    specs = [
        (240, 58, 900000),
        (215, 66, 850000),
        (190, 80, 920000),
        (165, 95, 980000),
        (140, 72, 780000),
        (115, 88, 860000),
    ]
    for i, (age, extra, value) in enumerate(specs, start=1):
        orders.append(
            {
                "title": f"Structural steel — PO #{i:02d}",
                "value": value,
                "order_date": _d(age),
                "expected": _d_plus(age, 28),
                "actual": _d_plus(age, extra),
                "status": PurchaseOrderStatus.DELIVERED,
                "contract": None,
            }
        )
    for i in range(7, 10):
        age = [90, 65, 40][i - 7]
        orders.append(
            {
                "title": f"High-tensile alloys — PO #{i:02d}",
                "value": [720000, 690000, 640000][i - 7],
                "order_date": _d(age),
                "expected": _d_plus(age, 28),
                "actual": None,
                "status": PurchaseOrderStatus.IN_PROGRESS,
                "contract": None,
            }
        )
    return orders


def _inc(seq, severity, status, reported, due, impact, title, itype):
    return {
        "incident_number": f"DEMO-INC-{seq:03d}",
        "title": title,
        "type": itype,
        "severity": severity,
        "status": status,
        "reported_date": reported,
        "due_date": due,
        "impact_score": impact,
    }


# ---------------------------------------------------------------------------
# Demo dataset definition
# ---------------------------------------------------------------------------

_DEMO_CATEGORIES = [
    "Hardware",
    "Logistics",
    "Manufacturing",
    "Raw Materials",
    "IT",
]

_VENDORS = [
    {
        "vendor_code": "DEMO-001",
        "company_name": "Apex Circuits Pvt Ltd",
        "contact_person": "Sandeep Rao",
        "email": "sandeep@apexcircuits.example",
        "phone": "+91 98100 10001",
        "address": "Plot 14, Electronic City",
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
        "postal_code": "560100",
        "website": "https://apexcircuits.example",
        "category": "Hardware",
        "status": VendorStatus.ACTIVE,
        "vendor_since": _d(880),
        "is_active": True,
        "contracts": [
            {
                "code": "DEMO-C001",
                "title": "PCB Manufacturing & Assembly Agreement",
                "value": 8500000,
                "start": _d(540),
                "end": _d_plus(540, 360),
                "status": ContractStatus.ACTIVE,
            },
            {
                "code": "DEMO-C002",
                "title": "Component Supply Framework",
                "value": 3200000,
                "start": _d(700),
                "end": _d_plus(700, 180),
                "status": ContractStatus.COMPLETED,
            },
        ],
        "orders": _on_time_orders(16, start=360, interval=21, label="PCB boards", value_base=210000),
        "evaluations": [
            (_d(320), 92),
            (_d(210), 95),
            (_d(90), 96),
        ],
        "incidents": [],
    },
    {
        "vendor_code": "DEMO-002",
        "company_name": "Blue Horizon Logistics",
        "contact_person": "Meera Nair",
        "email": "meera@bluehorizon.example",
        "phone": "+91 98220 20002",
        "address": "Warehouse 7, MIDC Area",
        "city": "Pune",
        "state": "Maharashtra",
        "country": "India",
        "postal_code": "411019",
        "website": "https://bluehorizon.example",
        "category": "Logistics",
        "status": VendorStatus.ACTIVE,
        "vendor_since": _d(460),
        "is_active": True,
        "contracts": [
            {
                "code": "DEMO-C003",
                "title": "Pan-India Freight & Warehousing Services",
                "value": 5400000,
                "start": _d(300),
                "end": _d_plus(300, 365),
                "status": ContractStatus.ACTIVE,
            },
        ],
        "orders": _mixed_orders(12, start=330, interval=27, delay_target=6, label="Freight consignments", value_base=185000),
        "evaluations": [
            (_d(280), 66),
            (_d(180), 60),
            (_d(70), 61),
        ],
        "incidents": [
            _inc(1, IncidentSeverity.HIGH, IncidentStatus.OPEN, _d(120), _d(70), 8, "Delayed shipment for Chennai plant", IncidentType.DELIVERY),
            _inc(2, IncidentSeverity.MEDIUM, IncidentStatus.IN_PROGRESS, _d(60), _d(10), 7, "Repeated wrong-warehouse deliveries", IncidentType.SERVICE),
            _inc(3, IncidentSeverity.MEDIUM, IncidentStatus.RESOLVED, _d(240), _d(230), 6, "Billing discrepancy on March freight", IncidentType.PAYMENT),
        ],
    },
    {
        "vendor_code": "DEMO-003",
        "company_name": "Crestline Packaging",
        "contact_person": "Rahul Verma",
        "email": "rahul@crestline.example",
        "phone": "+91 98330 30003",
        "address": "Shed 22, Peenya Industrial Estate",
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
        "postal_code": "560058",
        "website": "https://crestline.example",
        "category": "Manufacturing",
        "status": VendorStatus.ACTIVE,
        "vendor_since": _d(400),
        "is_active": True,
        "contracts": [
            {
                "code": "DEMO-C004",
                "title": "Packaging Materials Supply",
                "value": 2100000,
                "start": _d(260),
                "end": _d_plus(260, 365),
                "status": ContractStatus.ACTIVE,
            },
        ],
        "orders": _mixed_orders(10, start=300, interval=30, delay_target=14, label="Packaging materials", value_base=90000, on_time_ratio=0.4),
        "evaluations": [
            (_d(250), 48),
            (_d(160), 45),
            (_d(60), 42),
        ],
        "incidents": [
            _inc(1, IncidentSeverity.HIGH, IncidentStatus.OPEN, _d(90), _d(40), 8, "Sub-standard cartons lead to product damage", IncidentType.QUALITY),
            _inc(2, IncidentSeverity.MEDIUM, IncidentStatus.OPEN, _d(45), _d(15), 7, "Recurring miss on delivery dates", IncidentType.DELIVERY),
            _inc(3, IncidentSeverity.MEDIUM, IncidentStatus.IN_PROGRESS, _d(20), _d(5), 6, "Incorrect print labeling on batch #8812", IncidentType.QUALITY),
            _inc(4, IncidentSeverity.LOW, IncidentStatus.RESOLVED, _d(200), _d(195), 4, "Late document submission", IncidentType.DOCUMENTATION),
        ],
    },
    {
        "vendor_code": "DEMO-004",
        "company_name": "Vertex Steelworks",
        "contact_person": "Arjun Mehta",
        "email": "arjun@vertexsteel.example",
        "phone": "+91 98440 40004",
        "address": "Unit 5, Sanwer Road Industrial Area",
        "city": "Indore",
        "state": "Madhya Pradesh",
        "country": "India",
        "postal_code": "452015",
        "website": "https://vertexsteel.example",
        "category": "Raw Materials",
        "status": VendorStatus.UNDER_REVIEW,
        "vendor_since": _d(420),
        "is_active": True,
        "contracts": [
            {
                "code": "DEMO-C005",
                "title": "Structural Steel Supply Contract",
                "value": 7200000,
                "start": _d(250),
                "end": _d_plus(250, 270),
                "status": ContractStatus.ACTIVE,
            },
            {
                "code": "DEMO-C006",
                "title": "High-Tensile Alloys Trial Order",
                "value": 1500000,
                "start": _d(100),
                "end": _d_plus(100, 60),
                "status": ContractStatus.ON_HOLD,
            },
        ],
        "orders": _vertex_orders(),
        "evaluations": [
            (_d(230), 45),
            (_d(140), 30),
            (_d(50), 20),
        ],
        "incidents": [
            _inc(1, IncidentSeverity.CRITICAL, IncidentStatus.OPEN, _d(150), _d(120), 10, "Shipment seized - quality non-compliance", IncidentType.COMPLIANCE),
            _inc(2, IncidentSeverity.CRITICAL, IncidentStatus.OPEN, _d(110), _d(80), 10, "Structural failure reports from field usage", IncidentType.QUALITY),
            _inc(3, IncidentSeverity.CRITICAL, IncidentStatus.OPEN, _d(70), _d(40), 9, "Delayed deliveries halting production line", IncidentType.DELIVERY),
            _inc(4, IncidentSeverity.HIGH, IncidentStatus.OPEN, _d(60), _d(30), 9, "Contract terms violated - price deviation", IncidentType.CONTRACT),
            _inc(5, IncidentSeverity.HIGH, IncidentStatus.OPEN, _d(30), _d(10), 8, "Missing certificate of compliance", IncidentType.DOCUMENTATION),
            _inc(6, IncidentSeverity.HIGH, IncidentStatus.IN_PROGRESS, _d(15), _d(-5), 8, "Disputed invoice escalation", IncidentType.PAYMENT),
        ],
    },
    {
        "vendor_code": "DEMO-005",
        "company_name": "Nimbus IT Solutions",
        "contact_person": "Kavya Iyer",
        "email": "kavya@nimbusit.example",
        "phone": "+91 98550 50005",
        "address": "Tower B, HITEC City",
        "city": "Hyderabad",
        "state": "Telangana",
        "country": "India",
        "postal_code": "500081",
        "website": "https://nimbusit.example",
        "category": "IT",
        "status": VendorStatus.ACTIVE,
        "vendor_since": _d(120),
        "is_active": True,
        "contracts": [
            {
                "code": "DEMO-C007",
                "title": "Managed Cloud & Support Services",
                "value": 980000,
                "start": _d(110),
                "end": _d_plus(110, 365),
                "status": ContractStatus.ACTIVE,
            },
        ],
        "orders": _mixed_orders(5, start=100, interval=22, delay_target=3, label="IT services", value_base=120000, on_time_ratio=0.8),
        "evaluations": [
            (_d(60), 78),
        ],
        "incidents": [
            _inc(1, IncidentSeverity.LOW, IncidentStatus.RESOLVED, _d(75), _d(72), 3, "Minor ticket queue delay", IncidentType.SERVICE),
        ],
    },
    {
        "vendor_code": "DEMO-006",
        "company_name": "Precision Devices Ltd",
        "contact_person": "Vikram Singh",
        "email": "vikram@precisiondevices.example",
        "phone": "+91 98660 60006",
        "address": "R-4, Jhotwara Industrial Area",
        "city": "Jaipur",
        "state": "Rajasthan",
        "country": "India",
        "postal_code": "302012",
        "website": "https://precisiondevices.example",
        "category": "Hardware",
        "status": VendorStatus.PENDING,
        "vendor_since": _d(25),
        "is_active": True,
        "contracts": [
            {
                "code": "DEMO-C008",
                "title": "Sensor Calibration Services (Trial)",
                "value": 350000,
                "start": _d(20),
                "end": _d_plus(20, 180),
                "status": ContractStatus.DRAFT,
            },
        ],
        "orders": [],
        "evaluations": [],
        "incidents": [],
    },
]


# ---------------------------------------------------------------------------
# Seeding helpers
# ---------------------------------------------------------------------------


async def _category(db: AsyncIOMotorDatabase, name: str) -> VendorCategory:
    category = await find_doc(db, "vendor_categories", VendorCategory, {"name": name})
    if category is None:
        category = VendorCategory(
            name=name,
            description=f"Demo category: {name}",
            is_active=True,
        )
        await insert_doc(db, "vendor_categories", category)
    return category


async def _admin_user(db: AsyncIOMotorDatabase):
    admin_role = await find_doc(db, "roles", Role, {"name": "Admin"})
    if admin_role is None:
        return None
    users = await db["users"].find({"role_id": admin_role.id}).sort("id", 1).limit(1).to_list(None)
    if not users:
        return None
    from ..models import User

    return User.from_doc(users[0])


async def seed_demo_data(db: AsyncIOMotorDatabase | None = None) -> int:
    """Create the demo dataset. Returns the number of vendors created."""
    if settings.ENVIRONMENT.lower() == "production":
        raise RuntimeError(
            "Refusing to run in production. seed_demo_data is development-only."
        )

    owns_session = db is None
    if owns_session:
        db = await get_database()

    created_vendors = 0
    try:
        await seed_roles(db)
        admin = await _admin_user(db)
        if admin is None:
            raise RuntimeError("No Admin user exists. Run create_initial_admin first.")

        # Demo users (one per role) for RBAC demonstration.
        user_cache: dict[str, User] = {}
        for username, role_name in DEMO_USER_ROLES.items():
            email = f"{username}@{DEMO_USER_DOMAIN}"
            existing = await find_doc(db, "users", User, {"email": email})
            if existing is not None:
                user_cache[username] = existing
                continue
            role = await find_doc(db, "roles", Role, {"name": role_name})
            user = User(
                first_name="Demo",
                last_name=role_name,
                email=email,
                password_hash=hash_password(DEMO_PASSWORD),
                role_id=role.id if role else admin.role_id,
                is_active=True,
            )
            await insert_doc(db, "users", user)
            user_cache[username] = user

        vm_user = user_cache.get("demo.vendor-manager", admin)

        contracts: list[Contract] = []
        orders: list[PurchaseOrder] = []
        incidents: list[Incident] = []

        for spec in _VENDORS:
            existing_vendor = await find_doc(
                db, "vendors", Vendor, {"vendor_code": spec["vendor_code"]}
            )
            if existing_vendor is not None:
                print(f"  SKIP   {spec['vendor_code']} {spec['company_name']} (already exists)")
                continue

            category = await _category(db, spec["category"])
            vendor = Vendor(
                vendor_code=spec["vendor_code"],
                company_name=spec["company_name"],
                contact_person=spec["contact_person"],
                email=spec["email"],
                phone=spec["phone"],
                address=spec["address"],
                city=spec["city"],
                state=spec["state"],
                country=spec["country"],
                postal_code=spec["postal_code"],
                website=spec["website"],
                category_id=category.id,
                status=spec["status"],
                vendor_since=spec["vendor_since"],
                is_active=spec["is_active"],
            )
            await insert_doc(db, "vendors", vendor)
            created_vendors += 1

            for c in spec["contracts"]:
                contract = Contract(
                    vendor_id=vendor.id,
                    contract_number=c["code"],
                    title=c["title"],
                    description=f"Demo contract. {c['title']}.",
                    contract_value=_money(c["value"]),
                    start_date=c["start"],
                    end_date=c["end"],
                    status=c["status"],
                    is_active=True,
                )
                await insert_doc(db, "contracts", contract)
                contracts.append(contract)

            for o in spec.get("orders", []):
                order = PurchaseOrder(
                    vendor_id=vendor.id,
                    contract_id=contracts[-1].id if contracts else None,
                    order_number=f"DEMO-PO-{vendor.vendor_code[-3:]}-{(len(orders) + 1):03d}",
                    title=o["title"],
                    description=f"Demo purchase order. {o['title']}.",
                    order_value=_money(o["value"]),
                    order_date=o["order_date"],
                    expected_delivery_date=o["expected"],
                    actual_delivery_date=o["actual"],
                    status=o["status"],
                )
                await insert_doc(db, "purchase_orders", order)
                orders.append(order)

            for (eval_date, score) in spec["evaluations"]:
                evaluation = QualityEvaluation(
                    vendor_id=vendor.id,
                    contract_id=contracts[-1].id if contracts else None,
                    purchase_order_id=orders[-1].id if orders else None,
                    evaluation_date=eval_date,
                    quality_score=score,
                    defect_count=0,
                    total_items=0,
                    quality_status=_quality_status(score),
                    comments=f"Demo quality evaluation: {score}/100.",
                    created_by=vm_user.id,
                )
                await insert_doc(db, "quality_evaluations", evaluation)

            for inc in spec["incidents"]:
                incident = Incident(
                    incident_number=f"DEMO-INC-{vendor.vendor_code[-3:]}-{inc['incident_number'][-3:]}",
                    vendor_id=vendor.id,
                    contract_id=contracts[-1].id if contracts else None,
                    purchase_order_id=orders[-1].id if orders else None,
                    title=inc["title"],
                    description=f"Demo incident. {inc['title']}.",
                    incident_type=inc["type"],
                    severity=inc["severity"],
                    status=inc["status"],
                    reported_date=inc["reported_date"],
                    due_date=inc["due_date"],
                    impact_score=inc["impact_score"],
                    reported_by=vm_user.id,
                    assigned_to=vm_user.id,
                    resolution_notes=(
                        "Resolved during demo data seeding."
                        if inc["status"] in (IncidentStatus.RESOLVED, IncidentStatus.CLOSED)
                        else None
                    ),
                )
                await insert_doc(db, "incidents", incident)
                incidents.append(incident)

            print(
                f"  CREATE {spec['vendor_code']} {spec['company_name']} "
                f"({len(spec['contracts'])} contracts, {len(spec.get('orders', []))} POs, "
                f"{len(spec['evaluations'])} evaluations, {len(spec['incidents'])} incidents)"
            )

        print(f"Demo data seeding complete: {created_vendors} vendors created.")
        if created_vendors:
            print(f"Demo user password (development only): {DEMO_PASSWORD}")
            print("Demo login alias: demo.<role>@" + DEMO_USER_DOMAIN)
        return created_vendors
    finally:
        if owns_session:
            db.client.close()


async def clean_demo_data(db: AsyncIOMotorDatabase | None = None) -> int:
    """Remove demo records (identified by DEMO- codes). Never touches real data."""
    owns_session = db is None
    if owns_session:
        db = await get_database()
    try:
        deleted = 0

        async def _delete(collection: str, criteria: dict) -> None:
            nonlocal deleted
            result = await db[collection].delete_many(criteria)
            deleted += result.deleted_count

        async def _clean_all() -> None:
            await _delete("incidents", {"incident_number": {"$regex": "^DEMO-"}})
            await _delete(
                "quality_evaluations",
                {"comments": {"$regex": "^Demo quality evaluation"}},
            )
            await _delete("purchase_orders", {"order_number": {"$regex": "^DEMO-PO-"}})
            await _delete("contracts", {"contract_number": {"$regex": "^DEMO-C"}})
            await _delete("vendors", {"vendor_code": {"$regex": "^DEMO-"}})
            for username in DEMO_USER_ROLES:
                await _delete("users", {"email": f"{username}@{DEMO_USER_DOMAIN}"})

        await _clean_all()
        print(f"Demo data cleaned: {deleted} records removed.")
        return deleted
    finally:
        if owns_session:
            db.client.close()


def main() -> None:
    if "--clean" in sys.argv:
        try:
            asyncio.run(clean_demo_data())
        except Exception as exc:
            print(f"Demo data clean-up FAILED: {exc}")
            sys.exit(1)
        return

    try:
        asyncio.run(seed_demo_data())
    except Exception as exc:
        print(f"Demo data seeding FAILED: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
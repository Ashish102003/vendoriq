from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from ..models.enums import VendorStatus


def _clean_website(value: str | None) -> str | None:
    """Validate a website URL, requiring an explicit scheme."""
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    lowered = stripped.lower()
    if not (lowered.startswith("http://") or lowered.startswith("https://")):
        raise ValueError("Website must start with http:// or https://")
    return stripped


class VendorBase(BaseModel):
    vendor_code: str = Field(min_length=1, max_length=20)
    company_name: str = Field(min_length=1, max_length=255)
    contact_person: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)
    website: str | None = Field(default=None, max_length=255)
    category_id: int
    status: VendorStatus = VendorStatus.PENDING
    vendor_since: date | None = None
    is_active: bool = True


class VendorCreate(VendorBase):
    @field_validator("website", mode="before")
    @classmethod
    def _validate_website(cls, value: str | None) -> str | None:
        return _clean_website(value)


class VendorUpdate(BaseModel):
    vendor_code: str | None = Field(default=None, min_length=1, max_length=20)
    company_name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_person: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)
    website: str | None = Field(default=None, max_length=255)
    category_id: int | None = None
    status: VendorStatus | None = None
    vendor_since: date | None = None
    is_active: bool | None = None

    @field_validator("website", mode="before")
    @classmethod
    def _validate_website(cls, value: str | None) -> str | None:
        return _clean_website(value)


class VendorStatusUpdate(BaseModel):
    status: VendorStatus
    is_active: bool | None = None


class VendorCategorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class VendorListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_code: str
    company_name: str
    contact_person: str | None
    email: str | None
    category: VendorCategorySummary
    status: VendorStatus
    is_active: bool
    vendor_since: date | None
    created_at: datetime


class VendorDetailResponse(VendorListResponse):
    phone: str | None
    website: str | None
    address: str | None
    city: str | None
    state: str | None
    country: str | None
    postal_code: str | None
    updated_at: datetime


class PaginatedVendors(BaseModel):
    items: list[VendorListResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class VendorStatistics(BaseModel):
    total_vendors: int
    active_vendors: int
    pending_vendors: int
    under_review_vendors: int
    suspended_vendors: int
    terminated_vendors: int
    inactive_vendors: int
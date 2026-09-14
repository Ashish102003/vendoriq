from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.database import get_db
from ....core.jwt import create_access_token
from ....core.security import verify_password
from ....db.repository import attach_roles, find_doc
from ....dependencies.auth import get_current_user, require_roles
from ....models import User
from ....schemas.auth import (
    LoginRequest,
    LoginResponse,
    LoginUserInfo,
    AuthenticatedUserResponse,
)

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)
) -> LoginResponse:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = await find_doc(
        db, "users", User, {"email": payload.email.lower()}
    )
    if user is None or not user.is_active:
        raise credentials_error
    if not verify_password(payload.password, user.password_hash):
        raise credentials_error
    await attach_roles(db, [user])

    access_token = create_access_token(
        subject=str(user.id),
        email=user.email,
        role=user.role.name if user.role else "",
    )
    return LoginResponse(
        access_token=access_token,
        user=LoginUserInfo(
            id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            role=user.role.name if user.role else "",
        ),
    )


@router.get("/me", response_model=AuthenticatedUserResponse)
async def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/protected-test")
async def protected_test(
    current_user: User = Depends(get_current_user),
):
    return {
        "message": "Authentication successful",
        "user": f"{current_user.first_name} {current_user.last_name}",
    }


@router.get("/admin-test")
async def admin_test(
    current_user: User = Depends(require_roles("Admin")),
):
    return {
        "message": "Admin access granted",
        "user": f"{current_user.first_name} {current_user.last_name}",
    }
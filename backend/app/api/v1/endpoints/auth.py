from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ....core.database import get_db
from ....core.jwt import create_access_token
from ....core.security import verify_password
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
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is None or not user.is_active:
        raise credentials_error
    if not verify_password(payload.password, user.password_hash):
        raise credentials_error

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
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/protected-test")
def protected_test(current_user: User = Depends(get_current_user)):
    return {
        "message": "Authentication successful",
        "user": f"{current_user.first_name} {current_user.last_name}",
    }


@router.get("/admin-test")
def admin_test(
    current_user: User = Depends(require_roles("Admin")),
):
    return {
        "message": "Admin access granted",
        "user": f"{current_user.first_name} {current_user.last_name}",
    }
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.database import get_db
from ....db.repository import attach_roles, find_docs
from ....dependencies.auth import get_current_user
from ....models import User
from ....schemas.user_list import UserListItem

router = APIRouter()


@router.get("", response_model=list[UserListItem])
async def list_users(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = await find_docs(db, "users", User, {})
    await attach_roles(db, users)
    users.sort(key=lambda u: (u.first_name or "", u.last_name or ""))
    return [
        UserListItem(
            id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            role_name=user.role.name if user.role is not None else None,
            is_active=user.is_active,
        )
        for user in users
    ]
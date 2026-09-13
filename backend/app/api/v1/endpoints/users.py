from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from ....core.database import get_db
from ....dependencies.auth import get_current_user
from ....models import User
from ....schemas.user_list import UserListItem

router = APIRouter()


@router.get("", response_model=list[UserListItem])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = (
        db.query(User)
        .options(joinedload(User.role))
        .order_by(User.first_name, User.last_name)
        .all()
    )
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
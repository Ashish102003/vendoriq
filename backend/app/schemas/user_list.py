from pydantic import BaseModel, ConfigDict


class UserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    email: str
    role_name: str | None = None
    is_active: bool
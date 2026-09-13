from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=8)
    role_id: int


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role_id: int
    created_at: datetime
    updated_at: datetime
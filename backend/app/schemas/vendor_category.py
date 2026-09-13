from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class VendorCategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    is_active: bool = True


class VendorCategoryCreate(VendorCategoryBase):
    pass


class VendorCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class VendorCategoryResponse(VendorCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class VendorCategoryWithCount(VendorCategoryResponse):
    vendor_count: int = 0
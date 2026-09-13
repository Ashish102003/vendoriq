from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..models.enums import ContractStatus


class ContractStatusUpdate(BaseModel):
    status: ContractStatus


class ContractVendorSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_code: str
    company_name: str


class ContractBase(BaseModel):
    vendor_id: int
    contract_number: str = Field(min_length=1, max_length=30)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    contract_value: Decimal = Field(ge=0)
    start_date: date
    end_date: date
    status: ContractStatus = ContractStatus.DRAFT
    is_active: bool = True


class ContractCreate(ContractBase):
    @model_validator(mode="after")
    def _validate_date_range(self) -> "ContractCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class ContractUpdate(BaseModel):
    vendor_id: int | None = None
    contract_number: str | None = Field(default=None, min_length=1, max_length=30)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    contract_value: Decimal | None = Field(default=None, ge=0)
    start_date: date | None = None
    end_date: date | None = None
    status: ContractStatus | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _validate_date_range(self) -> "ContractUpdate":
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("end_date must be on or after start_date")
        return self


class ContractListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contract_number: str
    title: str
    vendor: ContractVendorSummary
    contract_value: Decimal
    start_date: date
    end_date: date
    status: ContractStatus
    is_active: bool
    created_at: datetime


class ContractDetailResponse(ContractListItem):
    vendor_id: int
    description: str | None
    updated_at: datetime


class PaginatedContracts(BaseModel):
    items: list[ContractListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class ContractStatistics(BaseModel):
    total_contracts: int
    active_contracts: int
    draft_contracts: int
    completed_contracts: int
    on_hold_contracts: int
    cancelled_contracts: int
    expired_contracts: int
    total_contract_value: Decimal = Decimal("0")
"""
Pydantic schemas for Institution CRUD requests and responses.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class InstitutionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="Full institution name")
    code: Optional[str] = Field(None, max_length=50, description="Short code/ticker (e.g. GTB, ZENITH)")
    provider: str = Field("Aggregator A", max_length=100, description="Aggregator service provider name")
    linked_accounts: int = Field(0, ge=0, description="Number of customer linked accounts")
    last_sync: str = Field("Just now", max_length=100, description="Last sync human time or timestamp")
    success_rate_24h: float = Field(99.0, ge=0.0, le=100.0, description="24-hour sync success percentage")
    
    status: str = Field("Healthy", description="Customer-facing status: Healthy, Degraded, Maintenance, Suspended")
    is_active: bool = Field(True, description="Whether institution connector is active")


class InstitutionCreate(InstitutionBase):
    pass


class InstitutionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    code: Optional[str] = Field(None, max_length=50)
    provider: Optional[str] = Field(None, max_length=100)
    linked_accounts: Optional[int] = Field(None, ge=0)
    last_sync: Optional[str] = Field(None, max_length=100)
    success_rate_24h: Optional[float] = Field(None, ge=0.0, le=100.0)
    status: Optional[str] = None
    is_active: Optional[bool] = None


class InstitutionResponse(InstitutionBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class InstitutionStatsResponse(BaseModel):
    total_institutions: int
    live_count: int
    maintenance_count: int
    degraded_count: int
    avg_success_rate: float
    total_linked_accounts: int


class InstitutionListResponse(BaseModel):
    total: int
    items: List[InstitutionResponse]
    skip: int = 0
    limit: int = 50

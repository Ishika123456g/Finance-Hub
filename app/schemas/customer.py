"""
Pydantic schemas for Customer Admin Management.
Maps real DB user entities into customer administration views.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CustomerBase(BaseModel):
    full_name: Optional[str] = Field(None, description="Customer full name")
    email: str = Field(..., description="Customer email address")
    phone_number: Optional[str] = Field(None, description="Mobile number")
    role: str = Field("User", description="Account role")
    is_active: bool = Field(True, description="Account active status")
    is_verified: bool = Field(False, description="Verification status")
    mfa_type: Optional[str] = Field("SMS", description="MFA method (SMS, Authenticator, None)")
    linked_accounts: int = Field(0, description="Number of linked financial accounts")


class CustomerUpdate(BaseModel): 
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    mfa_type: Optional[str] = None


class CustomerResponse(CustomerBase):
    id: int 
    status: str = Field("Active", description="Computed status: Active, Suspended, Pending")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CustomerStatsResponse(BaseModel):
    total_customers: int
    active_customers: int
    suspended_customers: int
    unverified_customers: int


class CustomerListResponse(BaseModel):
    total: int
    items: List[CustomerResponse]

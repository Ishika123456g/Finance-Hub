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


class LinkAccountRequest(BaseModel):
    user_id: Optional[int] = Field(None, description="User ID (defaults to active user if omitted)")
    institution_id: Optional[int] = Field(None, description="ID of the institution to link")
    institution_name: Optional[str] = Field(None, description="Name of the institution or bank")
    account_number: Optional[str] = Field(None, description="Bank account number (e.g. 0123456789)")
    account_name: Optional[str] = Field(None, description="Account holder name or nickname")
    account_type: Optional[str] = Field("savings", description="Account type: savings, current, wallet")
    balance: Optional[float] = Field(0.0, ge=0.0, description="Opening account balance")
    currency: Optional[str] = Field("NGN", description="Currency code, e.g. NGN, USD")
    scope: Optional[str] = Field("Accounts, balances, transactions", description="Data sharing consent scope")


class LinkAccountResponse(BaseModel):
    success: bool = True
    message: str
    account_id: Optional[int] = None
    mono_account_id: Optional[str] = None
    user_id: int 
    institution_id: Optional[int] = None
    institution_name: str 
    account_number: Optional[str] = None
    account_name: Optional[str] = None 
    account_type: str = "savings"
    balance: float = 0.0
    currency: str = "NGN"
    status: str = "Healthy"
    consent_id: Optional[str] = None
 

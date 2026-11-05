"""
Pydantic schemas for Consent Register.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ConsentResponse(BaseModel):
    id: int
    consent_id: str = Field(..., description="Consent code identifier (e.g. CNS-10231)")
    customer: str = Field(..., description="Customer full name")
    customer_email: Optional[str] = Field(None, description="Customer email address")
    user_id: Optional[int] = Field(None, description="Linked user ID if available")
    institution: str = Field(..., description="Financial institution or bank name")
    scope: str = Field("Accounts, balances, transactions", description="Data sharing permissions scope")
    granted: str = Field(..., description="Granted date")
    expires: str = Field(..., description="Expiry date")
    status: str = Field("Active", description="Consent status: Active, Expiring, Withdrawn")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ConsentListResponse(BaseModel):
    total: int
    items: List[ConsentResponse]


"""
Pydantic schemas for Payments, Simulated Transfers, and Beneficiaries.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Beneficiary Schemas
# ---------------------------------------------------------------------------
class BeneficiaryBase(BaseModel):
    name: str = Field(..., description="Payee full name or entity name")
    bank_name: str = Field(..., description="Bank name or Biller")
    bank_code: Optional[str] = Field(None, description="Bank code")
    account_number: str = Field(..., description="Account or meter number")


class BeneficiaryCreate(BeneficiaryBase):
    user_id: Optional[int] = Field(None, description="User ID (defaults to active user if omitted)")


class BeneficiaryResponse(BeneficiaryBase):
    id: int
    user_id: int
    initials: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Transfer & Payment Schemas
# ---------------------------------------------------------------------------
class SendMoneyRequest(BaseModel):
    user_id: Optional[int] = Field(None, description="Sender User ID (defaults to active user if omitted)")
    from_account_id: int = Field(..., description="Source linked bank account ID")
    beneficiary_id: Optional[int] = Field(None, description="Saved beneficiary ID (if selecting saved payee)")
    
    # Direct payee fields (used when sending to a new payee without selecting a saved beneficiary)
    beneficiary_name: Optional[str] = Field(None, description="Direct payee name")
    beneficiary_bank: Optional[str] = Field(None, description="Direct payee bank name")
    beneficiary_account: Optional[str] = Field(None, description="Direct payee account number")
    save_beneficiary: Optional[bool] = Field(False, description="Whether to save this new payee for future use")

    amount: float = Field(..., gt=0, description="Transfer amount in NGN (must be greater than 0)")
    note: Optional[str] = Field(None, description="Optional note or reference (e.g. 'Rent contribution')")


class TransferItemResponse(BaseModel):
    id: int
    reference: str
    user_id: int
    account_id: Optional[int] = None
    from_account_name: Optional[str] = None
    from_bank_name: Optional[str] = None
    from_account_number: Optional[str] = None
    beneficiary_id: Optional[int] = None
    beneficiary_name: str
    beneficiary_bank: str
    beneficiary_account: str
    amount: float
    currency: str = "NGN"
    currency_symbol: str = "₦"
    formatted_amount: str
    note: Optional[str] = None
    status: str = "completed"
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class SendMoneyResponse(BaseModel):
    success: bool = True
    message: str
    transfer: TransferItemResponse
    remaining_balance: float
    formatted_remaining_balance: str


class TransferListResponse(BaseModel):
    status: str = "success"
    total_transfers: int
    total_sent_amount: float
    formatted_total_sent: str
    transfers: List[TransferItemResponse]


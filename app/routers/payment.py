"""
FastAPI router providing payment, simulated transfer, and beneficiary management endpoints.
Interacts directly with PostgreSQL via SQLAlchemy.
Simulates money movement without external payment gateways.
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.user_bank_account import UserBankAccount
from app.models.beneficiary import Beneficiary
from app.models.transfer import Transfer
from app.schemas.payment import (
    BeneficiaryCreate,
    BeneficiaryResponse,
    SendMoneyRequest,
    SendMoneyResponse,
    TransferItemResponse,
    TransferListResponse,
)

router = APIRouter(prefix="/api/payments", tags=["Payments"])


def _extract_initials(name: Optional[str]) -> str:
    """Helper to extract up to 2 uppercase initials from a name."""
    if not name:
        return "B"
    parts = name.strip().split()
    if len(parts) >= 2:
        return f"{parts[0][0]}{parts[1][0]}".upper()
    return name[:2].upper()


def _resolve_user(db: Session, user_id: Optional[int] = None) -> User:
    """Helper to find user by ID or fallback to the primary active user."""
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found in database.",
            )
        return user

    user = db.query(User).filter(User.is_active == True).order_by(User.id.asc()).first()
    if not user:
        user = db.query(User).order_by(User.id.asc()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No registered user found in database.",
        )
    return user


# ---------------------------------------------------------------------------
# 1. Beneficiaries Endpoints
# ---------------------------------------------------------------------------
@router.get("/beneficiaries", response_model=List[BeneficiaryResponse], summary="List Beneficiaries")
def list_beneficiaries(
    user_id: Optional[int] = Query(None, description="Optional user ID filter"),
    db: Session = Depends(get_db),
):
    """
    Fetch all saved beneficiaries/payees for the user from PostgreSQL.
    Completely dynamic: new users start with 0 beneficiaries until added.
    """
    user = _resolve_user(db, user_id=user_id)

    items = (
        db.query(Beneficiary)
        .filter(Beneficiary.user_id == user.id)
        .order_by(Beneficiary.id.asc())
        .all()
    )

    results = []
    for b in items:
        resp = BeneficiaryResponse.model_validate(b)
        resp.initials = _extract_initials(b.name)
        results.append(resp)
    return results


@router.post("/beneficiaries", response_model=BeneficiaryResponse, summary="Add Beneficiary")
def add_beneficiary(
    payload: BeneficiaryCreate,
    db: Session = Depends(get_db),
):
    """
    Save a new beneficiary / payee (bank name, account number, full name).
    """
    user = _resolve_user(db, user_id=payload.user_id)

    beneficiary = Beneficiary(
        user_id=user.id,
        name=payload.name.strip(),
        bank_name=payload.bank_name.strip(),
        bank_code=payload.bank_code,
        account_number=payload.account_number.strip(),
    )
    db.add(beneficiary)
    db.commit()
    db.refresh(beneficiary)

    resp = BeneficiaryResponse.model_validate(beneficiary)
    resp.initials = _extract_initials(beneficiary.name)
    return resp


# ---------------------------------------------------------------------------
# 2. Simulated Transfer / Send Money Endpoints
# ---------------------------------------------------------------------------
@router.post("/send", response_model=SendMoneyResponse, summary="Send Money (Simulated Transfer)")
def send_money(
    payload: SendMoneyRequest,
    db: Session = Depends(get_db),
):
    """
    Execute a simulated money transfer:
    1. Validates that the sender has sufficient balance in the selected linked account.
    2. Atomically decrements the account balance in PostgreSQL.
    3. Records a completed Transfer entry with unique reference code.
    4. Does not contact any external payment gateway (pure dummy simulation).
    """
    user = _resolve_user(db, user_id=payload.user_id)

    # 1. Validate Source Bank Account
    account = (
        db.query(UserBankAccount)
        .filter(
            UserBankAccount.id == payload.from_account_id,
            UserBankAccount.user_id == user.id,
            UserBankAccount.is_active == True,
        )
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source bank account with ID {payload.from_account_id} not found or inactive for user {user.id}.",
        )

    # 2. Check Balance Sufficiency
    if account.balance < payload.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance in {account.bank_name}. Available: ₦{account.balance:,.2f}, Required: ₦{payload.amount:,.2f}.",
        )

    # 3. Resolve Beneficiary / Payee Details
    beneficiary = None
    if payload.beneficiary_id:
        beneficiary = (
            db.query(Beneficiary)
            .filter(Beneficiary.id == payload.beneficiary_id, Beneficiary.user_id == user.id)
            .first()
        )
        if not beneficiary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Beneficiary with ID {payload.beneficiary_id} not found.",
            )
        ben_name = beneficiary.name
        ben_bank = beneficiary.bank_name
        ben_account = beneficiary.account_number
    elif payload.beneficiary_name:
        ben_name = payload.beneficiary_name.strip()
        ben_bank = (payload.beneficiary_bank or "Bank").strip()
        ben_account = (payload.beneficiary_account or "0000000000").strip()

        # Save beneficiary if requested
        if payload.save_beneficiary:
            beneficiary = Beneficiary(
                user_id=user.id,
                name=ben_name,
                bank_name=ben_bank,
                account_number=ben_account,
            )
            db.add(beneficiary)
            db.flush()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either beneficiary_id or beneficiary_name.",
        )

    # 4. Atomic Balance Deduction
    account.balance = round(account.balance - payload.amount, 2)

    # 5. Create Transfer Record
    reference = f"TRF-{uuid.uuid4().hex[:10].upper()}"
    transfer = Transfer(
        reference=reference,
        user_id=user.id,
        account_id=account.id,
        beneficiary_id=beneficiary.id if beneficiary else None,
        amount=round(payload.amount, 2),
        currency=account.currency or "NGN",
        note=payload.note.strip() if payload.note else None,
        status="completed",
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    db.refresh(account)

    item = TransferItemResponse(
        id=transfer.id,
        reference=transfer.reference,
        user_id=user.id,
        account_id=account.id,
        from_account_name=account.account_name or "Linked Account",
        from_bank_name=account.bank_name or "Bank",
        from_account_number=account.account_number,
        beneficiary_id=transfer.beneficiary_id,
        beneficiary_name=ben_name,
        beneficiary_bank=ben_bank,
        beneficiary_account=ben_account,
        amount=transfer.amount,
        currency=transfer.currency,
        currency_symbol="₦" if transfer.currency == "NGN" else "$",
        formatted_amount=f"₦{transfer.amount:,.2f}",
        note=transfer.note,
        status=transfer.status,
        created_at=transfer.created_at.isoformat() if transfer.created_at else None,
    )

    return SendMoneyResponse(
        success=True,
        message=f"Simulated transfer of ₦{transfer.amount:,.2f} to {ben_name} completed successfully.",
        transfer=item,
        remaining_balance=account.balance,
        formatted_remaining_balance=f"₦{account.balance:,.2f}",
    )


# ---------------------------------------------------------------------------
# 3. Transfer History Endpoints
# ---------------------------------------------------------------------------
@router.get("/transfers", response_model=TransferListResponse, summary="List Transfer History")
def list_transfers(
    user_id: Optional[int] = Query(None, description="Optional user ID filter"),
    db: Session = Depends(get_db),
):
    """
    Fetch history of simulated transfers completed by the user.
    """
    user = _resolve_user(db, user_id=user_id)

    transfers = (
        db.query(Transfer)
        .filter(Transfer.user_id == user.id)
        .order_by(Transfer.id.desc())
        .all()
    )

    total_sent = sum(t.amount for t in transfers)
    items = []

    for t in transfers:
        acc = t.account
        ben = t.beneficiary

        ben_name = ben.name if ben else "Beneficiary"
        ben_bank = ben.bank_name if ben else "Bank"
        ben_account = ben.account_number if ben else "••••"

        items.append(
            TransferItemResponse(
                id=t.id,
                reference=t.reference,
                user_id=t.user_id,
                account_id=t.account_id,
                from_account_name=acc.account_name if acc else "Linked Account",
                from_bank_name=acc.bank_name if acc else "Bank",
                from_account_number=acc.account_number if acc else None,
                beneficiary_id=t.beneficiary_id,
                beneficiary_name=ben_name,
                beneficiary_bank=ben_bank,
                beneficiary_account=ben_account,
                amount=t.amount,
                currency=t.currency,
                currency_symbol="₦" if t.currency == "NGN" else "$",
                formatted_amount=f"₦{t.amount:,.2f}",
                note=t.note,
                status=t.status,
                created_at=t.created_at.isoformat() if t.created_at else None,
            )
        )

    return TransferListResponse(
        status="success",
        total_transfers=len(items),
        total_sent_amount=round(total_sent, 2),
        formatted_total_sent=f"₦{total_sent:,.2f}",
        transfers=items,
    )

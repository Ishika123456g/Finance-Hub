"""
FastAPI router providing customer administrative APIs backed by the real PostgreSQL database.
Directly reads and updates the 'users' table.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User
from app.schemas.customer import (
    CustomerResponse,
    CustomerUpdate,
    CustomerStatsResponse,
)

router = APIRouter(prefix="/api/admin/customers", tags=["Admin Customers"])
public_admin_router = APIRouter(prefix="/admin/customers", tags=["Admin Customers Alias"])


def format_customer_response(user: User) -> CustomerResponse:
    """Helper to convert a DB User into a CustomerResponse with computed status."""
    computed_status = "Suspended" if not user.is_active else ("Pending" if not user.is_verified else "Active")
    display_name = user.full_name or (user.email.split("@")[0].capitalize() if user.email else "User")

    return CustomerResponse(
        id=user.id,
        full_name=display_name,
        email=user.email,
        phone_number=user.phone_number,
        role=user.role or "User",
        is_active=bool(user.is_active),
        is_verified=bool(user.is_verified),
        mfa_type=user.mfa_type or "SMS",
        status=computed_status,
        linked_accounts=0,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/stats", response_model=CustomerStatsResponse, summary="Customer KPI Summary")
def get_customer_stats(db: Session = Depends(get_db)):
    """
    Returns aggregated customer counts from PostgreSQL.
    """
    users = db.query(User).all()
    total = len(users)
    active = sum(1 for u in users if u.is_active and u.is_verified)
    suspended = sum(1 for u in users if not u.is_active)
    unverified = sum(1 for u in users if u.is_active and not u.is_verified)

    return CustomerStatsResponse(
        total_customers=total,
        active_customers=active,
        suspended_customers=suspended,
        unverified_customers=unverified,
    )


@router.get("", response_model=List[CustomerResponse], summary="List Customers")
def list_customers(
    search: Optional[str] = Query(None, description="Search by customer name, email or phone"),
    status: Optional[str] = Query(None, description="Filter: Active, Suspended, Pending, Unverified"),
    role: Optional[str] = Query(None, description="Filter by role"),
    db: Session = Depends(get_db),
):
    """
    Retrieves real customer records from PostgreSQL users table.
    """
    query = db.query(User)

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            func.lower(User.email).like(s) |
            func.lower(User.full_name).like(s) |
            User.phone_number.like(s)
        )

    if status and status.strip().lower() not in ("all", "all statuses"):
        st = status.strip().lower()
        if st == "active":
            query = query.filter(User.is_active.is_(True), User.is_verified.is_(True))
        elif st in ("suspended", "inactive"):
            query = query.filter(User.is_active.is_(False))
        elif st in ("pending", "unverified"):
            query = query.filter(User.is_active.is_(True), User.is_verified.is_(False))

    if role and role.strip().lower() not in ("all", "all roles"):
        query = query.filter(func.lower(User.role) == role.strip().lower())

    users = query.order_by(User.id.desc()).all()
    return [format_customer_response(u) for u in users]


@router.get("/{customer_id}", response_model=CustomerResponse, summary="Get Customer Detail")
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """
    Fetch a single customer record by User ID.
    """
    user = db.query(User).filter(User.id == customer_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found in database.",
        )
    return format_customer_response(user)


@router.post("/{customer_id}/suspend", response_model=CustomerResponse, summary="Suspend or Activate Customer")
def toggle_customer_suspension(
    customer_id: int,
    action: Optional[str] = Query(None, description="Explicit action: 'suspend' or 'activate'"),
    db: Session = Depends(get_db),
):
    """
    Toggles or sets customer active status in PostgreSQL.
    """
    user = db.query(User).filter(User.id == customer_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found.",
        )

    if action:
        if action.lower() == "suspend":
            user.is_active = False
        elif action.lower() == "activate":
            user.is_active = True
        else:
            raise HTTPException(status_code=400, detail="Action must be 'suspend' or 'activate'")
    else:
        # Toggle
        user.is_active = not user.is_active

    db.commit()
    db.refresh(user)
    return format_customer_response(user)


@router.patch("/{customer_id}", response_model=CustomerResponse, summary="Update Customer")
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
):
    """
    Update customer details (name, phone, role, verified, active, mfa).
    """
    user = db.query(User).filter(User.id == customer_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found.",
        )

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.phone_number is not None:
        user.phone_number = payload.phone_number.strip()
    if payload.role is not None:
        user.role = payload.role.strip()
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.is_verified is not None:
        user.is_verified = payload.is_verified
    if payload.mfa_type is not None:
        user.mfa_type = payload.mfa_type.strip()

    db.commit()
    db.refresh(user)
    return format_customer_response(user)


# Link routes for /admin/customers alias
@public_admin_router.get("", response_model=List[CustomerResponse], include_in_schema=False)
def alias_list_customers(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return list_customers(search=search, status=status, role=role, db=db)


@public_admin_router.get("/{customer_id}", response_model=CustomerResponse, include_in_schema=False)
def alias_get_customer(customer_id: int, db: Session = Depends(get_db)):
    return get_customer(customer_id=customer_id, db=db)


@public_admin_router.post("/{customer_id}/suspend", response_model=CustomerResponse, include_in_schema=False)
def alias_suspend_customer(customer_id: int, action: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return toggle_customer_suspension(customer_id=customer_id, action=action, db=db)

"""
FastAPI router providing full CRUD and management endpoints for Institutions.
Interacts directly with PostgreSQL via SQLAlchemy.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User
from app.models.institution import Institution
from app.schemas.institution import (
    InstitutionCreate,
    InstitutionUpdate,
    InstitutionResponse,
    InstitutionStatsResponse,
    InstitutionListResponse,
)

router = APIRouter(prefix="/api/admin/institutions", tags=["Admin Institutions"])


def seed_default_institutions_if_empty(db: Session):
    """Seed initial institutions into PostgreSQL if table is empty."""
    if db.query(Institution).count() == 0:
        defaults = [
            {
                "name": "GTBank",
                "code": "GTB",
                "provider": "Aggregator A",
                "linked_accounts": 6120,
                "last_sync": "2 min ago",
                "success_rate_24h": 99.6,
                "status": "Healthy",
                "is_active": True,
            },
            {
                "name": "Access Bank",
                "code": "ACC",
                "provider": "Aggregator A",
                "linked_accounts": 4310,
                "last_sync": "4 min ago",
                "success_rate_24h": 98.9,
                "status": "Healthy",
                "is_active": True,
            },
            {
                "name": "FirstBank",
                "code": "FBN",
                "provider": "Aggregator A",
                "linked_accounts": 3004,
                "last_sync": "9 min ago",
                "success_rate_24h": 94.1,
                "status": "Degraded",
                "is_active": True,
            },
            {
                "name": "Zenith Bank",
                "code": "ZEN",
                "provider": "Aggregator A",
                "linked_accounts": 2870,
                "last_sync": "3 h ago",
                "success_rate_24h": 0.0,
                "status": "Maintenance",
                "is_active": False,
            },
            {
                "name": "United Bank for Africa (UBA)",
                "code": "UBA",
                "provider": "Aggregator B",
                "linked_accounts": 1940,
                "last_sync": "12 min ago",
                "success_rate_24h": 98.2,
                "status": "Healthy",
                "is_active": True,
            },
            {
                "name": "Stanbic IBTC Bank",
                "code": "STANBIC",
                "provider": "Aggregator B",
                "linked_accounts": 1420,
                "last_sync": "25 min ago",
                "success_rate_24h": 97.5,
                "status": "Healthy",
                "is_active": True,
            },
        ]
        for item in defaults:
            db.add(Institution(**item))
        db.commit()


@router.get("/stats", response_model=InstitutionStatsResponse)
def get_institution_stats(db: Session = Depends(get_db)):
    """
    Get aggregated health and sync stats for all institutions.
    """
    seed_default_institutions_if_empty(db)
    items = db.query(Institution).all()

    total = len(items)
    live_count = sum(1 for i in items if i.status.lower() in ("healthy", "live", "active"))
    maintenance_count = sum(1 for i in items if i.status.lower() == "maintenance")
    degraded_count = sum(1 for i in items if i.status.lower() == "degraded")
    total_accounts = sum(i.linked_accounts for i in items)
    avg_rate = (sum(i.success_rate_24h for i in items) / total) if total > 0 else 0.0

    return InstitutionStatsResponse(
        total_institutions=total,
        live_count=live_count,
        maintenance_count=maintenance_count,
        degraded_count=degraded_count,
        avg_success_rate=round(avg_rate, 1),
        total_linked_accounts=total_accounts,
    )


@router.get("", response_model=List[InstitutionResponse])
def list_institutions(
    search: Optional[str] = Query(None, description="Search by name, code or provider"),
    status: Optional[str] = Query(None, description="Filter by status: Healthy, Degraded, Maintenance, Suspended"),
    db: Session = Depends(get_db),
):
    """
    List all institutions from PostgreSQL with optional search and status filtering.
    """
    seed_default_institutions_if_empty(db)
    query = db.query(Institution)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            (Institution.name.ilike(search_fmt)) |
            (Institution.code.ilike(search_fmt)) |
            (Institution.provider.ilike(search_fmt))
        )

    if status and status.strip().lower() not in ("all", "all statuses"):
        query = query.filter(Institution.status.ilike(status.strip()))

    return query.order_by(Institution.id.asc()).all()


@router.get("/{institution_id}", response_model=InstitutionResponse)
def get_institution(institution_id: int, db: Session = Depends(get_db)):
    """
    Retrieve single institution by its primary key.
    """
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institution with ID {institution_id} not found.",
        )
    return inst


@router.post("", response_model=InstitutionResponse, status_code=status.HTTP_201_CREATED)
def create_institution(payload: InstitutionCreate, db: Session = Depends(get_db)):
    """
    Add a new institution to PostgreSQL database.
    """
    # Check if name already exists
    existing = db.query(Institution).filter(func.lower(Institution.name) == payload.name.strip().lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An institution named '{payload.name}' already exists in database.",
        )

    new_inst = Institution(
        name=payload.name.strip(),
        code=payload.code.strip().upper() if payload.code else None,
        provider=payload.provider.strip(),
        linked_accounts=payload.linked_accounts,
        last_sync=payload.last_sync or "Just now",
        success_rate_24h=payload.success_rate_24h,
        status=payload.status,
        is_active=payload.is_active,
    )
    db.add(new_inst)
    db.commit()
    db.refresh(new_inst)
    return new_inst


@router.put("/{institution_id}", response_model=InstitutionResponse)
@router.patch("/{institution_id}", response_model=InstitutionResponse)
def update_institution(
    institution_id: int,
    payload: InstitutionUpdate,
    db: Session = Depends(get_db),
):
    """
    Update an existing institution in PostgreSQL.
    """
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institution with ID {institution_id} not found.",
        )

    # Check unique name conflict if changing name
    if payload.name and payload.name.strip().lower() != inst.name.lower():
        conflict = (
            db.query(Institution)
            .filter(
                func.lower(Institution.name) == payload.name.strip().lower(),
                Institution.id != institution_id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another institution already has the name '{payload.name}'.",
            )
        inst.name = payload.name.strip()

    if payload.code is not None:
        inst.code = payload.code.strip().upper() if payload.code else None
    if payload.provider is not None:
        inst.provider = payload.provider.strip()
    if payload.linked_accounts is not None:
        inst.linked_accounts = payload.linked_accounts
    if payload.last_sync is not None:
        inst.last_sync = payload.last_sync
    if payload.success_rate_24h is not None:
        inst.success_rate_24h = payload.success_rate_24h
    if payload.status is not None:
        inst.status = payload.status
        # Sync is_active with status
        if payload.status.lower() == "maintenance":
            inst.is_active = False
        elif payload.status.lower() in ("healthy", "live"):
            inst.is_active = True
    if payload.is_active is not None:
        inst.is_active = payload.is_active

    db.commit()
    db.refresh(inst)
    return inst


@router.delete("/{institution_id}")
def delete_institution(institution_id: int, db: Session = Depends(get_db)):
    """
    Delete an institution from PostgreSQL.
    """
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institution with ID {institution_id} not found.",
        )

    name = inst.name
    db.delete(inst)
    db.commit()
    return {
        "success": True,
        "message": f"Institution '{name}' (ID: {institution_id}) successfully deleted from PostgreSQL.",
    }


# ---------------------------------------------------------------------------
# General / Client API: /api/institutions (Show Institutions List)
# ---------------------------------------------------------------------------
public_router = APIRouter(prefix="/api/institutions", tags=["Institutions"])


@public_router.get("", response_model=List[InstitutionResponse], summary="Show Institutions List")
def show_institutions_list(
    search: Optional[str] = Query(None, description="Search by name, code or provider"),
    status: Optional[str] = Query(None, description="Filter by status: Healthy, Degraded, Maintenance, Suspended"),
    is_active: Optional[bool] = Query(None, description="Filter by active status (true/false)"),
    skip: int = Query(0, ge=0, description="Number of records to skip (offset)"),
    limit: int = Query(50, ge=1, le=100, description="Max number of institutions to return"),
    db: Session = Depends(get_db),
):
    """
    Returns list of institutions from PostgreSQL.
    Supports search (e.g. ?search=gtb), status filtering, active filter, and pagination.
    """
    seed_default_institutions_if_empty(db)
    query = db.query(Institution)

    if is_active is not None:
        query = query.filter(Institution.is_active == is_active)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            (Institution.name.ilike(search_fmt)) |
            (Institution.code.ilike(search_fmt)) |
            (Institution.provider.ilike(search_fmt))
        )

    if status and status.strip().lower() not in ("all", "all statuses"):
        query = query.filter(Institution.status.ilike(status.strip()))

    return query.order_by(Institution.name.asc()).offset(skip).limit(limit).all()


@public_router.get("/paged", response_model=InstitutionListResponse, summary="Show Institutions List with Total Count")
def show_institutions_list_paged(
    search: Optional[str] = Query(None, description="Search by name, code or provider"),
    status: Optional[str] = Query(None, description="Filter by status"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records"),
    db: Session = Depends(get_db),
):
    """
    Returns institutions list wrapped with total count metadata for pagination.
    """
    seed_default_institutions_if_empty(db)
    query = db.query(Institution)

    if is_active is not None:
        query = query.filter(Institution.is_active == is_active)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            (Institution.name.ilike(search_fmt)) |
            (Institution.code.ilike(search_fmt)) |
            (Institution.provider.ilike(search_fmt))
        )

    if status and status.strip().lower() not in ("all", "all statuses"):
        query = query.filter(Institution.status.ilike(status.strip()))

    total = query.count()
    items = query.order_by(Institution.name.asc()).offset(skip).limit(limit).all()

    return InstitutionListResponse(
        total=total,
        items=items,
        skip=skip,
        limit=limit,
    )


@public_router.get("/{institution_id}", response_model=InstitutionResponse, summary="Get Single Institution Details")
def show_institution_detail(institution_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information for a specific institution by its ID.
    """
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institution with ID {institution_id} not found.",
        )
    return inst

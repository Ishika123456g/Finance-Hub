from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.institution import Institution
from app.schemas.user_institution import UserInstitutionSelect
from app.schemas.institution import InstitutionResponse

router = APIRouter(prefix="/api/admin/users", tags=["User Institutions"])

@router.post(
    "/{user_id}/institutions",
    response_model=List[InstitutionResponse],
    status_code=status.HTTP_200_OK,
    summary="Select institutions for a user",
)
def select_institutions_for_user(
    user_id: int,
    payload: UserInstitutionSelect,
    db: Session = Depends(get_db),
):
    """Associate a list of institution IDs with a user.
    - Replaces any existing selections with the new list.
    - Returns the list of Institution objects now linked to the user.
    """
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )
    # Fetch institutions and ensure all exist
    institutions = db.query(Institution).filter(Institution.id.in_(payload.institution_ids)).all()
    if len(institutions) != len(payload.institution_ids):
        missing = set(payload.institution_ids) - {inst.id for inst in institutions}
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Institutions not found: {missing}",
        )
    # Assign new list (SQLAlchemy updates the association table)
    user.institutions = institutions
    db.commit() 
    db.refresh(user)
    return institutions

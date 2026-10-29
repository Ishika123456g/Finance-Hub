from pydantic import BaseModel, Field
from typing import List

class UserInstitutionSelect(BaseModel):
    """Payload for selecting institutions for a user.
    Provide a list of institution IDs that the user has chosen.
    """
    institution_ids: List[int] = Field(..., description="List of Institution IDs to associate with the user")

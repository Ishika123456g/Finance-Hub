from sqlalchemy import Table, Column, Integer, ForeignKey
from app.core.database import Base

# Association table linking users and institutions (selected institutions)
user_institution = Table(
    "user_institution",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("institution_id", Integer, ForeignKey("institutions.id"), primary_key=True),
)

"""
Institution entity database model for FinanceHub.
Represents connected financial institutions, aggregator providers, and sync health.
"""

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, func
from sqlalchemy.orm import relationship
from app.models.user_institution import user_institution
from app.core.database import Base


class Institution(Base):
    __tablename__ = "institutions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(150), unique=True, index=True, nullable=False)
    code = Column(String(50), nullable=True, index=True)
    provider = Column(String(100), default="Aggregator A", nullable=False)
    linked_accounts = Column(Integer, default=0, nullable=False)
    last_sync = Column(String(100), default="Just now", nullable=False)
    success_rate_24h = Column(Float, default=99.0, nullable=False)
    status = Column(String(50), default="Healthy", nullable=False)  # Healthy, Degraded, Maintenance, Suspended
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Many-to-many relationship with Users (who selected this institution)
    users = relationship(
        "User",
        secondary=user_institution,
        back_populates="institutions",
    )

    def __repr__(self):
        return f"<Institution id={self.id} name='{self.name}' status='{self.status}'>"

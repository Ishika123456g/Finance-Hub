"""
Beneficiary database model for FinanceHub.
Represents saved payees for transfers and bill payments.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Beneficiary(Base):
    __tablename__ = "beneficiaries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    bank_name = Column(String(150), nullable=False)
    bank_code = Column(String(50), nullable=True)
    account_number = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="beneficiaries")
    transfers = relationship("Transfer", back_populates="beneficiary", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Beneficiary id={self.id} name='{self.name}' bank='{self.bank_name}'>"


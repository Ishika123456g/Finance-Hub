"""
Transfer / Payment database model for FinanceHub.
Represents simulated money transfers between accounts and beneficiaries.
"""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reference = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("user_bank_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    beneficiary_id = Column(Integer, ForeignKey("beneficiaries.id", ondelete="SET NULL"), nullable=True, index=True)

    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="NGN", nullable=False)
    note = Column(String(255), nullable=True)
    status = Column(String(50), default="completed", nullable=False)  # completed, pending, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="transfers")
    account = relationship("UserBankAccount")
    beneficiary = relationship("Beneficiary", back_populates="transfers")

    def __repr__(self):
        return f"<Transfer id={self.id} ref='{self.reference}' amount={self.amount} status='{self.status}'>"


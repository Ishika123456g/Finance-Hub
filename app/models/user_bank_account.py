"""
User Bank Account database model for FinanceHub.
Represents bank accounts connected via Mono Open Banking.
"""

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserBankAccount(Base):
    __tablename__ = "user_bank_accounts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mono_account_id = Column(String(100), unique=True, index=True, nullable=False)
    account_name = Column(String(255), nullable=True)
    account_number = Column(String(50), nullable=True)
    bank_name = Column(String(150), nullable=True)
    bank_code = Column(String(50), nullable=True)
    account_type = Column(String(50), default="savings", nullable=True)
    currency = Column(String(10), default="NGN", nullable=False)
    balance = Column(Float, default=0.0, nullable=False)
    bvn = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="bank_accounts")

    def __repr__(self):
        return f"<UserBankAccount id={self.id} user_id={self.user_id} bank='{self.bank_name}' mono_id='{self.mono_account_id}'>"

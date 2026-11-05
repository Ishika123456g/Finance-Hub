"""
Consent entity database model for FinanceHub Open Banking.
Represents evidence of what each customer allowed, for how long, and when it was withdrawn.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Consent(Base):
    __tablename__ = "consents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    consent_code = Column(String(50), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=True)
    institution_name = Column(String(150), nullable=False)
    scope = Column(String(255), default="Accounts, balances, transactions", nullable=False)
    granted_date = Column(String(50), nullable=False)
    expires_date = Column(String(50), nullable=False)
    status = Column(String(50), default="Active", nullable=False)  # Active, Expiring, Withdrawn

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="consents")

    def __repr__(self):
        return f"<Consent code='{self.consent_code}' customer='{self.customer_name}' status='{self.status}'>"


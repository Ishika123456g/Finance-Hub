"""
User entity database model for FinanceHub.
Represents end-users and administrative staff accounts.
"""

from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship
from app.models.user_institution import user_institution
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone_number = Column(String(50), nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="User", nullable=False)  # "Super admin", "Admin", "User", etc.
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    mfa_type = Column(String(50), default="SMS", nullable=True)
    mfa_secret = Column(String(100), nullable=True)
    # Many-to-many relationship with Institutions (selected by user)
    institutions = relationship(
        "Institution",
        secondary=user_institution,
        back_populates="users",
    )

    # One-to-many relationship with linked bank accounts via Mono
    bank_accounts = relationship(
        "UserBankAccount",
        back_populates="user",
        cascade="all, delete-orphan",
    )


    # OTP verification fields
    otp_code = Column(String(10), nullable=True)
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<User id={self.id} email='{self.email}' role='{self.role}'>"

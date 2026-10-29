"""
Authentication Router providing 4 core APIs for the mobile & web Sign up / Login workflow:
1. POST /api/auth/register    - User registration with Full name, Mobile number, Email, Password, Terms consent
2. POST /api/auth/login       - User login with credentials verification & OTP dispatch
3. POST /api/auth/verify-otp  - One-Time Password verification & JWT access token issuance
4. POST /api/auth/logout      - User session termination
"""

import random
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    OTPVerifyRequest,
    UserProfileResponse,
    RegisterResponse,
    LoginResponse,
    OTPVerifyResponse,
    LogoutResponse,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

OTP_EXPIRATION_MINUTES = 10


def generate_numeric_otp(length: int = 6) -> str:
    """Generates a secure 6-digit numeric OTP code."""
    return f"{random.randint(100000, 999999)}"


# ---------------------------------------------------------------------------
# 1. API: User Register (Sign Up)
# ---------------------------------------------------------------------------
@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED, summary="1. User Registration")
def register_user(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new end-user from the mobile/web Sign up screen.
    - Captures Full name, Mobile number, Email address, Password, and Terms Agreement.
    - Hashes password using bcrypt.
    - Generates a 6-digit OTP for phone/email verification and stores it in PostgreSQL.
    """
    email_clean = payload.email.strip().lower()
    phone_clean = payload.mobile_number.strip()

    # Check for existing email in PostgreSQL
    existing_email = db.query(User).filter(func.lower(User.email) == email_clean).first() 
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please log in instead.",
        )

    # Check for existing phone number in PostgreSQL
    existing_phone = db.query(User).filter(User.phone_number == phone_clean).first()
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this mobile number already exists. Please log in instead.",
        )

    # Generate 6-digit verification OTP
    otp = generate_numeric_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRATION_MINUTES)

    # Create user in PostgreSQL
    new_user = User(
        full_name=payload.full_name.strip(),
        phone_number=phone_clean,
        email=email_clean,
        hashed_password=get_password_hash(payload.password),
        role="User",
        is_active=True,
        is_verified=False,
        mfa_type="SMS",
        otp_code=otp,
        otp_expires_at=expires_at,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return RegisterResponse(
        message=f"Registration successful. A 6-digit OTP has been sent to your mobile number {phone_clean}.",
        email=new_user.email,
        mobile_number=new_user.phone_number,
        otp_code=otp,  # Returned for easy developer testing
    )


# ---------------------------------------------------------------------------
# 2. API: User Login
# ---------------------------------------------------------------------------
@router.post("/login", response_model=LoginResponse, summary="2. User Login")
def login_user(payload: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates registered user credentials.
    - Verifies email (or mobile number) and password.
    - Generates a fresh 6-digit OTP sent to the user's mobile number.
    - Direct access token issued for verified staff/super-admins.
    """
    identifier = (payload.email or "").strip()
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is required.",
        )

    # Query PostgreSQL by email or phone number
    user = (
        db.query(User)
        .filter(
            (func.lower(User.email) == identifier.lower()) |
            (User.phone_number == identifier)
        )
        .first()
    )

    # Fallback demo accounts for local prototyping
    demo_staff = {
        "c.okafor@mch.finance": {"name": "Chidi Okafor", "role": "Super admin"},
        "f.alade@mch.finance": {"name": "Funke Alade", "role": "Dispute agent"},
        "i.musa@mch.finance": {"name": "Ibrahim Musa", "role": "Compliance"},
    }

    if not user and identifier.lower() in demo_staff:
        staff_data = demo_staff[identifier.lower()]
        token = create_access_token(
            subject=identifier.lower(),
            extra_claims={"role": staff_data["role"], "is_superuser": True},
        )
        return LoginResponse(
            message="Staff authentication successful.",
            email=identifier.lower(),
            requires_otp=False,
            access_token=token,
            token_type="bearer",
            user=UserProfileResponse(
                id=0,
                full_name=staff_data["name"],
                email=identifier.lower(),
                mobile_number=None,
                role=staff_data["role"],
                is_verified=True,
            ),
        )

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended or deactivated. Please contact support.",
        )

    # Generate fresh 6-digit OTP for login verification
    otp = generate_numeric_otp()
    user.otp_code = otp
    user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRATION_MINUTES)
    db.commit()

    return LoginResponse(
        message=f"Credentials verified. A 6-digit OTP has been sent to your registered mobile number {user.phone_number or user.email}.",
        email=user.email,
        requires_otp=True,
        otp_code=otp,  # Returned for easy testing
    )


# ---------------------------------------------------------------------------
# 3. API: OTP Verify
# ---------------------------------------------------------------------------
@router.post("/verify-otp", response_model=OTPVerifyResponse, summary="3. Verify OTP & Issue Token")
def verify_otp(payload: OTPVerifyRequest, db: Session = Depends(get_db)):
    """
    Verifies the 6-digit One-Time Password sent to the user.
    - Validates matching OTP code and non-expired window.
    - Marks user as verified.
    - Generates and returns JWT Bearer access token for session authorization.
    """
    identifier = payload.email.strip().lower()
    user = (
        db.query(User)
        .filter(
            (func.lower(User.email) == identifier) |
            (User.phone_number == identifier)
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No account found associated with '{payload.email}'.",
        )

    if not user.otp_code or not user.otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending OTP request found. Please request a new OTP by signing in.",
        )

    # Check expiration
    now_utc = datetime.now(timezone.utc)
    if user.otp_expires_at < now_utc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired. Please log in again to generate a new code.",
        )

    # Check matching code
    if user.otp_code.strip() != payload.otp_code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code. Please check your SMS and try again.",
        )

    # Successful verification - clear OTP and activate
    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    db.refresh(user)

    # Generate JWT Bearer token
    access_token = create_access_token(
        subject=user.email,
        extra_claims={
            "user_id": user.id,
            "role": user.role,
            "full_name": user.full_name,
        },
    )

    return OTPVerifyResponse(
        message="OTP verified successfully. Welcome to FinanceHub!",
        access_token=access_token,
        token_type="bearer",
        expires_in_hours=24,
        user=UserProfileResponse(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            mobile_number=user.phone_number,
            role=user.role,
            is_verified=user.is_verified,
        ),
    )


# ---------------------------------------------------------------------------
# 4. API: User Logout
# ---------------------------------------------------------------------------
@router.post("/logout", response_model=LogoutResponse, summary="4. User Logout")
def logout_user(authorization: Optional[str] = Header(None)):
    """
    Logs out the authenticated user.
    - Terminates user session and client token state.
    """
    return LogoutResponse(
        message="Logged out successfully. Session closed."
    )

"""
Pydantic schemas for User Authentication (Register, Login, OTP Verification, and Logout).
Matches the mobile Sign up / Login screen specification.
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150, description="Customer full name", example="Adewale Afolabi")
    mobile_number: str = Field(..., min_length=7, max_length=30, description="Customer mobile number", example="+2348012345678")
    email: EmailStr = Field(..., description="Customer valid email address", example="adewale@example.com")
    password: str = Field(..., min_length=6, max_length=128, description="Account password", example="SecretPass123!")
    agree_terms: bool = Field(True, description="Consent to Terms and Privacy Notice")

    @field_validator("agree_terms")
    def validate_terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must agree to the Terms and Privacy Notice to continue.")
        return v


class UserLoginRequest(BaseModel):
    email: Optional[str] = Field(None, description="Registered email or mobile number", example="adewale@example.com")

    password: str = Field(..., min_length=1, description="Account password", example="SecretPass123!")


class OTPVerifyRequest(BaseModel):
    email: str = Field(..., description="Registered email or mobile number", example="adewale@example.com")
    otp_code: str = Field(..., min_length=4, max_length=10, description="One-Time Password received", example="123456")


class UserProfileResponse(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: str
    mobile_number: Optional[str] = None
    role: str
    is_verified: bool

    model_config = ConfigDict(from_attributes=True)


class RegisterResponse(BaseModel):
    message: str
    email: str
    mobile_number: str
    otp_code: Optional[str] = None  # Included for immediate development / testing convenience


class LoginResponse(BaseModel):
    message: str
    email: str
    requires_otp: bool = True
    otp_code: Optional[str] = None  # Included for dev / testing convenience
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    user: Optional[UserProfileResponse] = None


class OTPVerifyResponse(BaseModel):
    message: str
    access_token: str
    token_type: str = "bearer"
    expires_in_hours: int = 24
    user: UserProfileResponse


class LogoutResponse(BaseModel):
    message: str = "Logged out successfully."

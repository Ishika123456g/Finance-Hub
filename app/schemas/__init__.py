"""
Pydantic schemas for request validation and API serialization.
"""

from app.schemas.institution import (
    InstitutionBase,
    InstitutionCreate,
    InstitutionUpdate,
    InstitutionResponse,
    InstitutionStatsResponse, 
    InstitutionListResponse,
)   
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

__all__ = [
    "InstitutionBase",
    "InstitutionCreate",
    "InstitutionUpdate",
    "InstitutionResponse",
    "InstitutionStatsResponse",
    "InstitutionListResponse",
    "UserRegisterRequest",
    "UserLoginRequest",
    "OTPVerifyRequest",
    "UserProfileResponse",
    "RegisterResponse",
    "LoginResponse",
    "OTPVerifyResponse",
    "LogoutResponse",
]

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
    LinkAccountRequest,
    LinkAccountResponse,
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
from app.schemas.payment import (
    BeneficiaryBase,
    BeneficiaryCreate,
    BeneficiaryResponse,
    SendMoneyRequest,
    SendMoneyResponse,
    TransferItemResponse,
    TransferListResponse,
)

__all__ = [
    "InstitutionBase",
    "InstitutionCreate",
    "InstitutionUpdate",
    "InstitutionResponse",
    "InstitutionStatsResponse",
    "InstitutionListResponse",
    "LinkAccountRequest",
    "LinkAccountResponse",
    "UserRegisterRequest",
    "UserLoginRequest",
    "OTPVerifyRequest",
    "UserProfileResponse",
    "RegisterResponse",
    "LoginResponse",
    "OTPVerifyResponse",
    "LogoutResponse",
    "BeneficiaryBase",
    "BeneficiaryCreate",
    "BeneficiaryResponse",
    "SendMoneyRequest",
    "SendMoneyResponse",
    "TransferItemResponse",
    "TransferListResponse",
]

"""
FastAPI route modules for FinanceHub.
"""

from app.routers.auth import router as auth_router
from app.routers.institution import (
    router as institution_router,
    public_router as public_institution_router,
)
from app.routers.user_institution import router as user_institution_router
from app.routers.customer import (
    router as customer_router,
    public_admin_router as public_customer_router,
)
from app.routers.mono import router as mono_router

__all__ = [
    "auth_router",
    "institution_router",
    "public_institution_router",
    "customer_router",
    "public_customer_router",
    "user_institution_router",
    "mono_router",
]


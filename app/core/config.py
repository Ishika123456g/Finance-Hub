"""
Core application settings and environment configuration using Pydantic Settings.
Configures PostgreSQL connection parameters, JWT secrets, and service metadata.
"""

from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application Info
    PROJECT_NAME: str = "FinanceHub"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Security
    SECRET_KEY: str = "replace-with-a-very-secure-random-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # PostgreSQL Database Settings
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "financehub_db"
    DATABASE_URL: str = "postgresql+psycopg2://postgres:password@localhost:5432/financehub_db"
    ASYNC_DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/financehub_db"

    # Super Admin Seed Credentials
    ADMIN_EMAIL: str = "admin@financehub.local"
    ADMIN_PASSWORD: str = "AdminPassword123!"

    # Mono Sandbox / Live Integration
    MONO_PUBLIC_KEY: str = "test_pk_jqiidgnba6z0ripblsbd"
    MONO_SECRET_KEY: str = "test_sk_iyxs2lgi8s76w5bzb6ts"
    MONO_BASE_URL: str = "https://api.withmono.com"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:8000", "http://127.0.0.1:8000"]

    @field_validator("CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


settings = Settings()

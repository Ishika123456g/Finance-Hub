"""
SQLAlchemy 2.0 PostgreSQL database engine and session configuration.
Provides database session dependency for FastAPI routes.
"""

from typing import Generator 
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings 

# PostgreSQL Engine Configuration 
# pool_pre_ping=True checks connection liveness before executing queries
# pool_size and max_overflow optimize connection pooling for PostgreSQL
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.DEBUG,
)

# SessionLocal class to generate individual database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)   

# Declarative Base for SQLAlchemy ORM models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a SQLAlchemy database session.
    Automatically closes the session when request lifecycle ends.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

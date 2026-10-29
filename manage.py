#!/usr/bin/env python3
"""
FinanceHub Project Management CLI.
Django-style management commands for FastAPI & PostgreSQL:
    python manage.py createsuperuser
    python manage.py initdb
    python manage.py listusers
    python manage.py checkdb
    python manage.py runserver
"""

import sys
import getpass
import argparse
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User


def initdb():
    """Initializes all database tables in PostgreSQL."""
    print(f"Connecting to PostgreSQL: {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✓ All database tables created successfully in PostgreSQL!")
        return 0
    except Exception as e:
        print(f"✗ Failed to create tables: {e}")
        return 1


def checkdb():
    """Verifies connection to PostgreSQL database."""
    from sqlalchemy import text
    print(f"Connecting to PostgreSQL: {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}...")
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT version();")).scalar()
            print("✓ PostgreSQL Connection Successful!")
            print(f"  Version: {res}")
            return 0
    except Exception as e:
        print("✗ Could not connect to PostgreSQL database.")
        print(f"  Error: {e}")
        return 1


def createsuperuser(email=None, name=None, password=None, role="Super admin"):
    """Creates a super administrator in the PostgreSQL database."""
    print("=" * 60)
    print(" FinanceHub · Create Super Admin (PostgreSQL)")
    print("=" * 60)

    # 1. Ensure tables exist in PostgreSQL
    Base.metadata.create_all(bind=engine)

    # 2. Prompt for Email
    while not email:
        email_input = input("Email address: ").strip().lower()
        if not email_input:
            print("Error: Email address cannot be blank.")
            continue
        if "@" not in email_input or "." not in email_input:
            print("Error: Enter a valid email address.")
            continue
        email = email_input

    # 3. Prompt for Full Name
    if not name:
        name_input = input("Full Name [Super Admin]: ").strip()
        name = name_input if name_input else "Super Admin"

    # 4. Prompt for Password (masked)
    while not password:
        p1 = getpass.getpass("Password: ")
        if not p1 or len(p1) < 8:
            print("Error: Password must be at least 8 characters long.")
            continue
        p2 = getpass.getpass("Password (again): ")
        if p1 != p2:
            print("Error: The two passwords do not match.")
            continue
        password = p1

    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"! User '{email}' already exists. Updating to Super Admin...")
            existing_user.full_name = name
            existing_user.role = role
            existing_user.is_superuser = True
            existing_user.is_active = True
            existing_user.hashed_password = get_password_hash(password)
            db.commit()
            print(f"✓ Super Admin '{email}' updated successfully in PostgreSQL.")
        else:
            new_user = User(
                email=email,
                full_name=name,
                hashed_password=get_password_hash(password),
                role=role,
                is_superuser=True,
                is_active=True,
                mfa_type="Authenticator"
            )
            db.add(new_user)
            db.commit()
            print("-" * 60)
            print(f"✓ Super Admin '{email}' saved to PostgreSQL database '{settings.POSTGRES_DB}'.")
            print(f"  Name: {name}")
            print(f"  Role: {role}")
            print(f"  Superuser: True")
            print(f"  Sign in at: http://localhost:8000/login")
            print("=" * 60)
        return 0
    except Exception as e:
        db.rollback()
        print(f"✗ Database error creating superuser: {e}")
        return 1
    finally:
        db.close()


def listusers():
    """Lists current registered users from PostgreSQL database."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"\nRegistered Users in PostgreSQL ({settings.POSTGRES_DB}):")
        print(f"{'ID':<4} {'Email':<28} {'Full Name':<20} {'Role':<16} {'Superuser':<10} {'Active':<8}")
        print("-" * 88)
        if not users:
            print("No users found in database. Run 'python manage.py createsuperuser' to add one.")
        for u in users:
            print(f"{u.id:<4} {u.email:<28} {(u.full_name or ''):<20} {u.role:<16} {str(u.is_superuser):<10} {str(u.is_active):<8}")
        print()
        return 0
    except Exception as e:
        print(f"✗ Error reading users: {e}")
        return 1
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="FinanceHub Management Tool")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # createsuperuser command
    create_parser = subparsers.add_parser("createsuperuser", help="Create an administrative superuser in PostgreSQL")
    create_parser.add_argument("--email", help="Superuser work email")
    create_parser.add_argument("--name", help="Superuser full name")
    create_parser.add_argument("--password", help="Superuser password (non-interactive)")
    create_parser.add_argument("--role", default="Super admin", help="Role [Super admin]")

    # initdb command
    subparsers.add_parser("initdb", help="Create all database tables in PostgreSQL")

    # checkdb command
    subparsers.add_parser("checkdb", help="Verify connection to PostgreSQL database")

    # listusers command
    subparsers.add_parser("listusers", help="List all users in PostgreSQL database")

    # runserver command
    run_parser = subparsers.add_parser("runserver", help="Run FastAPI uvicorn development server")
    run_parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    run_parser.add_argument("--host", default="0.0.0.0", help="Host interface")

    args = parser.parse_args()

    if args.command == "createsuperuser":
        return createsuperuser(email=args.email, name=args.name, password=args.password, role=args.role)
    elif args.command == "initdb":
        return initdb()
    elif args.command == "checkdb":
        return checkdb()
    elif args.command == "listusers":
        return listusers()
    elif args.command == "runserver":
        import uvicorn
        uvicorn.run("app.main:app", host=args.host, port=args.port, reload=True)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())

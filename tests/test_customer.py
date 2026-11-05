import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.models.user import User
from app.models.institution import Institution
from app.models.user_bank_account import UserBankAccount
from app.main import app

# In-memory SQLite engine for fast, isolated API testing
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client(setup_db):
    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_delete_customer_success(client):
    db = TestingSession()
    user = User(
        email="delete_me@example.com",
        hashed_password="hashed_pwd",
        full_name="John Doe",
        is_active=True,
        is_verified=True,
    )
    inst = Institution(
        name="Apex Bank",
        code="APX",
        provider="Aggregator A",
        status="Healthy",
        is_active=True,
    )
    user.institutions.append(inst)
    bank_acc = UserBankAccount(
        mono_account_id="mono_test_01",
        account_name="Savings Account",
        account_number="0123456789",
        bank_name="Apex Bank",
        balance=15000.0,
    )
    user.bank_accounts.append(bank_acc)
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = user.id
    db.close()

    # 1. Verify customer exists
    res = client.get(f"/api/admin/customers/{user_id}")
    assert res.status_code == 200
    assert res.json()["email"] == "delete_me@example.com"

    # 2. Delete customer via DELETE /api/admin/customers/{id}
    res_del = client.delete(f"/api/admin/customers/{user_id}")
    assert res_del.status_code == 200
    del_data = res_del.json()
    assert del_data["success"] is True
    assert f"(ID: {user_id})" in del_data["message"]

    # 3. Verify user is removed from database
    res_after = client.get(f"/api/admin/customers/{user_id}")
    assert res_after.status_code == 404

    # 4. Verify repeated delete returns 404
    res_repeat = client.delete(f"/api/admin/customers/{user_id}")
    assert res_repeat.status_code == 404


def test_delete_customer_alias(client):
    db = TestingSession()
    user = User(
        email="alias_delete@example.com",
        hashed_password="hashed_pwd",
        full_name="Jane Smith",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = user.id
    db.close()

    # Delete via alias endpoint /admin/customers/{id}
    res_alias = client.delete(f"/admin/customers/{user_id}")
    assert res_alias.status_code == 200
    assert res_alias.json()["success"] is True


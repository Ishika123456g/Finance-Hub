import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.models.user import User
from app.models.consent import Consent
from app.models.user_bank_account import UserBankAccount
from app.main import app

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


def test_dynamic_consents_from_real_users(client):
    db = TestingSession()
    # Create real customers in DB (like Nidhi and Ravi)
    user1 = User(
        email="user@1gmail.com",
        hashed_password="pw",
        full_name="Nidhi",
        is_active=True,
        is_verified=True,
    )
    user2 = User(
        email="ravi@gmail.com",
        hashed_password="pw",
        full_name="Ravi",
        is_active=True,
        is_verified=True,
    )
    db.add(user1)
    db.add(user2)
    db.commit()
    db.refresh(user1)
    db.refresh(user2)

    # Attach bank account to Nidhi
    acc = UserBankAccount(
        user_id=user1.id,
        mono_account_id="mono_nidhi_01",
        bank_name="GTBank",
        account_name="Nidhi Savings",
        account_number="0123456789",
        balance=450000.0,
        is_active=True,
    )
    db.add(acc)
    db.commit()
    db.close()

    # Query API
    res = client.get("/api/admin/consents")
    assert res.status_code == 200
    consents = res.json()
    assert len(consents) >= 2

    # Verify real customer names from DB are returned (not mockup names)
    names = [c["customer"] for c in consents]
    assert "Nidhi" in names
    assert "Ravi" in names
    assert "Adewale Afolabi" not in names


def test_search_and_filter_real_consents(client):
    # Search for Nidhi
    res_search = client.get("/api/admin/consents?search=Nidhi")
    assert res_search.status_code == 200
    assert len(res_search.json()) == 1
    assert res_search.json()[0]["customer"] == "Nidhi"
    assert res_search.json()[0]["institution"] == "GTBank"

    # Search for Ravi
    res_ravi = client.get("/api/admin/consents?search=ravi@gmail.com")
    assert res_ravi.status_code == 200
    assert len(res_ravi.json()) == 1
    assert res_ravi.json()[0]["customer"] == "Ravi"

    # Status filter
    res_act = client.get("/api/admin/consents?status=Active")
    assert res_act.status_code == 200
    assert len(res_act.json()) >= 2

    # Get single consent evidence detail
    consent_code = res_search.json()[0]["consent_id"]
    res_detail = client.get(f"/api/admin/consents/{consent_code}")
    assert res_detail.status_code == 200
    assert res_detail.json()["customer"] == "Nidhi"
    assert res_detail.json()["scope"] == "Accounts, balances, transactions"

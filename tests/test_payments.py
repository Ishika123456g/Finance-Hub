import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.models.user import User
from app.models.user_bank_account import UserBankAccount
from app.models.beneficiary import Beneficiary
from app.models.transfer import Transfer
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


def test_payment_and_transfer_lifecycle(client):
    db = TestingSession()

    # 1. Seed User
    user = User(
        email="test_pay@example.com",
        hashed_password="pw_hash_test",
        full_name="Rahul Kumar",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 2. Seed UserBankAccount with ₦450,000.00
    account = UserBankAccount(
        user_id=user.id,
        mono_account_id="mono_test_gtb_01",
        account_name="Rahul Kumar",
        bank_name="Guaranty Trust Bank (GTBank)",
        bank_code="058",
        account_number="0123456789",
        account_type="savings",
        balance=450000.00,
        currency="NGN",
        is_active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    user_id = user.id
    account_id = account.id
    db.close()

    # 3. Test GET /api/payments/beneficiaries (must be 0 by default for new user)
    res_bens = client.get(f"/api/payments/beneficiaries?user_id={user_id}")
    assert res_bens.status_code == 200
    bens = res_bens.json()
    assert len(bens) == 0, "New registered user must start with 0 beneficiaries (dynamic)"

    # 4. Test POST /api/payments/beneficiaries (dynamically add payee)
    res_add_ben = client.post("/api/payments/beneficiaries", json={
        "user_id": user_id,
        "name": "Kelechi Iheanacho",
        "bank_name": "First Bank",
        "account_number": "3019283746",
    })
    assert res_add_ben.status_code == 200
    new_ben = res_add_ben.json()
    assert new_ben["name"] == "Kelechi Iheanacho"
    assert new_ben["initials"] == "KI"
    beneficiary_id = new_ben["id"]

    # Verify list now has 1 beneficiary
    res_bens2 = client.get(f"/api/payments/beneficiaries?user_id={user_id}")
    assert len(res_bens2.json()) == 1

    # 5. Test POST /api/payments/send - Successful simulated transfer
    transfer_payload = {
        "user_id": user_id,
        "from_account_id": account_id,
        "beneficiary_id": beneficiary_id,
        "amount": 50000.00,
        "note": "Rent contribution test",
    }
    res_send = client.post("/api/payments/send", json=transfer_payload)
    assert res_send.status_code == 200
    send_data = res_send.json()
    assert send_data["success"] is True
    assert send_data["remaining_balance"] == 400000.00
    assert "₦400,000.00" in send_data["formatted_remaining_balance"]
    assert send_data["transfer"]["status"] == "completed"
    assert send_data["transfer"]["reference"].startswith("TRF-")

    # 6. Test POST /api/payments/send - Insufficient balance (balance is now 400,000; attempt to send 500,000)
    res_insufficient = client.post("/api/payments/send", json={
        "user_id": user_id,
        "from_account_id": account_id,
        "beneficiary_id": beneficiary_id,
        "amount": 500000.00,
        "note": "Excess amount",
    })
    assert res_insufficient.status_code == 400
    assert "Insufficient balance" in res_insufficient.json()["detail"]

    # 7. Test GET /api/payments/transfers
    res_transfers = client.get(f"/api/payments/transfers?user_id={user_id}")
    assert res_transfers.status_code == 200
    history = res_transfers.json()
    assert history["status"] == "success"
    assert history["total_transfers"] == 1
    assert history["total_sent_amount"] == 50000.00
    assert history["transfers"][0]["amount"] == 50000.00


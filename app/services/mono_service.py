"""
Mono Open Banking Integration Service.
Handles interaction with Mono Sandbox/Production API.
"""

from typing import Any, Dict, Optional
import httpx
from app.core.config import settings


class MonoClient:
    def __init__(
        self,
        secret_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.secret_key = secret_key or settings.MONO_SECRET_KEY
        self.base_url = (base_url or settings.MONO_BASE_URL).rstrip("/")
        self.headers = {
            "mono-sec-key": self.secret_key,
            "accept": "application/json",
            "Content-Type": "application/json",
        }

    def exchange_token(self, code: str) -> Dict[str, Any]:
        """
        Exchange temporary auth code from Mono Connect (widget/mobile)
        for a permanent Account ID.
        """
        url = f"{self.base_url}/v2/accounts/auth"
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, headers=self.headers, json={"code": code})
            if resp.status_code == 404 or resp.status_code == 405:
                # Fallback to v1 endpoint if v2 is not recognized
                url_v1 = f"{self.base_url}/v1/account/auth"
                resp = client.post(url_v1, headers=self.headers, json={"code": code})
            resp.raise_for_status()
            return resp.json()

    def get_account(self, account_id: str) -> Dict[str, Any]:
        """
        Fetch bank account details, balance, institution info for the given account_id.
        """
        url = f"{self.base_url}/v2/accounts/{account_id}"
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(url, headers=self.headers)
            if resp.status_code == 404:
                url_v1 = f"{self.base_url}/v1/accounts/{account_id}"
                resp = client.get(url_v1, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    def get_transactions(self, account_id: str, limit: int = 50) -> Dict[str, Any]:
        """
        Fetch real-time transaction history for the given linked account.
        """
        url = f"{self.base_url}/v2/accounts/{account_id}/transactions"
        params = {"limit": limit}
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(url, headers=self.headers, params=params)
            resp.raise_for_status()
            return resp.json()

    def get_identity(self, account_id: str) -> Dict[str, Any]:
        """
        Fetch customer identity information (BVN, phone, address, etc.) from bank.
        """
        url = f"{self.base_url}/v2/accounts/{account_id}/identity"
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(url, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    def create_link(self, name: str, email: str) -> Dict[str, Any]:
        """
        Helper for legacy link-based initialization.
        """
        return {
            "token": f"sandbox_token_{email}",
            "link_id": f"sandbox_link_{email}",
            "public_key": settings.MONO_PUBLIC_KEY,
        }

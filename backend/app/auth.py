"""
Server-side authentication for the single-user MVP.

Credentials are hardcoded (user/password). Login returns a cryptographically
secure token stored in memory; every protected endpoint validates it via the
require_auth dependency.
"""

import secrets
from typing import Annotated

from fastapi import Header, HTTPException

HARDCODED_USERNAME = "user"
HARDCODED_PASSWORD = "password"

# Active session tokens (in-memory; cleared on restart, which is fine for MVP).
_tokens: set[str] = set()


def login(username: str, password: str) -> str | None:
    """Validate credentials and return a new token, or None if invalid."""
    if username == HARDCODED_USERNAME and password == HARDCODED_PASSWORD:
        token = secrets.token_hex(32)
        _tokens.add(token)
        return token
    return None


def logout(token: str) -> None:
    _tokens.discard(token)


def require_auth(authorization: Annotated[str | None, Header()] = None) -> str:
    """FastAPI dependency — extracts and validates the Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ")
    if token not in _tokens:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return token

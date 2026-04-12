import secrets
from datetime import datetime, timezone
from typing import Annotated

import bcrypt
from fastapi import Header, HTTPException

from app.database import get_db

_tokens: dict[str, str] = {}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def login(username: str, password: str) -> str | None:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE username = ?", (username,)
        ).fetchone()
    finally:
        conn.close()

    if not row or not verify_password(password, row["password_hash"]):
        return None

    token = secrets.token_hex(32)
    _tokens[token] = row["id"]
    return token


def logout(token: str) -> None:
    _tokens.pop(token, None)


def register(username: str, password: str) -> str | None:
    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if existing:
            return None

        user_id = f"user-{secrets.token_hex(8)}"
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        hashed = hash_password(password)
        with conn:
            conn.execute(
                "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (user_id, username, hashed, now),
            )
        return user_id
    finally:
        conn.close()


def require_auth(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ")
    user_id = _tokens.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


def get_raw_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ")
    if token not in _tokens:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return token

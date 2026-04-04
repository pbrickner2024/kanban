"""Tests for the AI chat endpoint — the OpenAI client is fully mocked."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import app.router as _router
import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_ai_rate_limit():
    """Reset the in-process rate-limit counter before each test."""
    _router._ai_last_call = 0.0
    yield


@pytest.fixture()
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


@pytest.fixture()
def client(db_path: Path):
    """Authenticated TestClient backed by a fresh temporary database."""
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db

        init_db()
        from app.main import app

        with TestClient(app) as c:
            r = c.post("/api/auth/login", json={"username": "user", "password": "password"})
            assert r.status_code == 200
            token = r.json()["token"]

            _orig = c.request

            def authed_request(method, url, **kwargs):
                headers = dict(kwargs.pop("headers", {}) or {})
                headers.setdefault("Authorization", f"Bearer {token}")
                return _orig(method, url, headers=headers, **kwargs)

            c.request = authed_request  # type: ignore[method-assign]
            yield c


def _mock_chat(reply: str):
    return patch("app.router.ai_module.chat", return_value={"reply": reply, "kanban_update": None})


# ---------------------------------------------------------------------------
# POST /api/ai/chat
# ---------------------------------------------------------------------------


def test_ai_chat_requires_auth(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            with _mock_chat("hi"):
                r = c.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]})
            assert r.status_code == 401


def test_ai_chat_returns_reply(client):
    with _mock_chat("4"):
        r = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "What is 2+2?"}]},
        )
    assert r.status_code == 200
    assert r.json()["reply"] == "4"
    assert r.json()["kanban_update"] is None


def test_ai_chat_passes_messages_to_client(client):
    mock_fn = MagicMock(return_value={"reply": "Hello!", "kanban_update": None})
    with patch("app.router.ai_module.chat", mock_fn):
        client.post(
            "/api/ai/chat",
            json={
                "messages": [
                    {"role": "system", "content": "You are helpful."},
                    {"role": "user", "content": "Hi"},
                ]
            },
        )
    _, kwargs = mock_fn.call_args
    assert "board" in kwargs
    assert kwargs["board"]["id"] == "board-1"
    assert kwargs["messages"] == [
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": "Hi"},
    ]


def test_ai_chat_multi_turn(client):
    with _mock_chat("Paris"):
        r = client.post(
            "/api/ai/chat",
            json={
                "messages": [
                    {"role": "user", "content": "What is the capital of France?"},
                    {"role": "assistant", "content": "I can help with that."},
                    {"role": "user", "content": "Answer please."},
                ]
            },
        )
    assert r.status_code == 200
    assert r.json()["reply"] == "Paris"


def test_ai_chat_missing_api_key_returns_503(client):
    with patch("app.router.ai_module.chat", side_effect=RuntimeError("OPENROUTER_API_KEY environment variable not set")):
        r = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
    assert r.status_code == 503
    assert "OPENROUTER_API_KEY" in r.json()["detail"]


def test_ai_chat_empty_messages_passes_through(client):
    with _mock_chat("I need context"):
        r = client.post("/api/ai/chat", json={"messages": []})
    assert r.status_code == 200


def test_ai_chat_returns_structured_kanban_update(client):
    with patch(
        "app.router.ai_module.chat",
        return_value={
            "reply": "I moved the card.",
            "kanban_update": {
                "operations": [
                    {
                        "action": "move_card",
                        "card_id": "card-1",
                        "column_id": "col-done",
                        "position": 0,
                    }
                ]
            },
        },
    ):
        r = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "Move card-1 to done"}]},
        )
    assert r.status_code == 200
    assert r.json()["reply"] == "I moved the card."
    assert r.json()["kanban_update"]["operations"][0]["action"] == "move_card"


def test_ai_chat_rejects_unknown_card_id(client):
    with patch(
        "app.router.ai_module.chat",
        return_value={
            "reply": "Done.",
            "kanban_update": {
                "operations": [
                    {
                        "action": "move_card",
                        "card_id": "card-does-not-exist",
                        "column_id": "col-done",
                        "position": 0,
                    }
                ]
            },
        },
    ):
        r = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "Move nonexistent card"}]},
        )
    assert r.status_code == 422
    assert "card-does-not-exist" in r.json()["detail"]


def test_ai_chat_allows_create_card_with_new_card_id(client):
    with patch(
        "app.router.ai_module.chat",
        return_value={
            "reply": "Created it.",
            "kanban_update": {
                "operations": [
                    {
                        "action": "create_card",
                        "card_id": "card-from-ai",
                        "column_id": "col-backlog",
                        "title": "New task",
                    }
                ]
            },
        },
    ):
        r = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "Create a new task"}]},
        )
    assert r.status_code == 200
    assert r.json()["kanban_update"]["operations"][0]["action"] == "create_card"


def test_ai_chat_rejects_unknown_column_id(client):
    with patch(
        "app.router.ai_module.chat",
        return_value={
            "reply": "Done.",
            "kanban_update": {
                "operations": [
                    {
                        "action": "create_card",
                        "column_id": "col-does-not-exist",
                        "title": "New card",
                    }
                ]
            },
        },
    ):
        r = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "Add card to bad column"}]},
        )
    assert r.status_code == 422
    assert "col-does-not-exist" in r.json()["detail"]


def test_ai_chat_message_too_long(client):
    with _mock_chat("ok"):
        r = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "x" * 4001}]},
        )
    assert r.status_code == 422

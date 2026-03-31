"""Tests for the AI chat endpoint — the OpenAI client is fully mocked."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _mock_chat(reply: str):
    """Return a context manager that patches ai_module.chat to return *reply*."""
    return patch("app.router.ai_module.chat", return_value={"reply": reply, "kanban_update": None})


# ---------------------------------------------------------------------------
# POST /api/ai/chat
# ---------------------------------------------------------------------------


def test_ai_chat_returns_reply():
    with _mock_chat("4"):
        r = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "What is 2+2?"}]},
        )
    assert r.status_code == 200
    assert r.json()["reply"] == "4"
    assert r.json()["kanban_update"] is None


def test_ai_chat_passes_messages_to_client():
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


def test_ai_chat_multi_turn():
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


def test_ai_chat_missing_api_key_returns_503():
    with patch("app.router.ai_module.chat", side_effect=RuntimeError("OPENROUTER_API_KEY environment variable not set")):
        r = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
    assert r.status_code == 503
    assert "OPENROUTER_API_KEY" in r.json()["detail"]


def test_ai_chat_empty_messages_passes_through():
    with _mock_chat("I need context"):
        r = client.post("/api/ai/chat", json={"messages": []})
    assert r.status_code == 200


def test_ai_chat_returns_structured_kanban_update():
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

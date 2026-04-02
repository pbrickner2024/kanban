"""
Backend integration tests for the Kanban board API.

Uses a temporary SQLite database per test run to stay isolated.
"""

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


@pytest.fixture()
def client(db_path: Path):
    """Create an authenticated TestClient backed by a fresh temporary database."""
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db

        init_db()
        from app.main import app

        with TestClient(app) as c:
            r = c.post("/api/auth/login", json={"username": "user", "password": "password"})
            assert r.status_code == 200
            token = r.json()["token"]

            # Wrap request() to inject the auth header automatically.
            _orig = c.request

            def authed_request(method, url, **kwargs):
                headers = dict(kwargs.pop("headers", {}) or {})
                headers.setdefault("Authorization", f"Bearer {token}")
                return _orig(method, url, headers=headers, **kwargs)

            c.request = authed_request  # type: ignore[method-assign]
            yield c


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_board_requires_auth(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            r = c.get("/api/board")
            assert r.status_code == 401


def test_login_invalid_credentials(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            r = c.post("/api/auth/login", json={"username": "wrong", "password": "wrong"})
            assert r.status_code == 401


def test_logout_invalidates_token(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            r = c.post("/api/auth/login", json={"username": "user", "password": "password"})
            token = r.json()["token"]
            c.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
            r2 = c.get("/api/board", headers={"Authorization": f"Bearer {token}"})
            assert r2.status_code == 401


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# GET /api/board
# ---------------------------------------------------------------------------


def test_get_board_returns_board(client):
    r = client.get("/api/board")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == "board-1"
    assert len(data["columns"]) == 5


def test_get_board_columns_ordered(client):
    r = client.get("/api/board")
    columns = r.json()["columns"]
    positions = [c["position"] for c in columns]
    assert positions == sorted(positions)


def test_get_board_has_seed_cards(client):
    r = client.get("/api/board")
    all_cards = [card for col in r.json()["columns"] for card in col["cards"]]
    assert len(all_cards) == 8


def test_get_board_cards_ordered_within_column(client):
    r = client.get("/api/board")
    for col in r.json()["columns"]:
        positions = [c["position"] for c in col["cards"]]
        assert positions == sorted(positions)


# ---------------------------------------------------------------------------
# PATCH /api/board/columns/{id} — rename
# ---------------------------------------------------------------------------


def test_rename_column(client):
    r = client.patch("/api/board/columns/col-backlog", json={"title": "Todo"})
    assert r.status_code == 200
    assert r.json()["title"] == "Todo"


def test_rename_column_reflected_in_board(client):
    client.patch("/api/board/columns/col-backlog", json={"title": "Todo"})
    r = client.get("/api/board")
    titles = [c["title"] for c in r.json()["columns"]]
    assert "Todo" in titles


def test_rename_column_empty_title_rejected(client):
    r = client.patch("/api/board/columns/col-backlog", json={"title": "  "})
    assert r.status_code == 422


def test_rename_column_not_found(client):
    r = client.patch("/api/board/columns/col-missing", json={"title": "X"})
    assert r.status_code == 404


def test_rename_column_title_too_long(client):
    r = client.patch("/api/board/columns/col-backlog", json={"title": "x" * 201})
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/board/columns/{id}/cards — create card
# ---------------------------------------------------------------------------


def test_create_card(client):
    r = client.post("/api/board/columns/col-backlog/cards", json={"title": "New task"})
    assert r.status_code == 201
    card = r.json()
    assert card["title"] == "New task"
    assert card["column_id"] == "col-backlog"


def test_create_card_appended_at_end(client):
    # col-backlog has 2 seed cards (positions 0, 1)
    r = client.post("/api/board/columns/col-backlog/cards", json={"title": "Last"})
    assert r.json()["position"] == 2


def test_create_card_empty_title_rejected(client):
    r = client.post("/api/board/columns/col-backlog/cards", json={"title": "  "})
    assert r.status_code == 422


def test_create_card_column_not_found(client):
    r = client.post("/api/board/columns/col-missing/cards", json={"title": "X"})
    assert r.status_code == 404


def test_create_card_with_details(client):
    r = client.post(
        "/api/board/columns/col-backlog/cards",
        json={"title": "New task", "details": "Some notes"},
    )
    assert r.status_code == 201
    assert r.json()["details"] == "Some notes"


def test_create_card_title_too_long(client):
    r = client.post("/api/board/columns/col-backlog/cards", json={"title": "x" * 201})
    assert r.status_code == 422


def test_create_card_id_is_unique(client):
    r1 = client.post("/api/board/columns/col-backlog/cards", json={"title": "A"})
    r2 = client.post("/api/board/columns/col-backlog/cards", json={"title": "B"})
    assert r1.json()["id"] != r2.json()["id"]


# ---------------------------------------------------------------------------
# PATCH /api/board/cards/{id} — update card
# ---------------------------------------------------------------------------


def test_update_card_title(client):
    r = client.patch("/api/board/cards/card-1", json={"title": "Updated title"})
    assert r.status_code == 200
    assert r.json()["title"] == "Updated title"


def test_update_card_details(client):
    r = client.patch("/api/board/cards/card-1", json={"details": "New notes"})
    assert r.status_code == 200
    assert r.json()["details"] == "New notes"
    # title unchanged
    assert r.json()["title"] == "Align roadmap themes"


def test_update_card_empty_title_rejected(client):
    r = client.patch("/api/board/cards/card-1", json={"title": "   "})
    assert r.status_code == 422


def test_update_card_not_found(client):
    r = client.patch("/api/board/cards/card-999", json={"title": "X"})
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/board/cards/{id}
# ---------------------------------------------------------------------------


def test_delete_card(client):
    r = client.delete("/api/board/cards/card-1")
    assert r.status_code == 204


def test_delete_card_removes_from_board(client):
    client.delete("/api/board/cards/card-1")
    r = client.get("/api/board")
    all_cards = [c for col in r.json()["columns"] for c in col["cards"]]
    ids = [c["id"] for c in all_cards]
    assert "card-1" not in ids


def test_delete_card_compacts_positions(client):
    # card-1 is position 0, card-2 is position 1 in col-backlog
    client.delete("/api/board/cards/card-1")
    r = client.get("/api/board")
    backlog = next(c for c in r.json()["columns"] if c["id"] == "col-backlog")
    positions = [c["position"] for c in backlog["cards"]]
    assert positions == list(range(len(positions)))


def test_delete_card_not_found(client):
    r = client.delete("/api/board/cards/card-999")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /api/board/cards/{id}/move
# ---------------------------------------------------------------------------


def test_move_card_to_different_column(client):
    r = client.patch(
        "/api/board/cards/card-1/move",
        json={"column_id": "col-done", "position": 0},
    )
    assert r.status_code == 200
    assert r.json()["column_id"] == "col-done"
    assert r.json()["position"] == 0


def test_move_card_compacts_source_column(client):
    client.patch(
        "/api/board/cards/card-1/move",
        json={"column_id": "col-done", "position": 0},
    )
    r = client.get("/api/board")
    backlog = next(c for c in r.json()["columns"] if c["id"] == "col-backlog")
    positions = [c["position"] for c in backlog["cards"]]
    assert positions == list(range(len(positions)))


def test_move_card_expands_dest_column(client):
    client.patch(
        "/api/board/cards/card-1/move",
        json={"column_id": "col-done", "position": 0},
    )
    r = client.get("/api/board")
    done = next(c for c in r.json()["columns"] if c["id"] == "col-done")
    positions = [c["position"] for c in done["cards"]]
    assert positions == list(range(len(positions)))


def test_move_card_within_same_column(client):
    # card-1 is at pos 0 in backlog, move to pos 1
    r = client.patch(
        "/api/board/cards/card-1/move",
        json={"column_id": "col-backlog", "position": 1},
    )
    assert r.status_code == 200
    assert r.json()["position"] == 1


def test_move_card_not_found(client):
    r = client.patch(
        "/api/board/cards/card-999/move",
        json={"column_id": "col-done", "position": 0},
    )
    assert r.status_code == 404


def test_move_card_target_column_not_found(client):
    r = client.patch(
        "/api/board/cards/card-1/move",
        json={"column_id": "col-missing", "position": 0},
    )
    assert r.status_code == 404

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

            # Board id for the seeded default board
            r2 = c.get("/api/boards", headers={"Authorization": f"Bearer {token}"})
            assert r2.status_code == 200
            board_id = r2.json()[0]["id"]

            _orig = c.request

            def authed_request(method, url, **kwargs):
                headers = dict(kwargs.pop("headers", {}) or {})
                headers.setdefault("Authorization", f"Bearer {token}")
                return _orig(method, url, headers=headers, **kwargs)

            c.request = authed_request  # type: ignore[method-assign]
            c.board_id = board_id  # type: ignore[attr-defined]
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
            r = c.get("/api/boards")
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
            r2 = c.get("/api/boards", headers={"Authorization": f"Bearer {token}"})
            assert r2.status_code == 401


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


def test_register_creates_user(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            r = c.post("/api/auth/register", json={"username": "newuser", "password": "securepass"})
            assert r.status_code == 201
            assert "user_id" in r.json()


def test_register_duplicate_username_rejected(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            c.post("/api/auth/register", json={"username": "newuser", "password": "securepass"})
            r = c.post("/api/auth/register", json={"username": "newuser", "password": "otherpass"})
            assert r.status_code == 409


def test_register_username_too_short_rejected(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            r = c.post("/api/auth/register", json={"username": "ab", "password": "securepass"})
            assert r.status_code == 422


def test_register_password_too_short_rejected(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            r = c.post("/api/auth/register", json={"username": "validuser", "password": "short"})
            assert r.status_code == 422


def test_register_invalid_username_chars_rejected(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            r = c.post("/api/auth/register", json={"username": "bad user!", "password": "securepass"})
            assert r.status_code == 422


def test_registered_user_can_login(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            c.post("/api/auth/register", json={"username": "newuser", "password": "securepass"})
            r = c.post("/api/auth/login", json={"username": "newuser", "password": "securepass"})
            assert r.status_code == 200
            assert "token" in r.json()


def test_registered_user_wrong_password_rejected(db_path):
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            c.post("/api/auth/register", json={"username": "newuser", "password": "securepass"})
            r = c.post("/api/auth/login", json={"username": "newuser", "password": "wrongpass"})
            assert r.status_code == 401


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# GET /api/boards and GET /api/boards/{id}
# ---------------------------------------------------------------------------


def test_list_boards_returns_seeded_board(client):
    r = client.get("/api/boards")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert data[0]["id"] == "board-1"


def test_get_board_returns_full_data(client):
    r = client.get(f"/api/boards/{client.board_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == client.board_id
    assert len(data["columns"]) == 5


def test_get_board_columns_ordered(client):
    r = client.get(f"/api/boards/{client.board_id}")
    columns = r.json()["columns"]
    positions = [c["position"] for c in columns]
    assert positions == sorted(positions)


def test_get_board_has_seed_cards(client):
    r = client.get(f"/api/boards/{client.board_id}")
    all_cards = [card for col in r.json()["columns"] for card in col["cards"]]
    assert len(all_cards) == 8


def test_get_board_cards_ordered_within_column(client):
    r = client.get(f"/api/boards/{client.board_id}")
    for col in r.json()["columns"]:
        positions = [c["position"] for c in col["cards"]]
        assert positions == sorted(positions)


def test_get_board_wrong_user_returns_404(db_path):
    """User B cannot access user A's board."""
    with patch("app.database.DB_PATH", db_path):
        from app.database import init_db
        init_db()
        from app.main import app
        with TestClient(app) as c:
            # Register user B
            c.post("/api/auth/register", json={"username": "userb", "password": "passwordb"})
            r = c.post("/api/auth/login", json={"username": "userb", "password": "passwordb"})
            token_b = r.json()["token"]
            r2 = c.get("/api/boards/board-1", headers={"Authorization": f"Bearer {token_b}"})
            assert r2.status_code == 404


# ---------------------------------------------------------------------------
# Board CRUD
# ---------------------------------------------------------------------------


def test_create_board(client):
    r = client.post("/api/boards", json={"name": "Sprint Board"})
    assert r.status_code == 201
    assert r.json()["name"] == "Sprint Board"


def test_create_board_appears_in_list(client):
    client.post("/api/boards", json={"name": "Sprint Board"})
    r = client.get("/api/boards")
    names = [b["name"] for b in r.json()]
    assert "Sprint Board" in names


def test_rename_board(client):
    r = client.patch(f"/api/boards/{client.board_id}", json={"name": "Renamed Board"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed Board"


def test_delete_board(client):
    r = client.post("/api/boards", json={"name": "Temp Board"})
    new_id = r.json()["id"]
    r2 = client.delete(f"/api/boards/{new_id}")
    assert r2.status_code == 204
    r3 = client.get("/api/boards")
    ids = [b["id"] for b in r3.json()]
    assert new_id not in ids


def test_delete_board_cascades_columns_and_cards(client):
    # Create board with column and card, then delete board
    r = client.post("/api/boards", json={"name": "Temp"})
    bid = r.json()["id"]
    r2 = client.post(f"/api/boards/{bid}/columns", json={"title": "Col"})
    cid = r2.json()["id"]
    client.post(f"/api/boards/{bid}/columns/{cid}/cards", json={"title": "Card"})
    client.delete(f"/api/boards/{bid}")
    # Board gone
    r3 = client.get(f"/api/boards/{bid}")
    assert r3.status_code == 404


# ---------------------------------------------------------------------------
# Column management
# ---------------------------------------------------------------------------


def test_create_column(client):
    r = client.post(f"/api/boards/{client.board_id}/columns", json={"title": "Blocked"})
    assert r.status_code == 201
    assert r.json()["title"] == "Blocked"


def test_create_column_appended_at_end(client):
    r_board = client.get(f"/api/boards/{client.board_id}")
    max_pos = max(c["position"] for c in r_board.json()["columns"])
    r = client.post(f"/api/boards/{client.board_id}/columns", json={"title": "New"})
    assert r.json()["position"] == max_pos + 1


def test_delete_column(client):
    r = client.post(f"/api/boards/{client.board_id}/columns", json={"title": "Temp"})
    col_id = r.json()["id"]
    r2 = client.delete(f"/api/boards/{client.board_id}/columns/{col_id}")
    assert r2.status_code == 204
    r3 = client.get(f"/api/boards/{client.board_id}")
    col_ids = [c["id"] for c in r3.json()["columns"]]
    assert col_id not in col_ids


def test_delete_column_cascades_cards(client):
    r = client.post(f"/api/boards/{client.board_id}/columns", json={"title": "Temp"})
    col_id = r.json()["id"]
    client.post(f"/api/boards/{client.board_id}/columns/{col_id}/cards", json={"title": "Orphan"})
    client.delete(f"/api/boards/{client.board_id}/columns/{col_id}")
    r2 = client.get(f"/api/boards/{client.board_id}")
    all_cards = [card for col in r2.json()["columns"] for card in col["cards"]]
    titles = [c["title"] for c in all_cards]
    assert "Orphan" not in titles


def test_reorder_columns(client):
    r = client.get(f"/api/boards/{client.board_id}")
    col_ids = [c["id"] for c in r.json()["columns"]]
    reversed_ids = list(reversed(col_ids))
    r2 = client.patch(
        f"/api/boards/{client.board_id}/columns/reorder",
        json={"column_ids": reversed_ids},
    )
    assert r2.status_code == 204
    r3 = client.get(f"/api/boards/{client.board_id}")
    new_order = [c["id"] for c in r3.json()["columns"]]
    assert new_order == reversed_ids


def test_reorder_columns_bad_id_rejected(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/columns/reorder",
        json={"column_ids": ["col-nonexistent"]},
    )
    assert r.status_code == 422


def test_rename_column(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/columns/col-backlog",
        json={"title": "Todo"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Todo"


def test_rename_column_reflected_in_board(client):
    client.patch(
        f"/api/boards/{client.board_id}/columns/col-backlog",
        json={"title": "Todo"},
    )
    r = client.get(f"/api/boards/{client.board_id}")
    titles = [c["title"] for c in r.json()["columns"]]
    assert "Todo" in titles


def test_rename_column_empty_title_rejected(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/columns/col-backlog",
        json={"title": "  "},
    )
    assert r.status_code == 422


def test_rename_column_not_found(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/columns/col-missing",
        json={"title": "X"},
    )
    assert r.status_code == 404


def test_rename_column_title_too_long(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/columns/col-backlog",
        json={"title": "x" * 201},
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Cards — create
# ---------------------------------------------------------------------------


def test_create_card(client):
    r = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards",
        json={"title": "New task"},
    )
    assert r.status_code == 201
    card = r.json()
    assert card["title"] == "New task"
    assert card["column_id"] == "col-backlog"


def test_create_card_appended_at_end(client):
    r = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards",
        json={"title": "Last"},
    )
    assert r.json()["position"] == 2


def test_create_card_empty_title_rejected(client):
    r = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards",
        json={"title": "  "},
    )
    assert r.status_code == 422


def test_create_card_column_not_found(client):
    r = client.post(
        f"/api/boards/{client.board_id}/columns/col-missing/cards",
        json={"title": "X"},
    )
    assert r.status_code == 404


def test_create_card_with_details(client):
    r = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards",
        json={"title": "Task", "details": "Some notes"},
    )
    assert r.status_code == 201
    assert r.json()["details"] == "Some notes"


def test_create_card_title_too_long(client):
    r = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards",
        json={"title": "x" * 201},
    )
    assert r.status_code == 422


def test_create_card_id_is_unique(client):
    r1 = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards", json={"title": "A"}
    )
    r2 = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards", json={"title": "B"}
    )
    assert r1.json()["id"] != r2.json()["id"]


def test_create_card_with_priority(client):
    r = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards",
        json={"title": "Urgent task", "priority": "urgent"},
    )
    assert r.status_code == 201
    assert r.json()["priority"] == "urgent"


def test_create_card_with_due_date(client):
    r = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards",
        json={"title": "Deadline task", "due_date": "2026-05-01"},
    )
    assert r.status_code == 201
    assert r.json()["due_date"] == "2026-05-01"


def test_create_card_with_color_label(client):
    r = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards",
        json={"title": "Labeled task", "color_label": "red"},
    )
    assert r.status_code == 201
    assert r.json()["color_label"] == "red"


def test_create_card_invalid_priority_rejected(client):
    r = client.post(
        f"/api/boards/{client.board_id}/columns/col-backlog/cards",
        json={"title": "Task", "priority": "critical"},
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Cards — update
# ---------------------------------------------------------------------------


def test_update_card_title(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/cards/card-1",
        json={"title": "Updated title"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated title"


def test_update_card_details(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/cards/card-1",
        json={"details": "New notes"},
    )
    assert r.status_code == 200
    assert r.json()["details"] == "New notes"
    assert r.json()["title"] == "Align roadmap themes"


def test_update_card_priority(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/cards/card-1",
        json={"priority": "high"},
    )
    assert r.status_code == 200
    assert r.json()["priority"] == "high"


def test_update_card_due_date(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/cards/card-1",
        json={"due_date": "2026-06-15"},
    )
    assert r.status_code == 200
    assert r.json()["due_date"] == "2026-06-15"


def test_update_card_empty_title_rejected(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/cards/card-1",
        json={"title": "   "},
    )
    assert r.status_code == 422


def test_update_card_not_found(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/cards/card-999",
        json={"title": "X"},
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Cards — delete
# ---------------------------------------------------------------------------


def test_delete_card(client):
    r = client.delete(f"/api/boards/{client.board_id}/cards/card-1")
    assert r.status_code == 204


def test_delete_card_removes_from_board(client):
    client.delete(f"/api/boards/{client.board_id}/cards/card-1")
    r = client.get(f"/api/boards/{client.board_id}")
    all_cards = [c for col in r.json()["columns"] for c in col["cards"]]
    ids = [c["id"] for c in all_cards]
    assert "card-1" not in ids


def test_delete_card_compacts_positions(client):
    client.delete(f"/api/boards/{client.board_id}/cards/card-1")
    r = client.get(f"/api/boards/{client.board_id}")
    backlog = next(c for c in r.json()["columns"] if c["id"] == "col-backlog")
    positions = [c["position"] for c in backlog["cards"]]
    assert positions == list(range(len(positions)))


def test_delete_card_not_found(client):
    r = client.delete(f"/api/boards/{client.board_id}/cards/card-999")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Cards — move
# ---------------------------------------------------------------------------


def test_move_card_to_different_column(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/cards/card-1/move",
        json={"column_id": "col-done", "position": 0},
    )
    assert r.status_code == 200
    assert r.json()["column_id"] == "col-done"
    assert r.json()["position"] == 0


def test_move_card_compacts_source_column(client):
    client.patch(
        f"/api/boards/{client.board_id}/cards/card-1/move",
        json={"column_id": "col-done", "position": 0},
    )
    r = client.get(f"/api/boards/{client.board_id}")
    backlog = next(c for c in r.json()["columns"] if c["id"] == "col-backlog")
    positions = [c["position"] for c in backlog["cards"]]
    assert positions == list(range(len(positions)))


def test_move_card_expands_dest_column(client):
    client.patch(
        f"/api/boards/{client.board_id}/cards/card-1/move",
        json={"column_id": "col-done", "position": 0},
    )
    r = client.get(f"/api/boards/{client.board_id}")
    done = next(c for c in r.json()["columns"] if c["id"] == "col-done")
    positions = [c["position"] for c in done["cards"]]
    assert positions == list(range(len(positions)))


def test_move_card_within_same_column(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/cards/card-1/move",
        json={"column_id": "col-backlog", "position": 1},
    )
    assert r.status_code == 200
    assert r.json()["position"] == 1


def test_move_card_not_found(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/cards/card-999/move",
        json={"column_id": "col-done", "position": 0},
    )
    assert r.status_code == 404


def test_move_card_target_column_not_found(client):
    r = client.patch(
        f"/api/boards/{client.board_id}/cards/card-1/move",
        json={"column_id": "col-missing", "position": 0},
    )
    assert r.status_code == 404

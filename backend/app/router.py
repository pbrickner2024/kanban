"""
Kanban board API routes.

All routes operate on user-1's board (MVP: hardcoded user).
"""

import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app import ai as ai_module
from app.auth import login as auth_login, logout as auth_logout, require_auth
from app.database import get_db
from app.models import (
    BoardOut,
    CardOut,
    ChatIn,
    ChatOut,
    ColumnOut,
    CreateCardIn,
    LoginIn,
    LoginOut,
    MoveCardIn,
    RenameColumnIn,
    UpdateCardIn,
)

router = APIRouter(prefix="/api", tags=["board"])

HARDCODED_USER_ID = "user-1"

# Simple per-process rate limit for the AI endpoint (single-user MVP).
_ai_last_call: float = 0.0
_AI_RATE_LIMIT_SECONDS = 5.0


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _get_board_id(conn) -> str:
    row = conn.execute(
        "SELECT id FROM boards WHERE user_id = ?", (HARDCODED_USER_ID,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Board not found")
    return row["id"]


def _fetch_board() -> BoardOut:
    """Internal helper — fetches the full board without going through the route."""
    conn = get_db()
    try:
        board_id = _get_board_id(conn)
        board_row = conn.execute(
            "SELECT id, name FROM boards WHERE id = ?", (board_id,)
        ).fetchone()

        col_rows = conn.execute(
            "SELECT id, board_id, title, position, created_at FROM columns WHERE board_id = ? ORDER BY position",
            (board_id,),
        ).fetchall()

        columns = []
        for col in col_rows:
            card_rows = conn.execute(
                "SELECT id, column_id, title, details, position, created_at, updated_at FROM cards WHERE column_id = ? ORDER BY position",
                (col["id"],),
            ).fetchall()
            columns.append(
                ColumnOut(
                    **dict(col),
                    cards=[CardOut(**dict(c)) for c in card_rows],
                )
            )

        return BoardOut(id=board_row["id"], name=board_row["name"], columns=columns)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# POST /api/auth/login  (no auth required)
# ---------------------------------------------------------------------------


@router.post("/auth/login", response_model=LoginOut)
def login(body: LoginIn):
    token = auth_login(body.username, body.password)
    if not token:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return LoginOut(token=token)


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------


@router.post("/auth/logout", status_code=204)
def logout(token: str = Depends(require_auth)):
    auth_logout(token)


# ---------------------------------------------------------------------------
# GET /api/board
# ---------------------------------------------------------------------------


@router.get("/board", response_model=BoardOut)
def get_board(token: str = Depends(require_auth)):
    return _fetch_board()


# ---------------------------------------------------------------------------
# PATCH /api/board/columns/{column_id} - rename column
# ---------------------------------------------------------------------------


@router.patch("/board/columns/{column_id}", response_model=ColumnOut)
def rename_column(column_id: str, body: RenameColumnIn, token: str = Depends(require_auth)):
    if not body.title.strip():
        raise HTTPException(status_code=422, detail="Title cannot be empty")
    conn = get_db()
    try:
        board_id = _get_board_id(conn)
        row = conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?",
            (column_id, board_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Column not found")
        with conn:
            conn.execute(
                "UPDATE columns SET title = ? WHERE id = ?",
                (body.title.strip(), column_id),
            )
        col = conn.execute(
            "SELECT id, board_id, title, position, created_at FROM columns WHERE id = ?",
            (column_id,),
        ).fetchone()
        card_rows = conn.execute(
            "SELECT id, column_id, title, details, position, created_at, updated_at FROM cards WHERE column_id = ? ORDER BY position",
            (column_id,),
        ).fetchall()
        return ColumnOut(**dict(col), cards=[CardOut(**dict(c)) for c in card_rows])
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# POST /api/board/columns/{column_id}/cards - create card
# ---------------------------------------------------------------------------


@router.post("/board/columns/{column_id}/cards", response_model=CardOut, status_code=201)
def create_card(column_id: str, body: CreateCardIn, token: str = Depends(require_auth)):
    if not body.title.strip():
        raise HTTPException(status_code=422, detail="Title cannot be empty")
    conn = get_db()
    try:
        board_id = _get_board_id(conn)
        col_row = conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?",
            (column_id, board_id),
        ).fetchone()
        if not col_row:
            raise HTTPException(status_code=404, detail="Column not found")

        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?",
            (column_id,),
        ).fetchone()[0]
        position = max_pos + 1
        now = _now()
        card_id = f"card-{uuid.uuid4().hex}"

        with conn:
            conn.execute(
                "INSERT INTO cards (id, column_id, title, details, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (card_id, column_id, body.title.strip(), body.details, position, now, now),
            )
        row = conn.execute(
            "SELECT id, column_id, title, details, position, created_at, updated_at FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        return CardOut(**dict(row))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# PATCH /api/board/cards/{card_id} - update card title/details
# ---------------------------------------------------------------------------


@router.patch("/board/cards/{card_id}", response_model=CardOut)
def update_card(card_id: str, body: UpdateCardIn, token: str = Depends(require_auth)):
    conn = get_db()
    try:
        board_id = _get_board_id(conn)
        row = conn.execute(
            """
            SELECT c.id FROM cards c
            JOIN columns col ON col.id = c.column_id
            WHERE c.id = ? AND col.board_id = ?
            """,
            (card_id, board_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")

        existing = conn.execute(
            "SELECT title, details FROM cards WHERE id = ?", (card_id,)
        ).fetchone()
        new_title = body.title.strip() if body.title is not None else existing["title"]
        if body.title is not None and not new_title:
            raise HTTPException(status_code=422, detail="Title cannot be empty")
        new_details = body.details if body.details is not None else existing["details"]
        now = _now()

        with conn:
            conn.execute(
                "UPDATE cards SET title = ?, details = ?, updated_at = ? WHERE id = ?",
                (new_title, new_details, now, card_id),
            )
        updated = conn.execute(
            "SELECT id, column_id, title, details, position, created_at, updated_at FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        return CardOut(**dict(updated))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# DELETE /api/board/cards/{card_id}
# ---------------------------------------------------------------------------


@router.delete("/board/cards/{card_id}", status_code=204)
def delete_card(card_id: str, token: str = Depends(require_auth)):
    conn = get_db()
    try:
        board_id = _get_board_id(conn)
        row = conn.execute(
            """
            SELECT c.id, c.column_id, c.position FROM cards c
            JOIN columns col ON col.id = c.column_id
            WHERE c.id = ? AND col.board_id = ?
            """,
            (card_id, board_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")

        col_id = row["column_id"]
        deleted_pos = row["position"]
        with conn:
            conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
            conn.execute(
                "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
                (col_id, deleted_pos),
            )
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# PATCH /api/board/cards/{card_id}/move
# ---------------------------------------------------------------------------


@router.patch("/board/cards/{card_id}/move", response_model=CardOut)
def move_card(card_id: str, body: MoveCardIn, token: str = Depends(require_auth)):
    conn = get_db()
    try:
        board_id = _get_board_id(conn)

        card_row = conn.execute(
            """
            SELECT c.id, c.column_id, c.position FROM cards c
            JOIN columns col ON col.id = c.column_id
            WHERE c.id = ? AND col.board_id = ?
            """,
            (card_id, board_id),
        ).fetchone()
        if not card_row:
            raise HTTPException(status_code=404, detail="Card not found")

        target_col = conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?",
            (body.column_id, board_id),
        ).fetchone()
        if not target_col:
            raise HTTPException(status_code=404, detail="Target column not found")

        src_col_id = card_row["column_id"]
        src_pos = card_row["position"]
        dst_col_id = body.column_id
        dst_pos = body.position

        dst_count = conn.execute(
            "SELECT COUNT(*) FROM cards WHERE column_id = ?", (dst_col_id,)
        ).fetchone()[0]
        if src_col_id == dst_col_id:
            max_dst_pos = dst_count - 1
        else:
            max_dst_pos = dst_count
        dst_pos = max(0, min(dst_pos, max_dst_pos))

        now = _now()

        # Use BEGIN IMMEDIATE to prevent concurrent moves from producing
        # inconsistent position values.
        conn.isolation_level = None  # manual transaction control
        conn.execute("BEGIN IMMEDIATE")
        try:
            if src_col_id == dst_col_id:
                if src_pos < dst_pos:
                    conn.execute(
                        "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ? AND position <= ?",
                        (src_col_id, src_pos, dst_pos),
                    )
                elif src_pos > dst_pos:
                    conn.execute(
                        "UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ? AND position < ?",
                        (src_col_id, dst_pos, src_pos),
                    )
            else:
                conn.execute(
                    "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
                    (src_col_id, src_pos),
                )
                conn.execute(
                    "UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?",
                    (dst_col_id, dst_pos),
                )

            conn.execute(
                "UPDATE cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ?",
                (dst_col_id, dst_pos, now, card_id),
            )
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise

        updated = conn.execute(
            "SELECT id, column_id, title, details, position, created_at, updated_at FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        return CardOut(**dict(updated))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# POST /api/ai/chat - send messages to AI and get a reply
# ---------------------------------------------------------------------------


@router.post("/ai/chat", response_model=ChatOut)
def ai_chat(body: ChatIn, token: str = Depends(require_auth)):
    global _ai_last_call
    now = time.time()
    if now - _ai_last_call < _AI_RATE_LIMIT_SECONDS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests — please wait {_AI_RATE_LIMIT_SECONDS:.0f} seconds between AI calls",
        )
    _ai_last_call = now

    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    try:
        board_out = _fetch_board()
        board_json = board_out.model_dump()
        ai_result = ai_module.chat(board=board_json, messages=messages)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    validated = ChatOut.model_validate(ai_result)

    # Validate that any IDs the AI references actually exist on the board.
    if validated.kanban_update:
        valid_col_ids = {col.id for col in board_out.columns}
        valid_card_ids = {card.id for col in board_out.columns for card in col.cards}
        for op in validated.kanban_update.operations:
            if op.column_id and op.column_id not in valid_col_ids:
                raise HTTPException(
                    status_code=422,
                    detail=f"AI referenced unknown column: {op.column_id}",
                )
            if op.card_id and op.card_id not in valid_card_ids:
                raise HTTPException(
                    status_code=422,
                    detail=f"AI referenced unknown card: {op.card_id}",
                )

    return validated

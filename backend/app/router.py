import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app import ai as ai_module
from app.auth import (
    get_raw_token,
    login as auth_login,
    logout as auth_logout,
    register as auth_register,
    require_auth,
)
from app.database import get_db
from app.models import (
    BoardOut,
    BoardSummary,
    CardOut,
    ChatIn,
    ChatOut,
    ColumnOut,
    CreateBoardIn,
    CreateCardIn,
    CreateColumnIn,
    LoginIn,
    LoginOut,
    MoveCardIn,
    RegisterIn,
    RenameBoardIn,
    RenameColumnIn,
    ReorderColumnsIn,
    UpdateCardIn,
)

router = APIRouter(prefix="/api", tags=["board"])

_ai_last_call: float = 0.0
_AI_RATE_LIMIT_SECONDS = 5.0


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _get_board(conn, user_id: str, board_id: str):
    row = conn.execute(
        "SELECT id, name, created_at, updated_at FROM boards WHERE id = ? AND user_id = ?",
        (board_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Board not found")
    return row


def _fetch_board_data(board_id: str, conn=None) -> BoardOut:
    owns_conn = conn is None
    if owns_conn:
        conn = get_db()
    try:
        board_row = conn.execute(
            "SELECT id, name FROM boards WHERE id = ?", (board_id,)
        ).fetchone()
        if not board_row:
            raise HTTPException(status_code=404, detail="Board not found")

        col_rows = conn.execute(
            "SELECT id, board_id, title, position, created_at FROM columns "
            "WHERE board_id = ? ORDER BY position",
            (board_id,),
        ).fetchall()

        columns = []
        for col in col_rows:
            card_rows = conn.execute(
                "SELECT id, column_id, title, details, position, "
                "due_date, priority, color_label, created_at, updated_at "
                "FROM cards WHERE column_id = ? ORDER BY position",
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
        if owns_conn:
            conn.close()


@router.post("/auth/login", response_model=LoginOut)
def login(body: LoginIn):
    token = auth_login(body.username, body.password)
    if not token:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return LoginOut(token=token)


@router.post("/auth/logout", status_code=204)
def logout(token: str = Depends(get_raw_token)):
    auth_logout(token)


@router.post("/auth/register", status_code=201)
def register(body: RegisterIn):
    user_id = auth_register(body.username, body.password)
    if not user_id:
        raise HTTPException(status_code=409, detail="Username already taken")
    return {"user_id": user_id}


@router.get("/boards", response_model=list[BoardSummary])
def list_boards(user_id: str = Depends(require_auth)):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, name, created_at, updated_at FROM boards "
            "WHERE user_id = ? ORDER BY created_at",
            (user_id,),
        ).fetchall()
        return [BoardSummary(**dict(r)) for r in rows]
    finally:
        conn.close()


@router.post("/boards", response_model=BoardSummary, status_code=201)
def create_board(body: CreateBoardIn, user_id: str = Depends(require_auth)):
    conn = get_db()
    try:
        now = _now()
        board_id = f"board-{uuid.uuid4().hex}"
        with conn:
            conn.execute(
                "INSERT INTO boards (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (board_id, user_id, body.name.strip(), now, now),
            )
        row = conn.execute(
            "SELECT id, name, created_at, updated_at FROM boards WHERE id = ?",
            (board_id,),
        ).fetchone()
        return BoardSummary(**dict(row))
    finally:
        conn.close()


@router.get("/boards/{board_id}", response_model=BoardOut)
def get_board(board_id: str, user_id: str = Depends(require_auth)):
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)
        return _fetch_board_data(board_id, conn)
    finally:
        conn.close()


@router.patch("/boards/{board_id}", response_model=BoardSummary)
def rename_board(board_id: str, body: RenameBoardIn, user_id: str = Depends(require_auth)):
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)
        now = _now()
        with conn:
            conn.execute(
                "UPDATE boards SET name = ?, updated_at = ? WHERE id = ?",
                (body.name.strip(), now, board_id),
            )
        row = conn.execute(
            "SELECT id, name, created_at, updated_at FROM boards WHERE id = ?",
            (board_id,),
        ).fetchone()
        return BoardSummary(**dict(row))
    finally:
        conn.close()


@router.delete("/boards/{board_id}", status_code=204)
def delete_board(board_id: str, user_id: str = Depends(require_auth)):
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)
        with conn:
            col_ids = [
                r["id"]
                for r in conn.execute(
                    "SELECT id FROM columns WHERE board_id = ?", (board_id,)
                ).fetchall()
            ]
            for col_id in col_ids:
                conn.execute("DELETE FROM cards WHERE column_id = ?", (col_id,))
            conn.execute("DELETE FROM columns WHERE board_id = ?", (board_id,))
            conn.execute("DELETE FROM boards WHERE id = ?", (board_id,))
    finally:
        conn.close()


@router.post("/boards/{board_id}/columns", response_model=ColumnOut, status_code=201)
def create_column(board_id: str, body: CreateColumnIn, user_id: str = Depends(require_auth)):
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)
        now = _now()
        col_id = f"col-{uuid.uuid4().hex}"
        with conn:
            max_pos = conn.execute(
                "SELECT COALESCE(MAX(position), -1) FROM columns WHERE board_id = ?",
                (board_id,),
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO columns (id, board_id, title, position, created_at) VALUES (?, ?, ?, ?, ?)",
                (col_id, board_id, body.title.strip(), max_pos + 1, now),
            )
        col = conn.execute(
            "SELECT id, board_id, title, position, created_at FROM columns WHERE id = ?",
            (col_id,),
        ).fetchone()
        return ColumnOut(**dict(col), cards=[])
    finally:
        conn.close()


@router.patch("/boards/{board_id}/columns/reorder", status_code=204)
def reorder_columns(board_id: str, body: ReorderColumnsIn, user_id: str = Depends(require_auth)):
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)
        existing_ids = {
            r["id"]
            for r in conn.execute(
                "SELECT id FROM columns WHERE board_id = ?", (board_id,)
            ).fetchall()
        }
        for col_id in body.column_ids:
            if col_id not in existing_ids:
                raise HTTPException(
                    status_code=422, detail=f"Unknown column: {col_id}"
                )
        with conn:
            for pos, col_id in enumerate(body.column_ids):
                conn.execute(
                    "UPDATE columns SET position = ? WHERE id = ? AND board_id = ?",
                    (pos, col_id, board_id),
                )
    finally:
        conn.close()


@router.patch("/boards/{board_id}/columns/{column_id}", response_model=ColumnOut)
def rename_column(
    board_id: str,
    column_id: str,
    body: RenameColumnIn,
    user_id: str = Depends(require_auth),
):
    if not body.title.strip():
        raise HTTPException(status_code=422, detail="Title cannot be empty")
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)
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
            "SELECT id, column_id, title, details, position, "
            "due_date, priority, color_label, created_at, updated_at "
            "FROM cards WHERE column_id = ? ORDER BY position",
            (column_id,),
        ).fetchall()
        return ColumnOut(**dict(col), cards=[CardOut(**dict(c)) for c in card_rows])
    finally:
        conn.close()


@router.delete("/boards/{board_id}/columns/{column_id}", status_code=204)
def delete_column(
    board_id: str,
    column_id: str,
    user_id: str = Depends(require_auth),
):
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)
        row = conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?",
            (column_id, board_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Column not found")
        with conn:
            conn.execute("DELETE FROM cards WHERE column_id = ?", (column_id,))
            conn.execute("DELETE FROM columns WHERE id = ?", (column_id,))
            remaining = conn.execute(
                "SELECT id FROM columns WHERE board_id = ? ORDER BY position",
                (board_id,),
            ).fetchall()
            for pos, r in enumerate(remaining):
                conn.execute(
                    "UPDATE columns SET position = ? WHERE id = ?", (pos, r["id"])
                )
    finally:
        conn.close()


@router.post(
    "/boards/{board_id}/columns/{column_id}/cards",
    response_model=CardOut,
    status_code=201,
)
def create_card(
    board_id: str,
    column_id: str,
    body: CreateCardIn,
    user_id: str = Depends(require_auth),
):
    if not body.title.strip():
        raise HTTPException(status_code=422, detail="Title cannot be empty")
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)
        col_row = conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?",
            (column_id, board_id),
        ).fetchone()
        if not col_row:
            raise HTTPException(status_code=404, detail="Column not found")

        now = _now()
        card_id = f"card-{uuid.uuid4().hex}"

        with conn:
            max_pos = conn.execute(
                "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?",
                (column_id,),
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO cards (id, column_id, title, details, position, "
                "due_date, priority, color_label, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    card_id, column_id, body.title.strip(), body.details,
                    max_pos + 1, body.due_date, body.priority, body.color_label,
                    now, now,
                ),
            )

        row = conn.execute(
            "SELECT id, column_id, title, details, position, "
            "due_date, priority, color_label, created_at, updated_at "
            "FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        return CardOut(**dict(row))
    finally:
        conn.close()


@router.patch("/boards/{board_id}/cards/{card_id}", response_model=CardOut)
def update_card(
    board_id: str,
    card_id: str,
    body: UpdateCardIn,
    user_id: str = Depends(require_auth),
):
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)
        row = conn.execute(
            "SELECT c.id FROM cards c "
            "JOIN columns col ON col.id = c.column_id "
            "WHERE c.id = ? AND col.board_id = ?",
            (card_id, board_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")

        existing = conn.execute(
            "SELECT title, details, due_date, priority, color_label FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()

        fields = {k: existing[k] for k in ("title", "details", "due_date", "priority", "color_label")}
        for key in fields:
            val = getattr(body, key)
            if val is not None:
                fields[key] = val.strip() if key == "title" else val
        if body.title is not None and not fields["title"]:
            raise HTTPException(status_code=422, detail="Title cannot be empty")
        now = _now()

        with conn:
            conn.execute(
                "UPDATE cards SET title = ?, details = ?, due_date = ?, "
                "priority = ?, color_label = ?, updated_at = ? WHERE id = ?",
                (fields["title"], fields["details"], fields["due_date"],
                 fields["priority"], fields["color_label"], now, card_id),
            )
        updated = conn.execute(
            "SELECT id, column_id, title, details, position, "
            "due_date, priority, color_label, created_at, updated_at "
            "FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        return CardOut(**dict(updated))
    finally:
        conn.close()


@router.delete("/boards/{board_id}/cards/{card_id}", status_code=204)
def delete_card(board_id: str, card_id: str, user_id: str = Depends(require_auth)):
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)
        row = conn.execute(
            "SELECT c.id, c.column_id, c.position FROM cards c "
            "JOIN columns col ON col.id = c.column_id "
            "WHERE c.id = ? AND col.board_id = ?",
            (card_id, board_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")

        col_id = row["column_id"]
        deleted_pos = row["position"]
        with conn:
            conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
            conn.execute(
                "UPDATE cards SET position = position - 1 "
                "WHERE column_id = ? AND position > ?",
                (col_id, deleted_pos),
            )
    finally:
        conn.close()


@router.patch("/boards/{board_id}/cards/{card_id}/move", response_model=CardOut)
def move_card(
    board_id: str,
    card_id: str,
    body: MoveCardIn,
    user_id: str = Depends(require_auth),
):
    conn = get_db()
    try:
        _get_board(conn, user_id, board_id)

        card_row = conn.execute(
            "SELECT c.id, c.column_id, c.position FROM cards c "
            "JOIN columns col ON col.id = c.column_id "
            "WHERE c.id = ? AND col.board_id = ?",
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
        max_dst_pos = dst_count - 1 if src_col_id == dst_col_id else dst_count
        dst_pos = max(0, min(dst_pos, max_dst_pos))

        now = _now()
        conn.isolation_level = None
        conn.execute("BEGIN IMMEDIATE")
        try:
            if src_col_id == dst_col_id:
                if src_pos < dst_pos:
                    conn.execute(
                        "UPDATE cards SET position = position - 1 "
                        "WHERE column_id = ? AND position > ? AND position <= ?",
                        (src_col_id, src_pos, dst_pos),
                    )
                elif src_pos > dst_pos:
                    conn.execute(
                        "UPDATE cards SET position = position + 1 "
                        "WHERE column_id = ? AND position >= ? AND position < ?",
                        (src_col_id, dst_pos, src_pos),
                    )
            else:
                conn.execute(
                    "UPDATE cards SET position = position - 1 "
                    "WHERE column_id = ? AND position > ?",
                    (src_col_id, src_pos),
                )
                conn.execute(
                    "UPDATE cards SET position = position + 1 "
                    "WHERE column_id = ? AND position >= ?",
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
            "SELECT id, column_id, title, details, position, "
            "due_date, priority, color_label, created_at, updated_at "
            "FROM cards WHERE id = ?",
            (card_id,),
        ).fetchone()
        return CardOut(**dict(updated))
    finally:
        conn.close()


@router.post("/ai/chat", response_model=ChatOut)
def ai_chat(body: ChatIn, user_id: str = Depends(require_auth)):
    global _ai_last_call
    now = time.time()
    if now - _ai_last_call < _AI_RATE_LIMIT_SECONDS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests — please wait {_AI_RATE_LIMIT_SECONDS:.0f} seconds between AI calls",
        )
    _ai_last_call = now

    conn = get_db()
    try:
        _get_board(conn, user_id, body.board_id)
    finally:
        conn.close()

    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    try:
        board_out = _fetch_board_data(body.board_id)
        board_json = board_out.model_dump()
        ai_result = ai_module.chat(board=board_json, messages=messages)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    validated = ChatOut.model_validate(ai_result)

    if validated.kanban_update:
        valid_col_ids = {col.id for col in board_out.columns}
        valid_card_ids = {card.id for col in board_out.columns for card in col.cards}
        for op in validated.kanban_update.operations:
            if op.column_id and op.column_id not in valid_col_ids:
                raise HTTPException(
                    status_code=422,
                    detail=f"AI referenced unknown column: {op.column_id}",
                )
            if op.action != "create_card" and op.card_id and op.card_id not in valid_card_ids:
                raise HTTPException(
                    status_code=422,
                    detail=f"AI referenced unknown card: {op.card_id}",
                )

    return validated

"""
Database initialisation and connection helper.

On first call to get_db(), the database file is created and tables are
initialised.  The hardcoded MVP user, board and default columns are seeded
if they do not already exist.  _apply_migrations() handles additive schema
changes for existing databases.
"""

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_DB_PATH = Path(Path(__file__).parent.parent, "pm.db")
DB_PATH = Path(os.environ.get("PM_DB_PATH", str(DEFAULT_DB_PATH)))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_db() -> sqlite3.Connection:
    """Return a SQLite connection with row_factory and FK support."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r["name"] == column for r in rows)


def _apply_migrations(conn: sqlite3.Connection) -> None:
    """Add new columns to existing tables without losing data."""
    import bcrypt

    # users: password_hash
    if not _column_exists(conn, "users", "password_hash"):
        conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
        hashed = bcrypt.hashpw(b"password", bcrypt.gensalt()).decode()
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = 'user-1' AND password_hash = ''",
            (hashed,),
        )

    # boards: remove UNIQUE constraint on user_id if it exists
    _migrate_boards_remove_unique(conn)

    # cards: new optional metadata columns
    for col in ("due_date", "priority", "color_label"):
        if not _column_exists(conn, "cards", col):
            conn.execute(f"ALTER TABLE cards ADD COLUMN {col} TEXT")


def _migrate_boards_remove_unique(conn: sqlite3.Connection) -> None:
    """Recreate the boards table without the UNIQUE constraint on user_id."""
    indexes = conn.execute("PRAGMA index_list(boards)").fetchall()
    for idx in indexes:
        if idx["unique"] == 1:
            idx_cols = conn.execute(f"PRAGMA index_info({idx['name']})").fetchall()
            if any(c["name"] == "user_id" for c in idx_cols):
                # Disable FK enforcement so we can swap the table safely
                conn.execute("PRAGMA foreign_keys = OFF")
                try:
                    conn.execute("""
                        CREATE TABLE IF NOT EXISTS boards_new (
                            id         TEXT PRIMARY KEY,
                            user_id    TEXT NOT NULL,
                            name       TEXT NOT NULL,
                            created_at TEXT NOT NULL,
                            updated_at TEXT NOT NULL,
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        )
                    """)
                    conn.execute("INSERT OR IGNORE INTO boards_new SELECT * FROM boards")
                    conn.execute("DROP TABLE boards")
                    conn.execute("ALTER TABLE boards_new RENAME TO boards")
                    conn.execute(
                        "CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id)"
                    )
                finally:
                    conn.execute("PRAGMA foreign_keys = ON")
                return


def init_db() -> None:
    """Create tables and seed initial data if not already present."""
    conn = get_db()
    with conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                username      TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL DEFAULT '',
                created_at    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS boards (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                name       TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS columns (
                id         TEXT PRIMARY KEY,
                board_id   TEXT NOT NULL,
                title      TEXT NOT NULL,
                position   INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (board_id) REFERENCES boards(id)
            );

            CREATE TABLE IF NOT EXISTS cards (
                id          TEXT PRIMARY KEY,
                column_id   TEXT NOT NULL,
                title       TEXT NOT NULL,
                details     TEXT,
                position    INTEGER NOT NULL,
                due_date    TEXT,
                priority    TEXT,
                color_label TEXT,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                FOREIGN KEY (column_id) REFERENCES columns(id)
            );

            CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
            CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id);
            CREATE INDEX IF NOT EXISTS idx_cards_column_id ON cards(column_id);
        """)
        _apply_migrations(conn)
        _seed(conn)
    conn.close()


def _seed(conn: sqlite3.Connection) -> None:
    """Insert the hardcoded MVP user, board, and default columns/cards if absent."""
    import bcrypt

    now = _now()

    existing = conn.execute("SELECT id FROM users WHERE id = 'user-1'").fetchone()
    if not existing:
        hashed = bcrypt.hashpw(b"password", bcrypt.gensalt()).decode()
        conn.execute(
            "INSERT OR IGNORE INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            ("user-1", "user", hashed, now),
        )

    conn.execute(
        "INSERT OR IGNORE INTO boards (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        ("board-1", "user-1", "My Kanban", now, now),
    )

    default_columns = [
        ("col-backlog", "Backlog", 0),
        ("col-discovery", "Discovery", 1),
        ("col-progress", "In Progress", 2),
        ("col-review", "Review", 3),
        ("col-done", "Done", 4),
    ]
    for col_id, title, pos in default_columns:
        conn.execute(
            "INSERT OR IGNORE INTO columns (id, board_id, title, position, created_at) VALUES (?, ?, ?, ?, ?)",
            (col_id, "board-1", title, pos, now),
        )

    default_cards = [
        ("card-1", "col-backlog", "Align roadmap themes", "Draft quarterly themes with impact statements and metrics.", 0),
        ("card-2", "col-backlog", "Gather customer signals", "Review support tags, sales notes, and churn feedback.", 1),
        ("card-3", "col-discovery", "Prototype analytics view", "Sketch initial dashboard layout and key drill-downs.", 0),
        ("card-4", "col-progress", "Refine status language", "Standardize column labels and tone across the board.", 0),
        ("card-5", "col-progress", "Design card layout", "Add hierarchy and spacing for scanning dense lists.", 1),
        ("card-6", "col-review", "QA micro-interactions", "Verify hover, focus, and loading states.", 0),
        ("card-7", "col-done", "Set up project repo", "Initial Kanban structure and tooling in place.", 0),
        ("card-8", "col-done", "Define MVP scope", "Locked list of features for the first release.", 1),
    ]
    for card_id, col_id, title, details, pos in default_cards:
        conn.execute(
            "INSERT OR IGNORE INTO cards (id, column_id, title, details, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (card_id, col_id, title, details, pos, now, now),
        )

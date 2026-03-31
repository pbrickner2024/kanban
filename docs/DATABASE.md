# Database Approach for PM MVP

## Overview

The MVP uses **SQLite** for persistence, with a **normalized relational schema**. This provides clarity, flexibility, and a foundation for future scaling.

## Why SQLite?

- Local file-based database (no external dependencies)
- Zero configuration required; database created on first run
- Sufficient for MVP (single Docker container, small data volumes)
- Can migrate to PostgreSQL later if needed

## Schema Design

See [schema.json](./schema.json) for the complete schema definition.

### Tables

#### `users`
Stores user accounts. For MVP, a single hardcoded user ("user") is created on first run.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);
```

#### `boards`
One board per user during MVP. The `user_id` is UNIQUE to enforce this constraint.

```sql
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `columns`
Represents columns in a board (e.g., "Backlog", "In Progress", "Done"). Position-ordered for drag-and-drop.

```sql
CREATE TABLE columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (board_id) REFERENCES boards(id)
);
```

#### `cards`
Represents cards within columns. Position-ordered for drag-drop reordering.

```sql
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  column_id TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (column_id) REFERENCES columns(id)
);
```

## API Mapping

Part 6 will implement these endpoints:

- `GET /api/board` — fetch user's board (columns + cards)
- `PUT /api/board` — update board name
- `PATCH /api/board/columns/{id}` — rename column
- `POST /api/board/columns/{id}/cards` — create card
- `PATCH /api/board/cards/{id}` — update card (title, details)
- `DELETE /api/board/cards/{id}` — delete card
- `PATCH /api/board/cards/{id}/move` — move card to another column (updates `column_id` + `position`)

## ID Strategy

IDs are **semantic strings** (e.g., `card-1`, `col-backlog`, `board-1`):
- Human-readable in logs and debugging
- Easy to correlate with frontend code
- Can migrate to UUIDs later if needed

## Timestamps

All timestamps are **ISO 8601 strings** (UTC):
- `2026-03-29T22:30:45Z`
- Backend always uses UTC; frontend converts for display
- Enables audit trails and activity logging

## Normalization & Flexibility

The schema is **fully normalized**:
- No JSON fields in MVP (keep it simple)
- Atomic updates for clarity
- Clear foreign keys and constraints
- Easy to query and reason about

**Future extensions** (noted in schema.json):
- Add `messages` table for AI chat conversation history (can store as JSON array in a log column)
- Add `activity_log` table for undo/redo and audit trails
- Add `tags` table for card categorization
- Remove UNIQUE constraint on `boards.user_id` to support multi-board users

## Migration & Initialization

**On first backend startup:**
1. Check if database file exists
2. If not, create it and run initialization SQL:
   - Create all tables
   - Insert hardcoded user ("user", "user-1")
   - Create default board ("board-1", 5 columns with sample cards)
3. If exists, run any pending migrations

This ensures the backend is stateless and the database is self-healing.

## Future: AI Chat Integration (Part 8+)

When the AI chat is added:
- Add `messages` table or JSON log in `boards.metadata`
- Store conversation history and AI decisions
- Link AI updates to specific cards (audit trail)

## Sign-Off Checklist

- [ ] Schema is clear and unambiguous
- [ ] Normalization approach is appropriate for MVP
- [ ] ID strategy works for you
- [ ] API mapping is sufficient
- [ ] Any changes needed before proceeding to Part 6 (Backend)?

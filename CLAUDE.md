# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Project Management MVP — a Kanban board web app with an AI chat sidebar. Single hardcoded user (`user`/`password`). One board per user. Runs locally in Docker.

## Commands

### Running the app (Docker)

```bash
# Windows
./scripts/start-windows.ps1
./scripts/stop-windows.ps1

# Mac / Linux
./scripts/start-mac.sh   # or start-linux.sh
./scripts/stop-mac.sh
```

The app runs at `http://localhost:8000`. FastAPI serves the static Next.js export at `/` and the API at `/api/`.

### Frontend development (hot reload, port 3000)

```bash
cd frontend
npm install
npm run dev          # dev server; API calls go to localhost:8000
npm run build        # static export → out/
npm run test:unit    # Vitest unit tests
npm run test:e2e     # Playwright e2e tests (requires running app)
npm run test:all     # both
```

### Backend tests

```bash
cd backend
uv run pytest                        # all tests
uv run pytest tests/test_router.py   # single file
```

### Docker build only

```bash
docker compose build
docker compose up
```

## Architecture

The Dockerfile is a two-stage build: Node builds the Next.js static export (`frontend/out/`), then Python copies it into a `static/` directory served by FastAPI's `StaticFiles` mount. API routes (`/api/...`) take priority over the static mount.

### Backend (`backend/app/`)

- `main.py` — FastAPI app setup: CORS, `init_db()` call, router mount, static file serving
- `database.py` — SQLite connection via `get_db()`; `init_db()` creates tables and seeds the hardcoded user + default board on first run
- `models.py` — Pydantic models for all request/response shapes
- `router.py` — All `/api/` endpoints; all routes hardcoded to `user-1`
- `ai.py` — OpenRouter client (OpenAI-compatible SDK); sends full board JSON + conversation history; expects structured JSON back with `reply` and optional `kanban_update.operations`

### Frontend (`frontend/src/`)

- `app/` — Next.js app directory (layout, page, globals.css)
- `components/` — Kanban UI: `KanbanBoard.tsx` orchestrates drag-drop (DnD Kit), `KanbanColumn.tsx`, `KanbanCard.tsx`, `AiSidebar.tsx` for chat, `LoginPage.tsx` for auth, `AuthContext.tsx` for login state
- `lib/` — Data types, board utilities
- `tests/` — Playwright e2e tests

### Database (SQLite, `backend/pm.db`)

Four tables: `users`, `boards`, `columns`, `cards`. All IDs are semantic strings (`card-1`, `col-backlog`). Positions are integers (0-based) maintained on every insert/delete/move. See `docs/DATABASE.md` for full schema.

### AI Integration

`POST /api/ai/chat` — accepts `{messages: [{role, content}]}`, fetches the live board, sends both to OpenRouter (`openai/gpt-oss-120b`), parses structured JSON response, and optionally applies `kanban_update.operations` to the board. Requires `OPENROUTER_API_KEY` in `.env` at project root.

## Coding Standards

- No over-engineering. No defensive programming beyond what's needed. No extra features.
- No emojis. Keep READMEs minimal.
- When hitting issues, identify root cause before fixing — prove with evidence.
- Use latest library versions and idiomatic patterns.

## Color Scheme (CSS variables in `globals.css`)

- `--accent-yellow: #ecad0a`
- `--primary-blue: #209dd7`
- `--secondary-purple: #753991`
- `--navy-dark: #032147`
- `--gray-text: #888888`

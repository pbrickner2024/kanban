# Code Review

## Scope

Reviewed the current repository against the MVP requirements in `docs/PLAN.md` and the root `AGENTS.md`, with extra attention on persistence, auth, board operations, AI flows, Docker/runtime behavior, and test reliability.

## Findings

1. `docker-compose.yml:1-10`, `backend/app/database.py:13`, `scripts/stop-linux.sh:1-8`, `scripts/stop-mac.sh:1-8`, and `scripts/stop-windows.ps1:1-5` create guaranteed data loss for the SQLite board state. The database lives at `/app/pm.db` inside the container, but the compose service has no volume mount. The stop scripts run `docker compose down`, so every container removal recreates the database from seed data instead of preserving the user's Kanban board. This breaks the requirement that the app be a persistent local board.
2. `frontend/playwright.config.ts:10-16` and `frontend/next.config.ts:8-14` make the E2E suite non-reproducible in a clean environment. Playwright only starts the Next dev server on port `3000`, while all `/api/*` traffic is proxied to `http://localhost:8000`. Because the FastAPI backend is never started by the test harness, login and AI requests fail with `ECONNREFUSED`, so the suite cannot validate the integrated MVP end to end.
3. `backend/app/router.py:172-184` calculates the next card position before entering the write transaction. Two concurrent `POST /api/board/columns/{id}/cards` requests can both read the same `MAX(position)` and insert duplicate positions into one column. That will corrupt ordering and can produce unstable drag-and-drop behavior.
4. `backend/app/router.py:386-400` rejects any AI operation whose `card_id` is not already on the board, including `create_card`. If the model includes a synthetic `card_id` while creating a new card, the backend returns `422` instead of accepting the valid create request. This makes the AI contract stricter than the documented operation semantics.
5. `frontend/src/components/KanbanBoard.tsx:170-195` can leave the UI out of sync after a partially successful AI update batch. `applyKanbanOperations` executes operations sequentially against the backend, but the board is only refetched after the full batch succeeds. If operation 1 succeeds and operation 2 fails, the catch block only adds an error message and never refetches, so the server state changes while the client still shows the old board.
6. `frontend/tests/kanban.spec.ts:3-21` is stale relative to the authentication flow introduced in Part 4. The tests go straight to `/` and expect the board to be visible without signing in first, which contradicts the app behavior described in `docs/PLAN.md`. Even with the backend running, these board tests will fail until they perform login or seed an authenticated session.
7. `frontend/eslint.config.mjs:7-15`, `frontend/.gitignore:1-33`, and the tracked `frontend/playwright-report/**`, `frontend/test-results/.last-run.json`, and `frontend/test-output.txt` artifacts make the lint step noisy and unreliable. `npm run lint` currently traverses generated Playwright output and reports thousands of warnings and many errors unrelated to source files, which weakens lint as a useful engineering gate.
8. `backend/app/ai.py:61-74` flattens the entire conversation history and board state into one JSON string inside a single `user` message. That throws away the native role structure the chat API is designed to use and makes multi-turn context handling more brittle than necessary, especially for longer AI conversations.

## Checks Run

- `backend: uv run pytest` — passed (`45 passed`).
- `frontend: npm run test:unit` — passed (`47 passed`), but `src/components/KanbanBoard.test.tsx` emitted React `act(...)` warnings during async state updates.
- `frontend: npm run test:e2e` — failed. Primary causes observed were missing backend startup (`ECONNREFUSED` to `localhost:8000`) and stale auth assumptions in `frontend/tests/kanban.spec.ts`.
- `frontend: npm run lint` — failed. Source-file issues exist, but the result is dominated by generated Playwright report artifacts being linted.

## Conclusion

The project is in decent shape at the unit-test and backend-route level, but it still has several release-blocking issues around persistence and full-stack verification. The most important fixes are to preserve the SQLite file across container restarts, make the E2E environment start both frontend and backend, and harden the AI/card update paths so they cannot corrupt or desynchronize board state.

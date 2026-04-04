# Code Review

## Backend

### `backend/app/auth.py`

**[Low] No token expiry.**
Tokens live in `_tokens` (an in-memory set) indefinitely until the user calls logout. A stolen or leaked token is valid forever within a process lifetime. For an MVP this is acceptable, but worth noting if the app is ever exposed outside localhost.

**[Low] Plain `==` for password comparison.**
`auth.py:23` compares the password with `==`, which is vulnerable to timing attacks. `secrets.compare_digest` is the correct primitive here even for a hardcoded credential. Trivial fix.

---

### `backend/app/ai.py`

**[Medium] Fragile JSON extraction from AI response.**
`_extract_json` (`ai.py:44-55`) strips backticks with `candidate.strip("``")`, which removes *all* leading/trailing backtick characters, not just a fenced-code-block wrapper. It then calls `.replace("json", "", 1)` on the result to remove a language hint. If the AI's JSON content happened to start with backticks (unlikely but possible), this would silently corrupt it. A more robust approach is a regex that matches the full fenced-block pattern ```` ```json ... ``` ```` rather than stripping character-by-character.

**[Low] Entire conversation history sent as a single user message.**
`ai.py:61-75` packages the board and all conversation turns into one JSON blob and sends it as a single `user` message. The OpenAI chat API is designed for multi-turn conversations with alternating `user`/`assistant` roles. Flattening everything into one message works but loses the native turn structure, which can degrade model behaviour on longer conversations.

---

### `backend/app/router.py`

**[Medium] `create_card` reads `MAX(position)` outside the write transaction.**
`router.py:179-188`: the code reads the current max position, then opens `BEGIN IMMEDIATE`. Between the read and the lock, another request can observe the same max and assign the same slot. The fix is to move the `SELECT COALESCE(MAX(position), -1)` inside the `BEGIN IMMEDIATE` block.

**[Medium] AI `create_card` validation rejects a synthetic `card_id`.**
`router.py:404`: `if op.action != "create_card"` was added to skip card-ID validation for new cards, which is correct. However, if the AI *does* supply a `card_id` on a `create_card` operation, it will pass this check and the ID won't be validated — the card will be created with whatever ID the AI chose. The backend `create_card` route ignores the provided ID and generates its own (`uuid4`), so the mismatch is harmless today, but it is confusing. The cleaner fix is to strip `card_id` from `create_card` operations before passing them to the frontend.

**[Low] `_now()` duplicated.**
`router.py:39-40` re-defines the same `_now()` helper that already exists in `database.py:18-19`. A shared `utils.py` would remove the duplication, but it's trivial in a codebase this size.

---

### `backend/tests/`

**[High] Near-zero API test coverage.**
`test_api.py` contains only a health-check test. The board CRUD routes, auth flow, card-move logic, and AI endpoint have no direct coverage. `test_board.py` and `test_ai.py` exist but should be audited to confirm they exercise the actual HTTP layer rather than internal helpers only.

---

## Frontend

### `frontend/src/lib/kanban.ts`

**[Medium] `initialData` has stale content that diverges from the DB seed.**
`kanban.ts:18-72` exports an `initialData` object whose card titles (`"Ship marketing page"`, `"Close onboarding sprint"`) no longer match the seed data in `database.py` (`"Set up project repo"`, `"Define MVP scope"`). The object is never referenced anywhere in the app — it is dead code. It should be deleted to avoid future confusion.

**[Low] `createId` is exported but never imported.**
`kanban.ts:164-168` exports a `createId` helper that no module uses. Dead code.

---

### `frontend/src/components/KanbanBoard.tsx`

**[Medium] Silent failures on card create and update.**
`handleAddCard` (`KanbanBoard.tsx:98-117`) and `handleUpdateCard` (`KanbanBoard.tsx:119-136`) catch errors with `console.error` only. If either API call fails, the user gets no feedback — the UI either shows the card (optimistic) or silently does nothing. At minimum, a brief error message should be surfaced.

**[Medium] Partial AI operation batch leaves UI stale on error.**
`KanbanBoard.tsx:171-195`: `applyKanbanOperations` runs operations sequentially; if operation N fails, the `catch` block logs an error and appends a chat message, but `refetch()` is only called in the `finally` of the operations block — which is inside a `try` that catches the error and continues to `setAiLoading(false)`. Tracing the control flow: the `finally` on line 183 runs regardless, so `refetch` *is* called. However, if `applyKanbanOperations` itself throws (unexpected), the outer `catch` on line 187 will suppress it and `refetch` will not run, leaving the UI showing partial state. Wrapping the whole block in a `finally` that always calls `refetch` would be safer.

**[Low] `refetch` is a new function reference on every render.**
`KanbanBoard.tsx:32-45` defines `refetch` as an inline arrow function. It is used in `useEffect` (with an eslint-disable comment) and passed to `.catch(refetch)` in several places. Wrapping it in `useCallback` would clean up the eslint suppression and make the dependency relationship explicit.

---

### `frontend/src/components/AiSidebar.tsx`

**[Low] `lastAppliedCount` status text persists indefinitely.**
After an AI update, the sidebar shows `"Applied N board updates."` as the status text. This banner stays until the *next* AI message is sent (`setLastAppliedCount(0)` is called at the start of each send). For a short-lived confirmation this is harmless, but a timed auto-clear (e.g., after 5 s) would feel more polished.

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 1     |
| Medium   | 6     |
| Low      | 6     |

The most important items to address are the lack of API test coverage, silent UI failures on card operations, the `MAX(position)` race in `create_card`, and the stale `initialData` dead code. The auth and AI issues are real but tolerable for a local single-user MVP.

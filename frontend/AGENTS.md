# Frontend Folder

This folder contains the Next.js React frontend for the Project Management MVP.

## Current scope (Part 3 and beyond)

The frontend is built as a static export and served by the FastAPI backend.

### Source structure

- `src/app/`: Next.js app directory (layout.tsx, page.tsx, globals.css)
- `src/components/`: React components
  - `KanbanBoard.tsx`: Main board component with drag-drop orchestration (DnD Kit)
  - `KanbanColumn.tsx`: Individual column component
  - `KanbanCard.tsx`: Card display component
  - `KanbanCardPreview.tsx`: Drag overlay preview
  - `NewCardForm.tsx`: Form to add new cards
- `src/lib/`: Utilities and types
  - `kanban.ts`: Data structures (Card, Column, BoardData), initial data, and card movement logic
- `src/test/`: Test utilities (Vitest setup, jsdom config)
- `tests/`: E2E tests (Playwright)

### Build and test

- `npm run dev` — local dev server on port 3000 (watches frontend only; calls API at localhost:8000)
- `npm run build` — produces static HTML/CSS/JS in `out/` directory
- `npm run test:unit` — run Vitest unit tests (components, utils)
- `npm run test:e2e` — run Playwright integration tests
- `npm run test:all` — run both test suites

### Key libraries

- **Next.js 16** — React framework with static export support
- **React 19** — UI rendering
- **@dnd-kit** — drag-and-drop for Kanban cards
- **Tailwind 4** — CSS styling with custom CSS variables
- **Vitest** — unit testing
- **Playwright** — E2E testing

### Styling

Color scheme (custom CSS variables in globals.css):
- Accent Yellow: `--accent-yellow: #ecad0a`
- Blue Primary: `--primary-blue: #209dd7`
- Purple Secondary: `--secondary-purple: #753991`
- Navy Dark: `--navy-dark: #032147`
- Gray Text: `--gray-text: #888888`

### Notes

- During Part 2, the frontend was a pure demo without backend integration.
- Part 3 integrated the frontend into the Docker build; `npm run build` now runs inside the backend Dockerfile and its output is served by FastAPI at `/`.
- The frontend and backend are decoupled during local development: `npm run dev` opens port 3000, but calls the backend API at port 8000.

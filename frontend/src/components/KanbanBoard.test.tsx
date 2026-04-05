import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { AuthProvider } from "@/components/AuthContext";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const BOARD_ID = "board-1";

const mockBoardList = [
  { id: BOARD_ID, name: "My Kanban", created_at: "2026-01-01T00:00:00+00:00", updated_at: "2026-01-01T00:00:00+00:00" },
];

const mockBoard = {
  id: BOARD_ID,
  name: "My Kanban",
  columns: [
    {
      id: "col-backlog",
      title: "Backlog",
      position: 0,
      board_id: BOARD_ID,
      created_at: "2026-01-01T00:00:00+00:00",
      cards: [
        {
          id: "card-1",
          column_id: "col-backlog",
          title: "Align roadmap themes",
          details: "Details 1",
          position: 0,
          due_date: null,
          priority: null,
          color_label: null,
          created_at: "2026-01-01T00:00:00+00:00",
          updated_at: "2026-01-01T00:00:00+00:00",
        },
        {
          id: "card-2",
          column_id: "col-backlog",
          title: "Gather customer signals",
          details: "Details 2",
          position: 1,
          due_date: null,
          priority: null,
          color_label: null,
          created_at: "2026-01-01T00:00:00+00:00",
          updated_at: "2026-01-01T00:00:00+00:00",
        },
      ],
    },
    { id: "col-discovery", title: "Discovery", position: 1, board_id: BOARD_ID, created_at: "2026-01-01T00:00:00+00:00", cards: [] },
    { id: "col-progress", title: "In Progress", position: 2, board_id: BOARD_ID, created_at: "2026-01-01T00:00:00+00:00", cards: [] },
    { id: "col-review", title: "Review", position: 3, board_id: BOARD_ID, created_at: "2026-01-01T00:00:00+00:00", cards: [] },
    { id: "col-done", title: "Done", position: 4, board_id: BOARD_ID, created_at: "2026-01-01T00:00:00+00:00", cards: [] },
  ],
};

function makeFetchMock(overrides?: (url: string, opts?: RequestInit) => Response | null) {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    const method = opts?.method ?? "GET";

    // Allow test-specific overrides
    if (overrides) {
      const result = overrides(url, opts);
      if (result !== null) return Promise.resolve(result);
    }

    if (url.includes("/api/ai/chat") && method === "POST") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            reply: "Done. I renamed the column.",
            kanban_update: {
              operations: [
                { action: "rename_column", column_id: "col-backlog", title: "Ideas" },
              ],
            },
          }),
      });
    }
    // Board list
    if (url === "/api/boards" && method === "GET") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBoardList) });
    }
    // Full board
    if (url.includes(`/api/boards/${BOARD_ID}`) && method === "GET") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBoard) });
    }
    // Card creation
    if (method === "POST" && url.includes("/cards")) {
      const body = JSON.parse(opts!.body as string);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "card-new",
            title: body.title,
            details: body.details,
            due_date: null,
            priority: null,
            color_label: null,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", makeFetchMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderBoard = () =>
  render(
    <AuthProvider>
      <KanbanBoard />
    </AuthProvider>
  );

describe("KanbanBoard", () => {
  it("renders five columns after load", async () => {
    renderBoard();
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("shows loading state before board arrives", async () => {
    const pendingBoard = createDeferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        const method = opts?.method ?? "GET";
        if (url === "/api/boards" && method === "GET") {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBoardList) });
        }
        if (method === "GET") {
          return pendingBoard.promise;
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      })
    );

    renderBoard();
    // Boards list loads first, then board data is pending → "Loading board..."
    await waitFor(() => {
      expect(screen.getByText(/loading board/i)).toBeInTheDocument();
    });
  });

  it("renames a column via local input state", async () => {
    renderBoard();
    const column = (await screen.findAllByTestId(/column-/i))[0];
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("calls rename API on column title blur", async () => {
    renderBoard();
    const column = (await screen.findAllByTestId(/column-/i))[0];
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed");
    await userEvent.tab();
    await waitFor(() => {
      const calls = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls;
      expect(
        calls.some(
          ([url, opts]) =>
            String(url).includes(`boards/${BOARD_ID}/columns/col-backlog`) &&
            (opts as RequestInit)?.method === "PATCH"
        )
      ).toBe(true);
    });
  });

  it("adds a card via API and shows it", async () => {
    renderBoard();
    const column = (await screen.findAllByTestId(/column-/i))[0];
    const addButton = within(column).getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(await within(column).findByText("New card")).toBeInTheDocument();
  });

  it("removes a card optimistically", async () => {
    renderBoard();
    const column = (await screen.findAllByTestId(/column-/i))[0];
    await screen.findByText("Align roadmap themes");

    const deleteButton = within(column).getByRole("button", {
      name: /delete align roadmap themes/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("Align roadmap themes")).not.toBeInTheDocument();
  });

  it("edits a card title and saves via API", async () => {
    renderBoard();
    const column = (await screen.findAllByTestId(/column-/i))[0];
    await screen.findByText("Align roadmap themes");

    const editButton = within(column).getByRole("button", {
      name: /edit align roadmap themes/i,
    });
    await userEvent.click(editButton);

    const titleInput = within(column).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated title");

    await userEvent.click(within(column).getByRole("button", { name: /^save$/i }));

    expect(await within(column).findByText("Updated title")).toBeInTheDocument();
  });

  it("cancels card edit without saving", async () => {
    renderBoard();
    const column = (await screen.findAllByTestId(/column-/i))[0];
    await screen.findByText("Align roadmap themes");

    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );
    const titleInput = within(column).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Should not save");

    await userEvent.click(within(column).getByRole("button", { name: /^cancel$/i }));

    expect(within(column).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(within(column).queryByText("Should not save")).not.toBeInTheDocument();
  });

  it("renders the AI sidebar", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);
    expect(screen.getByText(/ai copilot/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask the ai to plan or update the board/i)).toBeInTheDocument();
  });

  it("sends AI message and applies kanban updates", async () => {
    renderBoard();
    await screen.findAllByTestId(/column-/i);

    await userEvent.type(
      screen.getByPlaceholderText(/ask the ai to plan or update the board/i),
      "Rename backlog to ideas"
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Done. I renamed the column.")).toBeInTheDocument();
    expect(await screen.findByText(/applied 1 board update/i)).toBeInTheDocument();

    await waitFor(() => {
      const calls = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some(([url]) => String(url).includes("/api/ai/chat"))).toBe(true);
      expect(
        calls.some(
          ([url, opts]) =>
            String(url).includes(`boards/${BOARD_ID}/columns/col-backlog`) &&
            (opts as RequestInit | undefined)?.method === "PATCH"
        )
      ).toBe(true);
    });
  });

  it("refetches the board after a partial AI apply failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const updatedBoard = {
      ...mockBoard,
      columns: mockBoard.columns.map((column) =>
        column.id === "col-backlog" ? { ...column, title: "Ideas" } : column
      ),
    };
    let boardFetches = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        const method = opts?.method ?? "GET";
        if (url.includes("/api/ai/chat") && method === "POST") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                reply: "I started updating the board.",
                kanban_update: {
                  operations: [
                    { action: "rename_column", column_id: "col-backlog", title: "Ideas" },
                    { action: "move_card", card_id: "card-missing", column_id: "col-done", position: 0 },
                  ],
                },
              }),
          });
        }
        if (method === "PATCH" && String(url).includes(`boards/${BOARD_ID}/columns/col-backlog`)) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        }
        if (method === "PATCH" && String(url).includes("cards/card-missing/move")) {
          return Promise.resolve({ ok: false, status: 404 });
        }
        if (url === "/api/boards" && method === "GET") {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBoardList) });
        }
        if (method === "GET" && String(url).includes(`/api/boards/${BOARD_ID}`)) {
          boardFetches += 1;
          const board = boardFetches > 1 ? updatedBoard : mockBoard;
          return Promise.resolve({ ok: true, json: () => Promise.resolve(board) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      })
    );

    try {
      renderBoard();
      await screen.findAllByTestId(/column-/i);

      await userEvent.type(
        screen.getByPlaceholderText(/ask the ai to plan or update the board/i),
        "Rename backlog and then move a missing card"
      );
      await userEvent.click(screen.getByRole("button", { name: /send/i }));

      expect(
        await screen.findByText(/i could not complete that request right now/i)
      ).toBeInTheDocument();
      expect(await screen.findByDisplayValue("Ideas")).toBeInTheDocument();
      expect(boardFetches).toBeGreaterThan(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

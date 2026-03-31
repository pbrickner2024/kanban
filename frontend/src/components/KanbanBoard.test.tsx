import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { AuthProvider } from "@/components/AuthContext";

const mockBoard = {
  id: "board-1",
  name: "My Kanban",
  columns: [
    {
      id: "col-backlog",
      title: "Backlog",
      position: 0,
      board_id: "board-1",
      created_at: "2026-01-01T00:00:00+00:00",
      cards: [
        { id: "card-1", column_id: "col-backlog", title: "Align roadmap themes", details: "Details 1", position: 0, created_at: "2026-01-01T00:00:00+00:00", updated_at: "2026-01-01T00:00:00+00:00" },
        { id: "card-2", column_id: "col-backlog", title: "Gather customer signals", details: "Details 2", position: 1, created_at: "2026-01-01T00:00:00+00:00", updated_at: "2026-01-01T00:00:00+00:00" },
      ],
    },
    { id: "col-discovery", title: "Discovery", position: 1, board_id: "board-1", created_at: "2026-01-01T00:00:00+00:00", cards: [] },
    { id: "col-progress", title: "In Progress", position: 2, board_id: "board-1", created_at: "2026-01-01T00:00:00+00:00", cards: [] },
    { id: "col-review", title: "Review", position: 3, board_id: "board-1", created_at: "2026-01-01T00:00:00+00:00", cards: [] },
    { id: "col-done", title: "Done", position: 4, board_id: "board-1", created_at: "2026-01-01T00:00:00+00:00", cards: [] },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? "GET";
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
      if (method === "GET") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBoard) });
      }
      if (method === "POST" && url.includes("/cards")) {
        const body = JSON.parse(opts!.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ id: "card-new", title: body.title, details: body.details }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    })
  );
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

  it("shows loading state before board arrives", () => {
    renderBoard();
    expect(screen.getByText(/loading board/i)).toBeInTheDocument();
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
    await userEvent.tab(); // triggers blur
    await waitFor(() => {
      const calls = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some(([url, opts]) => url.includes("col-backlog") && opts?.method === "PATCH")).toBe(true);
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
            String(url).includes("/api/board/columns/col-backlog") &&
            (opts as RequestInit | undefined)?.method === "PATCH"
        )
      ).toBe(true);
    });
  });
});


import { vi, describe, it, expect, afterEach } from "vitest";
import * as apiModule from "@/lib/api";

const BOARD_ID = "board-1";

const apiBoard = {
  id: BOARD_ID,
  name: "My Kanban",
  columns: [
    {
      id: "col-1",
      title: "Backlog",
      position: 0,
      cards: [
        {
          id: "card-1",
          column_id: "col-1",
          title: "Card One",
          details: "Details 1",
          position: 0,
          due_date: null,
          priority: null,
          color_label: null,
        },
      ],
    },
  ],
};

const mockOk = (data: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) } as Response);

const mockFail = (status = 404) =>
  vi.fn().mockResolvedValue({ ok: false, status } as Response);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchBoards", () => {
  it("calls GET /api/boards", async () => {
    const f = mockOk([{ id: BOARD_ID, name: "My Kanban", created_at: "", updated_at: "" }]);
    vi.stubGlobal("fetch", f);
    await apiModule.fetchBoards();
    expect(f).toHaveBeenCalledWith(
      "/api/boards",
      expect.objectContaining({ headers: expect.objectContaining({ "Content-Type": "application/json" }) })
    );
  });
});

describe("fetchBoard", () => {
  it("calls GET /api/boards/{id}", async () => {
    const f = mockOk(apiBoard);
    vi.stubGlobal("fetch", f);
    await apiModule.fetchBoard(BOARD_ID);
    expect(f).toHaveBeenCalledWith(
      `/api/boards/${BOARD_ID}`,
      expect.objectContaining({ headers: expect.objectContaining({ "Content-Type": "application/json" }) })
    );
  });

  it("converts API response to BoardData", async () => {
    vi.stubGlobal("fetch", mockOk(apiBoard));
    const board = await apiModule.fetchBoard(BOARD_ID);
    expect(board.columns[0].id).toBe("col-1");
    expect(board.cards["card-1"].title).toBe("Card One");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFail(500));
    await expect(apiModule.fetchBoard(BOARD_ID)).rejects.toThrow("API error 500");
  });
});

describe("renameColumn", () => {
  it("calls PATCH /api/boards/{boardId}/columns/{id} with title", async () => {
    const f = mockOk({});
    vi.stubGlobal("fetch", f);
    await apiModule.renameColumn(BOARD_ID, "col-1", "New Name");
    expect(f).toHaveBeenCalledWith(
      `/api/boards/${BOARD_ID}/columns/col-1`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "New Name" }) })
    );
  });
});

describe("createCard", () => {
  it("calls POST /api/boards/{boardId}/columns/{id}/cards and returns card", async () => {
    const created = {
      id: "card-new",
      title: "My Card",
      details: "Some details",
      due_date: null,
      priority: null,
      color_label: null,
    };
    const f = mockOk(created);
    vi.stubGlobal("fetch", f);
    const card = await apiModule.createCard(BOARD_ID, "col-1", "My Card", "Some details");
    expect(f).toHaveBeenCalledWith(
      `/api/boards/${BOARD_ID}/columns/col-1/cards`,
      expect.objectContaining({ method: "POST" })
    );
    expect(card.id).toBe("card-new");
    expect(card.title).toBe("My Card");
  });
});

describe("updateCard", () => {
  it("calls PATCH /api/boards/{boardId}/cards/{id} with fields", async () => {
    const f = mockOk({});
    vi.stubGlobal("fetch", f);
    await apiModule.updateCard(BOARD_ID, "card-1", { title: "Updated", details: "New details" });
    expect(f).toHaveBeenCalledWith(
      `/api/boards/${BOARD_ID}/cards/card-1`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Updated", details: "New details" }),
      })
    );
  });

  it("calls PATCH with partial fields", async () => {
    const f = mockOk({});
    vi.stubGlobal("fetch", f);
    await apiModule.updateCard(BOARD_ID, "card-1", { title: "Only title" });
    expect(f).toHaveBeenCalledWith(
      `/api/boards/${BOARD_ID}/cards/card-1`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Only title" }),
      })
    );
  });
});

describe("deleteCard", () => {
  it("calls DELETE /api/boards/{boardId}/cards/{id}", async () => {
    const f = mockOk({});
    vi.stubGlobal("fetch", f);
    await apiModule.deleteCard(BOARD_ID, "card-1");
    expect(f).toHaveBeenCalledWith(
      `/api/boards/${BOARD_ID}/cards/card-1`,
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("moveCard", () => {
  it("calls PATCH /api/boards/{boardId}/cards/{id}/move with target column and position", async () => {
    const f = mockOk({});
    vi.stubGlobal("fetch", f);
    await apiModule.moveCard(BOARD_ID, "card-1", "col-done", 2);
    expect(f).toHaveBeenCalledWith(
      `/api/boards/${BOARD_ID}/cards/card-1/move`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ column_id: "col-done", position: 2 }),
      })
    );
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFail(422));
    await expect(apiModule.moveCard(BOARD_ID, "card-1", "col-x", 0)).rejects.toThrow("API error 422");
  });
});

describe("askAi", () => {
  it("calls POST /api/ai/chat with board_id and returns structured response", async () => {
    const f = mockOk({
      reply: "Done",
      kanban_update: { operations: [{ action: "delete_card", card_id: "card-1" }] },
    });
    vi.stubGlobal("fetch", f);

    const res = await apiModule.askAi(BOARD_ID, [
      { role: "user", content: "Delete card-1" },
    ]);

    expect(f).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "Delete card-1" }],
          board_id: BOARD_ID,
        }),
      })
    );
    expect(res.reply).toBe("Done");
    expect(res.kanban_update?.operations[0].action).toBe("delete_card");
  });
});

describe("registerApi", () => {
  it("calls POST /api/auth/register", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user_id: "user-abc" }) });
    vi.stubGlobal("fetch", f);
    await apiModule.registerApi("newuser", "securepassword");
    expect(f).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "newuser", password: "securepassword" }),
      })
    );
  });

  it("throws on conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "Username already taken" }),
      })
    );
    await expect(apiModule.registerApi("user", "password123")).rejects.toThrow(
      "Username already taken"
    );
  });
});

import { vi, describe, it, expect, afterEach } from "vitest";
import * as apiModule from "@/lib/api";

const apiBoard = {
  id: "board-1",
  name: "My Kanban",
  columns: [
    {
      id: "col-1",
      title: "Backlog",
      position: 0,
      cards: [
        { id: "card-1", column_id: "col-1", title: "Card One", details: "Details 1", position: 0 },
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

describe("fetchBoard", () => {
  it("calls GET /api/board", async () => {
    const f = mockOk(apiBoard);
    vi.stubGlobal("fetch", f);
    await apiModule.fetchBoard();
    expect(f).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } })
    );
  });

  it("converts API response to BoardData", async () => {
    vi.stubGlobal("fetch", mockOk(apiBoard));
    const board = await apiModule.fetchBoard();
    expect(board.columns[0].id).toBe("col-1");
    expect(board.cards["card-1"].title).toBe("Card One");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFail(500));
    await expect(apiModule.fetchBoard()).rejects.toThrow("API error 500");
  });
});

describe("renameColumn", () => {
  it("calls PATCH /api/board/columns/{id} with title", async () => {
    const f = mockOk({});
    vi.stubGlobal("fetch", f);
    await apiModule.renameColumn("col-1", "New Name");
    expect(f).toHaveBeenCalledWith(
      "/api/board/columns/col-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "New Name" }) })
    );
  });
});

describe("createCard", () => {
  it("calls POST /api/board/columns/{id}/cards and returns card", async () => {
    const created = { id: "card-new", title: "My Card", details: "Some details" };
    const f = mockOk(created);
    vi.stubGlobal("fetch", f);
    const card = await apiModule.createCard("col-1", "My Card", "Some details");
    expect(f).toHaveBeenCalledWith(
      "/api/board/columns/col-1/cards",
      expect.objectContaining({ method: "POST" })
    );
    expect(card).toEqual({ id: "card-new", title: "My Card", details: "Some details" });
  });
});

describe("updateCard", () => {
  it("calls PATCH /api/board/cards/{id} with title and details", async () => {
    const f = mockOk({});
    vi.stubGlobal("fetch", f);
    await apiModule.updateCard("card-1", "Updated", "New details");
    expect(f).toHaveBeenCalledWith(
      "/api/board/cards/card-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Updated", details: "New details" }),
      })
    );
  });

  it("calls PATCH /api/board/cards/{id} with partial fields", async () => {
    const f = mockOk({});
    vi.stubGlobal("fetch", f);
    await apiModule.updateCardPartial("card-1", { title: "Only title" });
    expect(f).toHaveBeenCalledWith(
      "/api/board/cards/card-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Only title" }),
      })
    );
  });
});

describe("deleteCard", () => {
  it("calls DELETE /api/board/cards/{id}", async () => {
    const f = mockOk({});
    vi.stubGlobal("fetch", f);
    await apiModule.deleteCard("card-1");
    expect(f).toHaveBeenCalledWith(
      "/api/board/cards/card-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("moveCard", () => {
  it("calls PATCH /api/board/cards/{id}/move with target column and position", async () => {
    const f = mockOk({});
    vi.stubGlobal("fetch", f);
    await apiModule.moveCard("card-1", "col-done", 2);
    expect(f).toHaveBeenCalledWith(
      "/api/board/cards/card-1/move",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ column_id: "col-done", position: 2 }),
      })
    );
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFail(422));
    await expect(apiModule.moveCard("card-1", "col-x", 0)).rejects.toThrow("API error 422");
  });
});

describe("askAi", () => {
  it("calls POST /api/ai/chat and returns structured response", async () => {
    const f = mockOk({
      reply: "Done",
      kanban_update: { operations: [{ action: "delete_card", card_id: "card-1" }] },
    });
    vi.stubGlobal("fetch", f);

    const res = await apiModule.askAi([
      { role: "user", content: "Delete card-1" },
    ]);

    expect(f).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "Delete card-1" }] }),
      })
    );
    expect(res.reply).toBe("Done");
    expect(res.kanban_update?.operations[0].action).toBe("delete_card");
  });
});

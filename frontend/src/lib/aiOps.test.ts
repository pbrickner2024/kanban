import { describe, expect, it, vi } from "vitest";
import { applyKanbanOperations } from "@/lib/aiOps";

const makeActions = () => ({
  renameColumn: vi.fn().mockResolvedValue(undefined),
  createCard: vi.fn().mockResolvedValue(undefined),
  updateCard: vi.fn().mockResolvedValue(undefined),
  deleteCard: vi.fn().mockResolvedValue(undefined),
  moveCard: vi.fn().mockResolvedValue(undefined),
});

describe("applyKanbanOperations", () => {
  it("applies rename_column", async () => {
    const actions = makeActions();
    const count = await applyKanbanOperations(
      [{ action: "rename_column", column_id: "col-1", title: "New Name" }],
      actions
    );
    expect(count).toBe(1);
    expect(actions.renameColumn).toHaveBeenCalledWith("col-1", "New Name");
  });

  it("applies create_card", async () => {
    const actions = makeActions();
    const count = await applyKanbanOperations(
      [{ action: "create_card", column_id: "col-1", title: "Task", details: "D" }],
      actions
    );
    expect(count).toBe(1);
    expect(actions.createCard).toHaveBeenCalledWith("col-1", "Task", "D");
  });

  it("applies update_card with partial fields", async () => {
    const actions = makeActions();
    const count = await applyKanbanOperations(
      [{ action: "update_card", card_id: "card-1", title: "Updated" }],
      actions
    );
    expect(count).toBe(1);
    expect(actions.updateCard).toHaveBeenCalledWith("card-1", { title: "Updated" });
  });

  it("applies delete_card", async () => {
    const actions = makeActions();
    const count = await applyKanbanOperations(
      [{ action: "delete_card", card_id: "card-1" }],
      actions
    );
    expect(count).toBe(1);
    expect(actions.deleteCard).toHaveBeenCalledWith("card-1");
  });

  it("applies move_card with default position", async () => {
    const actions = makeActions();
    const count = await applyKanbanOperations(
      [{ action: "move_card", card_id: "card-1", column_id: "col-done" }],
      actions
    );
    expect(count).toBe(1);
    expect(actions.moveCard).toHaveBeenCalledWith("card-1", "col-done", 0);
  });

  it("skips invalid operations", async () => {
    const actions = makeActions();
    const count = await applyKanbanOperations(
      [
        { action: "rename_column", title: "No column" },
        { action: "delete_card" },
        { action: "update_card", card_id: "card-1" },
      ],
      actions
    );
    expect(count).toBe(0);
    expect(actions.renameColumn).not.toHaveBeenCalled();
    expect(actions.deleteCard).not.toHaveBeenCalled();
    expect(actions.updateCard).not.toHaveBeenCalled();
  });

  it("applies operations in order", async () => {
    const order: string[] = [];
    const actions = {
      renameColumn: vi.fn(async () => { order.push("rename"); }),
      createCard: vi.fn(async () => { order.push("create"); }),
      updateCard: vi.fn(async () => { order.push("update"); }),
      deleteCard: vi.fn(async () => { order.push("delete"); }),
      moveCard: vi.fn(async () => { order.push("move"); }),
    };

    const count = await applyKanbanOperations(
      [
        { action: "rename_column", column_id: "col-1", title: "A" },
        { action: "create_card", column_id: "col-1", title: "B" },
        { action: "move_card", card_id: "card-1", column_id: "col-2", position: 2 },
      ],
      actions
    );

    expect(count).toBe(3);
    expect(order).toEqual(["rename", "create", "move"]);
  });
});

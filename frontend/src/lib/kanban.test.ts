import { boardFromApi, moveCard, type Column } from "@/lib/kanban";

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
        { id: "card-2", column_id: "col-1", title: "Card Two", details: "Details 2", position: 1 },
      ],
    },
    {
      id: "col-2",
      title: "Done",
      position: 1,
      cards: [],
    },
  ],
};

describe("boardFromApi", () => {
  it("converts columns and preserves order", () => {
    const board = boardFromApi(apiBoard);
    expect(board.columns).toHaveLength(2);
    expect(board.columns[0].id).toBe("col-1");
    expect(board.columns[0].title).toBe("Backlog");
    expect(board.columns[0].cardIds).toEqual(["card-1", "card-2"]);
    expect(board.columns[1].id).toBe("col-2");
  });

  it("populates cards record from nested cards", () => {
    const board = boardFromApi(apiBoard);
    expect(board.cards["card-1"]).toMatchObject({ id: "card-1", title: "Card One", details: "Details 1" });
    expect(board.cards["card-2"]).toMatchObject({ id: "card-2", title: "Card Two", details: "Details 2" });
  });

  it("handles columns with no cards", () => {
    const board = boardFromApi(apiBoard);
    expect(board.columns[1].cardIds).toEqual([]);
  });

  it("handles empty board", () => {
    const board = boardFromApi({ id: "b", name: "Empty", columns: [] });
    expect(board.columns).toHaveLength(0);
    expect(board.cards).toEqual({});
  });
});

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });
});

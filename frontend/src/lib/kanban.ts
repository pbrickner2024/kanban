export type Priority = "low" | "medium" | "high" | "urgent";

export const LABEL_COLORS: { id: string; hex: string; label: string }[] = [
  { id: "red", hex: "#e74c3c", label: "Red" },
  { id: "orange", hex: "#e67e22", label: "Orange" },
  { id: "yellow", hex: "#f1c40f", label: "Yellow" },
  { id: "green", hex: "#2ecc71", label: "Green" },
  { id: "blue", hex: "#3498db", label: "Blue" },
  { id: "purple", hex: "#9b59b6", label: "Purple" },
  { id: "pink", hex: "#e91e8c", label: "Pink" },
  { id: "teal", hex: "#1abc9c", label: "Teal" },
];

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  low: { label: "Low", color: "#2ecc71" },
  medium: { label: "Medium", color: "#f39c12" },
  high: { label: "High", color: "#e67e22" },
  urgent: { label: "Urgent", color: "#e74c3c" },
};

export type Card = {
  id: string;
  title: string;
  details: string | null;
  due_date: string | null;
  priority: Priority | null;
  color_label: string | null;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

const isColumnId = (columns: Column[], id: string) =>
  columns.some((column) => column.id === id);

const findColumnId = (columns: Column[], id: string) => {
  if (isColumnId(columns, id)) {
    return id;
  }
  return columns.find((column) => column.cardIds.includes(id))?.id;
};

export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string
): Column[] => {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);

  if (!activeColumnId || !overColumnId) {
    return columns;
  }

  const activeColumn = columns.find((column) => column.id === activeColumnId);
  const overColumn = columns.find((column) => column.id === overColumnId);

  if (!activeColumn || !overColumn) {
    return columns;
  }

  const isOverColumn = isColumnId(columns, overId);

  if (activeColumnId === overColumnId) {
    if (isOverColumn) {
      const nextCardIds = activeColumn.cardIds.filter(
        (cardId) => cardId !== activeId
      );
      nextCardIds.push(activeId);
      return columns.map((column) =>
        column.id === activeColumnId
          ? { ...column, cardIds: nextCardIds }
          : column
      );
    }

    const oldIndex = activeColumn.cardIds.indexOf(activeId);
    const newIndex = activeColumn.cardIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return columns;
    }

    const nextCardIds = [...activeColumn.cardIds];
    nextCardIds.splice(oldIndex, 1);
    nextCardIds.splice(newIndex, 0, activeId);

    return columns.map((column) =>
      column.id === activeColumnId
        ? { ...column, cardIds: nextCardIds }
        : column
    );
  }

  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  if (activeIndex === -1) {
    return columns;
  }

  const nextActiveCardIds = [...activeColumn.cardIds];
  nextActiveCardIds.splice(activeIndex, 1);

  const nextOverCardIds = [...overColumn.cardIds];
  if (isOverColumn) {
    nextOverCardIds.push(activeId);
  } else {
    const overIndex = overColumn.cardIds.indexOf(overId);
    const insertIndex = overIndex === -1 ? nextOverCardIds.length : overIndex;
    nextOverCardIds.splice(insertIndex, 0, activeId);
  }

  return columns.map((column) => {
    if (column.id === activeColumnId) {
      return { ...column, cardIds: nextActiveCardIds };
    }
    if (column.id === overColumnId) {
      return { ...column, cardIds: nextOverCardIds };
    }
    return column;
  });
};

export const createId = (prefix: string) => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}-${randomPart}${timePart}`;
};

type ApiCard = {
  id: string;
  column_id: string;
  title: string;
  details: string | null;
  due_date: string | null;
  priority: Priority | null;
  color_label: string | null;
};
type ApiColumn = { id: string; title: string; cards: ApiCard[] };
type ApiBoard = { id: string; name: string; columns: ApiColumn[] };

export const boardFromApi = (api: ApiBoard): BoardData => {
  const cards: Record<string, Card> = {};
  const columns = api.columns.map((col) => {
    col.cards.forEach((c) => {
      cards[c.id] = {
        id: c.id,
        title: c.title,
        details: c.details,
        due_date: c.due_date ?? null,
        priority: c.priority ?? null,
        color_label: c.color_label ?? null,
      };
    });
    return { id: col.id, title: col.title, cardIds: col.cards.map((c) => c.id) };
  });
  return { columns, cards };
};

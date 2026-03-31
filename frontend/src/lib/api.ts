import { boardFromApi, type BoardData, type Card } from "@/lib/kanban";

const BASE = "/api";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type KanbanOperation = {
  action: "rename_column" | "create_card" | "update_card" | "delete_card" | "move_card";
  column_id?: string | null;
  card_id?: string | null;
  title?: string | null;
  details?: string | null;
  position?: number | null;
};

export type KanbanUpdate = {
  operations: KanbanOperation[];
};

export type ChatResponse = {
  reply: string;
  kanban_update: KanbanUpdate | null;
};

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res;
}

export async function fetchBoard(): Promise<BoardData> {
  const res = await apiFetch("/board");
  return boardFromApi(await res.json());
}

export async function renameColumn(columnId: string, title: string): Promise<void> {
  await apiFetch(`/board/columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function createCard(
  columnId: string,
  title: string,
  details: string
): Promise<Card> {
  const res = await apiFetch(`/board/columns/${columnId}/cards`, {
    method: "POST",
    body: JSON.stringify({ title, details }),
  });
  const data = await res.json();
  return { id: data.id, title: data.title, details: data.details };
}

export async function updateCard(
  cardId: string,
  title: string,
  details: string
): Promise<void> {
  await apiFetch(`/board/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({ title, details }),
  });
}

export async function updateCardPartial(
  cardId: string,
  fields: { title?: string; details?: string }
): Promise<void> {
  await apiFetch(`/board/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export async function deleteCard(cardId: string): Promise<void> {
  await apiFetch(`/board/cards/${cardId}`, { method: "DELETE" });
}

export async function moveCard(
  cardId: string,
  targetColumnId: string,
  position: number
): Promise<void> {
  await apiFetch(`/board/cards/${cardId}/move`, {
    method: "PATCH",
    body: JSON.stringify({ column_id: targetColumnId, position }),
  });
}

export async function askAi(messages: ChatMessage[]): Promise<ChatResponse> {
  const res = await apiFetch("/ai/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
  return res.json();
}

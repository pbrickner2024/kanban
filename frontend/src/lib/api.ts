import { boardFromApi, type BoardData, type Card } from "@/lib/kanban";
import { getAuthToken } from "@/lib/auth";

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

export type BoardSummary = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export class ApiError extends Error {
  constructor(public status: number, path: string) {
    super(`API error ${status}: ${path}`);
  }
}

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) throw new ApiError(res.status, path);
  return res;
}

export async function loginApi(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  return data.token;
}

export async function registerApi(username: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? "Registration failed");
  }
}

export async function logoutApi(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;
  await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => {});
}

// Boards

export async function fetchBoards(): Promise<BoardSummary[]> {
  const res = await apiFetch("/boards");
  return res.json();
}

export async function createBoard(name: string): Promise<BoardSummary> {
  const res = await apiFetch("/boards", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function renameBoard(boardId: string, name: string): Promise<BoardSummary> {
  const res = await apiFetch(`/boards/${boardId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteBoard(boardId: string): Promise<void> {
  await apiFetch(`/boards/${boardId}`, { method: "DELETE" });
}

export async function fetchBoard(boardId: string): Promise<BoardData> {
  const res = await apiFetch(`/boards/${boardId}`);
  return boardFromApi(await res.json());
}

// Columns

export async function createColumn(boardId: string, title: string): Promise<{ id: string; title: string; position: number }> {
  const res = await apiFetch(`/boards/${boardId}/columns`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return res.json();
}

export async function renameColumn(boardId: string, columnId: string, title: string): Promise<void> {
  await apiFetch(`/boards/${boardId}/columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteColumn(boardId: string, columnId: string): Promise<void> {
  await apiFetch(`/boards/${boardId}/columns/${columnId}`, { method: "DELETE" });
}

export async function reorderColumns(boardId: string, columnIds: string[]): Promise<void> {
  await apiFetch(`/boards/${boardId}/columns/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ column_ids: columnIds }),
  });
}

// Cards

export async function createCard(
  boardId: string,
  columnId: string,
  title: string,
  details: string,
  extra?: { priority?: string | null; due_date?: string | null; color_label?: string | null }
): Promise<Card> {
  const res = await apiFetch(`/boards/${boardId}/columns/${columnId}/cards`, {
    method: "POST",
    body: JSON.stringify({ title, details, ...extra }),
  });
  const data = await res.json();
  return {
    id: data.id,
    title: data.title,
    details: data.details,
    due_date: data.due_date ?? null,
    priority: data.priority ?? null,
    color_label: data.color_label ?? null,
  };
}

export async function updateCard(
  boardId: string,
  cardId: string,
  fields: {
    title?: string;
    details?: string;
    priority?: string | null;
    due_date?: string | null;
    color_label?: string | null;
  }
): Promise<void> {
  await apiFetch(`/boards/${boardId}/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export async function deleteCard(boardId: string, cardId: string): Promise<void> {
  await apiFetch(`/boards/${boardId}/cards/${cardId}`, { method: "DELETE" });
}

export async function moveCard(
  boardId: string,
  cardId: string,
  targetColumnId: string,
  position: number
): Promise<void> {
  await apiFetch(`/boards/${boardId}/cards/${cardId}/move`, {
    method: "PATCH",
    body: JSON.stringify({ column_id: targetColumnId, position }),
  });
}

export async function askAi(boardId: string, messages: ChatMessage[]): Promise<ChatResponse> {
  const res = await apiFetch("/ai/chat", {
    method: "POST",
    body: JSON.stringify({ messages, board_id: boardId }),
  });
  return res.json();
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AiSidebar } from "@/components/AiSidebar";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import { moveCard, type BoardData, type Priority } from "@/lib/kanban";
import { useAuth } from "@/components/AuthContext";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { applyKanbanOperations } from "@/lib/aiOps";

export const KanbanBoard = () => {
  const { logout } = useAuth();

  // Board list state
  const [boards, setBoards] = useState<api.BoardSummary[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

  // Board content state
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardError, setBoardError] = useState(false);

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<api.ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [lastAppliedCount, setLastAppliedCount] = useState(0);

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) logout();
    },
    [logout]
  );

  // Load boards on mount
  useEffect(() => {
    api
      .fetchBoards()
      .then((list) => {
        setBoards(list);
        if (list.length > 0) setActiveBoardId(list[0].id);
      })
      .catch(handleAuthError);
  }, [handleAuthError]);

  const refetchBoard = useCallback(() => {
    if (!activeBoardId) return;
    api
      .fetchBoard(activeBoardId)
      .then((b) => {
        setBoard(b);
        setBoardError(false);
      })
      .catch((err) => {
        handleAuthError(err);
        setBoardError(true);
      });
  }, [activeBoardId, handleAuthError]);

  useEffect(() => {
    if (activeBoardId) {
      setBoard(null);
      setBoardError(false);
      refetchBoard();
    }
  }, [activeBoardId, refetchBoard]);

  // Board management handlers
  const handleCreateBoard = async (name: string) => {
    const newBoard = await api.createBoard(name);
    setBoards((prev) => [...prev, newBoard]);
    setActiveBoardId(newBoard.id);
  };

  const handleRenameBoard = async (boardId: string, name: string) => {
    const updated = await api.renameBoard(boardId, name);
    setBoards((prev) => prev.map((b) => (b.id === boardId ? updated : b)));
  };

  const handleDeleteBoard = async (boardId: string) => {
    await api.deleteBoard(boardId);
    const remaining = boards.filter((b) => b.id !== boardId);
    setBoards(remaining);
    if (activeBoardId === boardId) {
      setActiveBoardId(remaining[0]?.id ?? null);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id || !board || !activeBoardId) return;

    const updatedColumns = moveCard(board.columns, active.id as string, over.id as string);
    const newColumn = updatedColumns.find((col) => col.cardIds.includes(active.id as string));
    if (!newColumn) return;
    const position = newColumn.cardIds.indexOf(active.id as string);

    setBoard((prev) => (prev ? { ...prev, columns: updatedColumns } : prev));
    api
      .moveCard(activeBoardId, active.id as string, newColumn.id, position)
      .catch(refetchBoard);
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    if (!activeBoardId) return;
    const previousColumns = board?.columns ?? [];
    setBoard((prev) =>
      prev
        ? { ...prev, columns: prev.columns.map((col) => (col.id === columnId ? { ...col, title } : col)) }
        : prev
    );
    api.renameColumn(activeBoardId, columnId, title).catch(() => {
      setBoard((prev) => (prev ? { ...prev, columns: previousColumns } : prev));
    });
  };

  const handleAddColumn = async (title: string) => {
    if (!activeBoardId) return;
    const col = await api.createColumn(activeBoardId, title);
    setBoard((prev) =>
      prev
        ? { ...prev, columns: [...prev.columns, { id: col.id, title: col.title, cardIds: [] }] }
        : prev
    );
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!activeBoardId) return;
    if (!window.confirm("Delete this column and all its cards?")) return;
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            columns: prev.columns.filter((c) => c.id !== columnId),
            cards: Object.fromEntries(
              Object.entries(prev.cards).filter(
                ([, card]) =>
                  !prev.columns.find((c) => c.id === columnId)?.cardIds.includes(card.id)
              )
            ),
          }
        : prev
    );
    await api.deleteColumn(activeBoardId, columnId).catch(refetchBoard);
  };

  const handleAddCard = async (
    columnId: string,
    title: string,
    details: string,
    extra?: { priority?: Priority | null; due_date?: string | null; color_label?: string | null }
  ) => {
    if (!activeBoardId) return;
    try {
      const card = await api.createCard(activeBoardId, columnId, title, details, extra);
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: { ...prev.cards, [card.id]: card },
              columns: prev.columns.map((col) =>
                col.id === columnId ? { ...col, cardIds: [...col.cardIds, card.id] } : col
              ),
            }
          : prev
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateCard = async (
    cardId: string,
    fields: {
      title?: string;
      details?: string;
      priority?: Priority | null;
      due_date?: string | null;
      color_label?: string | null;
    }
  ) => {
    if (!activeBoardId) return;
    try {
      await api.updateCard(activeBoardId, cardId, fields);
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: {
                ...prev.cards,
                [cardId]: { ...prev.cards[cardId], ...fields },
              },
            }
          : prev
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    if (!activeBoardId) return;
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            cards: Object.fromEntries(Object.entries(prev.cards).filter(([id]) => id !== cardId)),
            columns: prev.columns.map((col) =>
              col.id === columnId ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) } : col
            ),
          }
        : prev
    );
    api.deleteCard(activeBoardId, cardId).catch(refetchBoard);
  };

  const handleSendAiMessage = async (text: string) => {
    if (!activeBoardId) return;
    const nextMessages: api.ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: text },
    ];
    setChatMessages(nextMessages);
    setAiLoading(true);
    setLastAppliedCount(0);

    try {
      const ai = await api.askAi(activeBoardId, nextMessages);
      setChatMessages((prev) => [...prev, { role: "assistant", content: ai.reply }]);

      const ops = ai.kanban_update?.operations ?? [];
      if (ops.length > 0) {
        try {
          const count = await applyKanbanOperations(ops, {
            renameColumn: (columnId, title) => api.renameColumn(activeBoardId, columnId, title),
            createCard: (columnId, title, details) =>
              api.createCard(activeBoardId, columnId, title, details).then(() => undefined),
            updateCard: (cardId, fields) => api.updateCard(activeBoardId, cardId, fields),
            deleteCard: (cardId) => api.deleteCard(activeBoardId, cardId),
            moveCard: (cardId, columnId, position) =>
              api.moveCard(activeBoardId, cardId, columnId, position),
          });
          setLastAppliedCount(count);
        } finally {
          refetchBoard();
        }
      }
    } catch (error) {
      console.error(error);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I could not complete that request right now. Please try again." },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (!activeBoardId || boards.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--gray-text)]">Loading...</p>
      </div>
    );
  }

  if (boardError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm font-semibold text-[var(--navy-dark)]">Could not load your board.</p>
        <button
          onClick={refetchBoard}
          className="rounded-lg bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--gray-text)]">Loading board...</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1700px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Project Management
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Organize work across multiple boards. Drag cards between stages, add
                columns, set priorities and due dates, and let the AI assistant help.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <BoardSwitcher
                boards={boards}
                activeBoardId={activeBoardId}
                onSwitch={setActiveBoardId}
                onCreate={handleCreateBoard}
                onRename={handleRenameBoard}
                onDelete={handleDeleteBoard}
              />
              <button
                onClick={logout}
                className="rounded-lg bg-[var(--accent-yellow)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--navy-dark)] transition hover:opacity-90 active:scale-95"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div>
              <section
                className="grid gap-6"
                style={{
                  gridTemplateColumns: `repeat(${board.columns.length}, minmax(220px, 1fr))`,
                }}
              >
                {board.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onUpdateCard={handleUpdateCard}
                    onDeleteCard={handleDeleteCard}
                    onDeleteColumn={handleDeleteColumn}
                  />
                ))}
              </section>
              <div className="mt-4">
                <AddColumnButton onAdd={handleAddColumn} />
              </div>
            </div>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <div className="xl:sticky xl:top-6 xl:self-start">
            <AiSidebar
              messages={chatMessages}
              isLoading={aiLoading}
              lastAppliedCount={lastAppliedCount}
              onSend={handleSendAiMessage}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

function AddColumnButton({ onAdd }: { onAdd: (title: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");

  const submit = () => {
    const t = title.trim();
    if (t) {
      onAdd(t);
      setTitle("");
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-2xl border border-dashed border-[var(--stroke)] px-5 py-3 text-sm font-semibold text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
      >
        + Add column
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setIsOpen(false);
        }}
        placeholder="Column title"
        className="rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
      />
      <button
        onClick={submit}
        className="rounded-xl bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
      >
        Add
      </button>
      <button
        onClick={() => setIsOpen(false)}
        className="rounded-xl border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
      >
        Cancel
      </button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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
import { moveCard, type BoardData } from "@/lib/kanban";
import { useAuth } from "@/components/AuthContext";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { applyKanbanOperations } from "@/lib/aiOps";

export const KanbanBoard = () => {
  const { logout } = useAuth();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardError, setBoardError] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<api.ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [lastAppliedCount, setLastAppliedCount] = useState(0);

  const refetch = () =>
    api
      .fetchBoard()
      .then((b) => {
        setBoard(b);
        setBoardError(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout();
        } else {
          setBoardError(true);
        }
      });

  useEffect(() => {
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id || !board) return;

    const updatedColumns = moveCard(board.columns, active.id as string, over.id as string);
    const newColumn = updatedColumns.find((col) => col.cardIds.includes(active.id as string));
    if (!newColumn) return;
    const position = newColumn.cardIds.indexOf(active.id as string);

    setBoard((prev) => (prev ? { ...prev, columns: updatedColumns } : prev));
    api.moveCard(active.id as string, newColumn.id, position).catch(refetch);
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    const previousColumns = board?.columns ?? [];
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map((col) =>
              col.id === columnId ? { ...col, title } : col
            ),
          }
        : prev
    );
    api.renameColumn(columnId, title).catch(() => {
      setBoard((prev) =>
        prev ? { ...prev, columns: previousColumns } : prev
      );
    });
  };

  const handleAddCard = async (columnId: string, title: string, details: string) => {
    try {
      const card = await api.createCard(columnId, title, details);
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: { ...prev.cards, [card.id]: card },
              columns: prev.columns.map((col) =>
                col.id === columnId
                  ? { ...col, cardIds: [...col.cardIds, card.id] }
                  : col
              ),
            }
          : prev
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateCard = async (cardId: string, title: string, details: string) => {
    try {
      await api.updateCard(cardId, title, details);
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: {
                ...prev.cards,
                [cardId]: { ...prev.cards[cardId], title, details },
              },
            }
          : prev
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            cards: Object.fromEntries(
              Object.entries(prev.cards).filter(([id]) => id !== cardId)
            ),
            columns: prev.columns.map((col) =>
              col.id === columnId
                ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) }
                : col
            ),
          }
        : prev
    );
    api.deleteCard(cardId).catch(refetch);
  };

  const handleSendAiMessage = async (text: string) => {
    const nextMessages: api.ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: text },
    ];
    setChatMessages(nextMessages);
    setAiLoading(true);
    setLastAppliedCount(0);

    try {
      const ai = await api.askAi(nextMessages);
      setChatMessages((prev) => [...prev, { role: "assistant", content: ai.reply }]);

      const ops = ai.kanban_update?.operations ?? [];
      if (ops.length > 0) {
        const count = await applyKanbanOperations(ops, {
          renameColumn: api.renameColumn,
          createCard: async (columnId, title, details) => {
            await api.createCard(columnId, title, details);
          },
          updateCard: api.updateCardPartial,
          deleteCard: api.deleteCard,
          moveCard: api.moveCard,
        });
        setLastAppliedCount(count);
        if (count > 0) await refetch();
      }
    } catch (error) {
      console.error(error);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I could not complete that request right now. Please try again.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (boardError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm font-semibold text-[var(--navy-dark)]">Could not load your board.</p>
        <button
          onClick={refetch}
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
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
              <button
                onClick={logout}
                className="rounded-lg bg-[var(--accent-yellow)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--navy-dark)] transition hover:opacity-90 active:scale-95"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
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
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onUpdateCard={handleUpdateCard}
                  onDeleteCard={handleDeleteCard}
                />
              ))}
            </section>
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


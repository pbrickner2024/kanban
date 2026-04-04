import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onUpdate: (cardId: string, title: string, details: string) => void;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onUpdate, onDelete }: KanbanCardProps) => {
  const [draft, setDraft] = useState<{ title: string; details: string } | null>(null);
  const isEditing = draft !== null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const startEditing = () => {
    setDraft({ title: card.title, details: card.details });
  };

  const cancelEditing = () => {
    setDraft(null);
  };

  const handleSave = () => {
    if (!draft) return;
    const trimmed = draft.title.trim();
    if (trimmed) {
      onUpdate(card.id, trimmed, draft.details);
      setDraft(null);
    }
  };

  if (isEditing) {
    return (
      <article
        ref={setNodeRef}
        style={style}
        className="rounded-2xl border border-[var(--primary-blue)] bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]"
        {...attributes}
        data-testid={`card-${card.id}`}
      >
        <div className="flex flex-col gap-2">
          <input
            value={draft.title}
            onChange={(e) =>
              setDraft((current) =>
                current ? { ...current, title: e.target.value } : current
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") cancelEditing();
            }}
            className="w-full rounded border border-[var(--stroke)] px-2 py-1 font-display text-base font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            aria-label="Card title"
            autoFocus
          />
          <input
            value={draft.details}
            onChange={(e) =>
              setDraft((current) =>
                current ? { ...current, details: e.target.value } : current
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Escape") cancelEditing();
            }}
            className="w-full rounded border border-[var(--stroke)] px-2 py-1 text-sm text-[var(--gray-text)] outline-none focus:border-[var(--primary-blue)]"
            aria-label="Card details"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-full border border-[var(--stroke)] px-3 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-[var(--secondary-purple)] px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
            {card.title}
          </h4>
          <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
            {card.details}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              startEditing();
            }}
            className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
            aria-label={`Edit ${card.title}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(card.id)}
            className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
            aria-label={`Delete ${card.title}`}
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
};

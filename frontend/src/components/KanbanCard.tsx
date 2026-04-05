import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card, Priority } from "@/lib/kanban";
import { LABEL_COLORS, PRIORITY_META } from "@/lib/kanban";

export type CardUpdateFields = {
  title?: string;
  details?: string;
  priority?: Priority | null;
  due_date?: string | null;
  color_label?: string | null;
};

type KanbanCardProps = {
  card: Card;
  onUpdate: (cardId: string, fields: CardUpdateFields) => void;
  onDelete: (cardId: string) => void;
};

type Draft = {
  title: string;
  details: string;
  priority: Priority | null;
  due_date: string;
  color_label: string | null;
};

function isOverdue(due_date: string | null): boolean {
  if (!due_date) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

export const KanbanCard = ({ card, onUpdate, onDelete }: KanbanCardProps) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const isEditing = draft !== null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const startEditing = () => {
    setDraft({
      title: card.title ?? "",
      details: card.details ?? "",
      priority: card.priority,
      due_date: card.due_date ?? "",
      color_label: card.color_label,
    });
  };

  const cancelEditing = () => setDraft(null);

  const handleSave = () => {
    if (!draft) return;
    const trimmed = draft.title.trim();
    if (!trimmed) return;
    onUpdate(card.id, {
      title: trimmed,
      details: draft.details,
      priority: draft.priority,
      due_date: draft.due_date || null,
      color_label: draft.color_label,
    });
    setDraft(null);
  };

  const colorLabelHex =
    card.color_label ? LABEL_COLORS.find((c) => c.id === card.color_label)?.hex : undefined;

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
            onChange={(e) => setDraft((d) => d && { ...d, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") cancelEditing();
            }}
            className="w-full rounded border border-[var(--stroke)] px-2 py-1 font-display text-base font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            aria-label="Card title"
            autoFocus
          />
          <textarea
            value={draft.details}
            onChange={(e) => setDraft((d) => d && { ...d, details: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancelEditing();
            }}
            rows={2}
            className="w-full resize-none rounded border border-[var(--stroke)] px-2 py-1 text-sm text-[var(--gray-text)] outline-none focus:border-[var(--primary-blue)]"
            aria-label="Card details"
          />

          {/* Priority */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-semibold text-[var(--gray-text)]">Priority</label>
            <select
              value={draft.priority ?? ""}
              onChange={(e) =>
                setDraft((d) => d && { ...d, priority: (e.target.value as Priority) || null })
              }
              className="flex-1 rounded border border-[var(--stroke)] px-2 py-1 text-xs outline-none focus:border-[var(--primary-blue)]"
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Due date */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-semibold text-[var(--gray-text)]">Due</label>
            <input
              type="date"
              value={draft.due_date}
              onChange={(e) => setDraft((d) => d && { ...d, due_date: e.target.value })}
              className="flex-1 rounded border border-[var(--stroke)] px-2 py-1 text-xs outline-none focus:border-[var(--primary-blue)]"
            />
          </div>

          {/* Color label */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs font-semibold text-[var(--gray-text)]">Label</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setDraft((d) => d && { ...d, color_label: null })}
                className={clsx(
                  "h-5 w-5 rounded-full border-2 bg-[var(--stroke)] transition",
                  draft.color_label === null ? "border-[var(--navy-dark)]" : "border-transparent"
                )}
                title="No label"
              />
              {LABEL_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDraft((d) => d && { ...d, color_label: c.id })}
                  className={clsx(
                    "h-5 w-5 rounded-full border-2 transition",
                    draft.color_label === c.id ? "border-[var(--navy-dark)]" : "border-transparent"
                  )}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
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
      style={{
        ...style,
        borderLeft: colorLabelHex ? `4px solid ${colorLabelHex}` : undefined,
      }}
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
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {card.priority && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                style={{ backgroundColor: PRIORITY_META[card.priority].color }}
              >
                {PRIORITY_META[card.priority].label}
              </span>
            )}
            {card.due_date && (
              <span
                className={clsx(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  isOverdue(card.due_date)
                    ? "bg-red-100 text-red-600"
                    : "bg-[var(--surface)] text-[var(--gray-text)]"
                )}
              >
                {card.due_date}
              </span>
            )}
          </div>
          <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1.5 text-sm leading-6 text-[var(--gray-text)]">{card.details}</p>
          )}
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

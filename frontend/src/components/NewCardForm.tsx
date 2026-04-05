import { useState, type FormEvent } from "react";
import { LABEL_COLORS, PRIORITY_META, type Priority } from "@/lib/kanban";

type NewCardFormProps = {
  onAdd: (
    title: string,
    details: string,
    extra?: { priority?: Priority | null; due_date?: string | null; color_label?: string | null }
  ) => void;
};

const initialFormState = {
  title: "",
  details: "",
  priority: "" as Priority | "",
  due_date: "",
  color_label: null as string | null,
  showOptions: false,
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) return;
    onAdd(formState.title.trim(), formState.details.trim(), {
      priority: formState.priority || null,
      due_date: formState.due_date || null,
      color_label: formState.color_label,
    });
    setFormState(initialFormState);
    setIsOpen(false);
  };

  return (
    <div className="mt-4">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={formState.title}
            onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Card title"
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            required
            autoFocus
          />
          <textarea
            value={formState.details}
            onChange={(e) => setFormState((prev) => ({ ...prev, details: e.target.value }))}
            placeholder="Details"
            rows={2}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
          />

          {/* Options toggle */}
          <button
            type="button"
            onClick={() =>
              setFormState((prev) => ({ ...prev, showOptions: !prev.showOptions }))
            }
            className="text-xs font-semibold text-[var(--primary-blue)] underline-offset-2 hover:underline"
          >
            {formState.showOptions ? "Hide options" : "Add priority / due date / label"}
          </button>

          {formState.showOptions && (
            <div className="space-y-2 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] p-3">
              {/* Priority */}
              <div className="flex items-center gap-2">
                <label className="w-14 text-xs font-semibold text-[var(--gray-text)]">
                  Priority
                </label>
                <select
                  value={formState.priority}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      priority: e.target.value as Priority | "",
                    }))
                  }
                  className="flex-1 rounded border border-[var(--stroke)] px-2 py-1 text-xs outline-none focus:border-[var(--primary-blue)]"
                >
                  <option value="">None</option>
                  {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due date */}
              <div className="flex items-center gap-2">
                <label className="w-14 text-xs font-semibold text-[var(--gray-text)]">Due</label>
                <input
                  type="date"
                  value={formState.due_date}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, due_date: e.target.value }))
                  }
                  className="flex-1 rounded border border-[var(--stroke)] px-2 py-1 text-xs outline-none focus:border-[var(--primary-blue)]"
                />
              </div>

              {/* Color label */}
              <div className="flex items-center gap-2">
                <label className="w-14 text-xs font-semibold text-[var(--gray-text)]">Label</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormState((prev) => ({ ...prev, color_label: null }))}
                    className={`h-5 w-5 rounded-full border-2 bg-[var(--stroke)] transition ${
                      formState.color_label === null ? "border-[var(--navy-dark)]" : "border-transparent"
                    }`}
                    title="No label"
                  />
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setFormState((prev) => ({ ...prev, color_label: c.id }))
                      }
                      className={`h-5 w-5 rounded-full border-2 transition ${
                        formState.color_label === c.id
                          ? "border-[var(--navy-dark)]"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Add card
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFormState(initialFormState);
              }}
              className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
        >
          Add a card
        </button>
      )}
    </div>
  );
};

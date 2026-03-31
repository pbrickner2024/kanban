"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/api";

type AiSidebarProps = {
  messages: ChatMessage[];
  isLoading: boolean;
  lastAppliedCount: number;
  onSend: (text: string) => Promise<void>;
};

const quickPrompts = [
  "Move the top backlog card to Done.",
  "Create a card in Discovery called User interview prep.",
  "Rename In Progress to Doing.",
];

export const AiSidebar = ({
  messages,
  isLoading,
  lastAppliedCount,
  onSend,
}: AiSidebarProps) => {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const statusText = useMemo(() => {
    if (isLoading) return "Thinking...";
    if (lastAppliedCount > 0) return `Applied ${lastAppliedCount} board update${lastAppliedCount === 1 ? "" : "s"}.`;
    return "Ask for planning help or direct board changes.";
  }, [isLoading, lastAppliedCount]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setDraft("");
    await onSend(trimmed);
  };

  return (
    <aside className="relative rounded-[28px] border border-[var(--stroke)] bg-[linear-gradient(180deg,#ffffff_0%,#f5fbff_50%,#fff8ef_100%)] p-5 shadow-[var(--shadow)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--gray-text)]">
            AI Copilot
          </p>
          <h2 className="mt-2 font-display text-2xl text-[var(--navy-dark)]">
            Board Assistant
          </h2>
        </div>
        <span className="rounded-full bg-[var(--accent-yellow)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--navy-dark)]">
          Live
        </span>
      </div>

      <p className="mb-4 rounded-xl border border-[var(--stroke)] bg-white/70 px-3 py-2 text-xs text-[var(--gray-text)]">
        {statusText}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => void send(prompt)}
            disabled={isLoading}
            className="rounded-full border border-[var(--stroke)] bg-white px-3 py-1 text-[11px] font-semibold text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mb-3 h-[340px] overflow-y-auto rounded-2xl border border-[var(--stroke)] bg-white/80 p-3">
        {!hasMessages ? (
          <p className="text-sm text-[var(--gray-text)]">
            Try: "Move card-1 to Done" or "Create a card in Backlog for API docs".
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div
                key={`${m.role}-${idx}`}
                className={m.role === "user" ? "text-right" : "text-left"}
              >
                <span
                  className={
                    m.role === "user"
                      ? "inline-block max-w-[90%] rounded-2xl rounded-br-sm bg-[var(--secondary-purple)] px-3 py-2 text-sm text-white"
                      : "inline-block max-w-[90%] rounded-2xl rounded-bl-sm border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)]"
                  }
                >
                  {m.content}
                </span>
              </div>
            ))}
            {isLoading ? (
              <div className="text-left">
                <span className="inline-block rounded-2xl rounded-bl-sm border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)]">
                  Thinking...
                </span>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void send(draft);
            }
          }}
          placeholder="Ask the AI to plan or update the board..."
          className="h-20 flex-1 resize-none rounded-2xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={isLoading || !draft.trim()}
          className="rounded-2xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  );
};

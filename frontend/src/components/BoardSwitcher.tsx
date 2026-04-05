"use client";

import { useState, useRef, useEffect } from "react";
import type { BoardSummary } from "@/lib/api";

type BoardSwitcherProps = {
  boards: BoardSummary[];
  activeBoardId: string;
  onSwitch: (boardId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (boardId: string, name: string) => Promise<void>;
  onDelete: (boardId: string) => Promise<void>;
};

export const BoardSwitcher = ({
  boards,
  activeBoardId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: BoardSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [creatingName, setCreatingName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setRenamingId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = async () => {
    const name = creatingName.trim();
    if (!name) return;
    await onCreate(name);
    setCreatingName("");
    setIsCreating(false);
    setIsOpen(false);
  };

  const handleRename = async (boardId: string) => {
    const name = renamingValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    await onRename(boardId, name);
    setRenamingId(null);
  };

  const handleDelete = async (boardId: string) => {
    if (!window.confirm("Delete this board and all its data?")) return;
    await onDelete(boardId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--navy-dark)] transition hover:bg-white"
      >
        <span className="max-w-[160px] truncate">{activeBoard?.name ?? "Select board"}</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[var(--stroke)] bg-white shadow-[var(--shadow)]">
          <div className="p-2">
            {boards.map((board) => (
              <div key={board.id} className="group flex items-center gap-1 rounded-xl px-2 py-1">
                {renamingId === board.id ? (
                  <input
                    className="flex-1 rounded border border-[var(--stroke)] px-2 py-1 text-sm outline-none focus:border-[var(--primary-blue)]"
                    value={renamingValue}
                    autoFocus
                    onChange={(e) => setRenamingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(board.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => handleRename(board.id)}
                  />
                ) : (
                  <button
                    className={`flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm font-medium transition ${
                      board.id === activeBoardId
                        ? "bg-[var(--primary-blue)] text-white"
                        : "text-[var(--navy-dark)] hover:bg-[var(--surface)]"
                    }`}
                    onClick={() => {
                      onSwitch(board.id);
                      setIsOpen(false);
                    }}
                  >
                    {board.name}
                  </button>
                )}
                {renamingId !== board.id && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => {
                        setRenamingId(board.id);
                        setRenamingValue(board.name);
                      }}
                      className="rounded px-1.5 py-1 text-xs text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
                      title="Rename"
                    >
                      &#9998;
                    </button>
                    {boards.length > 1 && (
                      <button
                        onClick={() => handleDelete(board.id)}
                        className="rounded px-1.5 py-1 text-xs text-[var(--gray-text)] transition hover:text-red-500"
                        title="Delete"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--stroke)] p-2">
            {isCreating ? (
              <div className="flex gap-1">
                <input
                  className="flex-1 rounded-lg border border-[var(--stroke)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary-blue)]"
                  placeholder="Board name"
                  value={creatingName}
                  autoFocus
                  onChange={(e) => setCreatingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setIsCreating(false);
                  }}
                />
                <button
                  onClick={handleCreate}
                  className="rounded-lg bg-[var(--secondary-purple)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full rounded-xl px-2 py-1.5 text-left text-sm font-medium text-[var(--primary-blue)] transition hover:bg-[var(--surface)]"
              >
                + New board
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

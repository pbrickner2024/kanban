"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/components/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    const success = await login(username, password);
    if (!success) {
      setError("Invalid username or password");
      setPassword("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f8fbff] to-[#eef6ff]">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <div className="relative w-full max-w-sm px-6">
        <div className="rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
              Kanban Studio
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
              Sign In
            </h1>
            <p className="mt-2 text-sm text-[var(--gray-text)]">
              Enter your credentials to access your board.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--navy-dark)]"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="mt-2 w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm outline-none placeholder-[var(--gray-text)] transition focus:border-[var(--primary-blue)]"
                autoComplete="username"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--navy-dark)]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-2 w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm outline-none placeholder-[var(--gray-text)] transition focus:border-[var(--primary-blue)]"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg border-l-4 border-[#dc3545] bg-[#fff5f5] px-4 py-3 text-sm text-[#dc3545]">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-95"
            >
              Sign In
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[var(--gray-text)]">
            Demo credentials: <span className="font-semibold">user</span> /{" "}
            <span className="font-semibold">password</span>
          </p>
        </div>
      </div>
    </div>
  );
}

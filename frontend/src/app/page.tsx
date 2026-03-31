"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginPage } from "@/components/LoginPage";
import { useAuth } from "@/components/AuthContext";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f8fbff] to-[#eef6ff]">
        <div className="text-sm text-[var(--gray-text)]">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? <KanbanBoard /> : <LoginPage />;
}

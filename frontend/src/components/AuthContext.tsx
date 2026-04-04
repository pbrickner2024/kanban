"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  useSyncExternalStore,
} from "react";
import {
  setAuthToken,
  clearAuthToken,
  isAuthenticated as checkIsAuthenticated,
  subscribeToAuth,
} from "@/lib/auth";
import { loginApi, logoutApi } from "@/lib/api";

type AuthContextValue = {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot
  );
  const isAuthenticated = useSyncExternalStore(
    subscribeToAuth,
    checkIsAuthenticated,
    getServerSnapshot
  );
  const isLoading = !isHydrated;

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const token = await loginApi(username, password);
      setAuthToken(token);
      return true;
    } catch {
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    await logoutApi();
    clearAuthToken();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

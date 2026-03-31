"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  validateCredentials,
  setAuthToken,
  clearAuthToken,
  isAuthenticated as checkIsAuthenticated,
  generateAuthToken,
} from "@/lib/auth";

type AuthContextValue = {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsAuthenticated(checkIsAuthenticated());
    setIsLoading(false);
  }, []);

  const login = (username: string, password: string): boolean => {
    if (validateCredentials(username, password)) {
      const token = generateAuthToken();
      setAuthToken(token);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    clearAuthToken();
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, login, logout, isLoading }}
    >
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

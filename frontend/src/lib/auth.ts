export type AuthContextType = {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
};

const VALID_USERNAME = "user";
const VALID_PASSWORD = "password";
const STORAGE_KEY = "auth_token";

export function validateCredentials(
  username: string,
  password: string
): boolean {
  return username === VALID_USERNAME && password === VALID_PASSWORD;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

export function generateAuthToken(): string {
  return `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

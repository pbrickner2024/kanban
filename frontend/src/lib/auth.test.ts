import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateCredentials,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  isAuthenticated,
  generateAuthToken,
} from "@/lib/auth";

describe("Auth utilities", () => {
  beforeEach(() => {
    // Mock localStorage for tests
    const store: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      length: 0,
      clear: () => {
        Object.keys(store).forEach((key) => delete store[key]);
      },
      key: () => null,
    } as Storage;
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("validateCredentials", () => {
    it("returns true for valid credentials", () => {
      expect(validateCredentials("user", "password")).toBe(true);
    });

    it("returns false for invalid username", () => {
      expect(validateCredentials("admin", "password")).toBe(false);
    });

    it("returns false for invalid password", () => {
      expect(validateCredentials("user", "wrong")).toBe(false);
    });

    it("returns false for empty credentials", () => {
      expect(validateCredentials("", "")).toBe(false);
    });
  });

  describe("Auth token management", () => {
    it("setAuthToken stores a token in localStorage", () => {
      setAuthToken("test_token");
      expect(localStorage.getItem("auth_token")).toBe("test_token");
    });

    it("getAuthToken retrieves a stored token", () => {
      setAuthToken("test_token");
      expect(getAuthToken()).toBe("test_token");
    });

    it("getAuthToken returns null if no token is stored", () => {
      expect(getAuthToken()).toBe(null);
    });

    it("clearAuthToken removes the stored token", () => {
      setAuthToken("test_token");
      clearAuthToken();
      expect(localStorage.getItem("auth_token")).toBe(null);
    });

    it("isAuthenticated returns true if token exists", () => {
      setAuthToken("test_token");
      expect(isAuthenticated()).toBe(true);
    });

    it("isAuthenticated returns false if no token", () => {
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe("generateAuthToken", () => {
    it("generates a unique token each time", () => {
      const token1 = generateAuthToken();
      const token2 = generateAuthToken();
      expect(token1).not.toBe(token2);
    });

    it("token starts with 'token_' prefix", () => {
      const token = generateAuthToken();
      expect(token).toMatch(/^token_\d+_[a-z0-9]+$/);
    });
  });
});

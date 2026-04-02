import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  isAuthenticated,
} from "@/lib/auth";

describe("Auth utilities", () => {
  beforeEach(() => {
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
});

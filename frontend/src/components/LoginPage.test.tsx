import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginPage } from "@/components/LoginPage";
import { AuthProvider, useAuth } from "@/components/AuthContext";

function TestWrapper() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
    <div>Authenticated</div>
  ) : (
    <LoginPage />
  );
}

// Mock fetch: successful login returns a token; anything else rejects.
function mockFetchSuccess() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "test-token-abc" }),
    })
  );
}

function mockFetchFailure() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Invalid credentials" }),
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows demo credentials hint", () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    expect(screen.getByText(/demo credentials/i)).toBeInTheDocument();
  });

  it("displays error for empty credentials", async () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    const button = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(
        screen.getByText(/please enter both username and password/i)
      ).toBeInTheDocument();
    });
  });

  it("displays error for invalid credentials", async () => {
    mockFetchFailure();
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "wrong" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
    });
  });

  it("clears password field on login error", async () => {
    mockFetchFailure();
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "wrong" },
    });
    fireEvent.change(passwordInput, { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(passwordInput.value).toBe("");
    });
  });

  it("successfully logs in with correct credentials", async () => {
    mockFetchSuccess();
    render(
      <AuthProvider>
        <TestWrapper />
      </AuthProvider>
    );
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "user" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText("Authenticated")).toBeInTheDocument();
    });
  });
});

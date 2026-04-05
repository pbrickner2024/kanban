import { describe, it, expect, vi, afterEach } from "vitest";
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
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows a link to create an account", () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    expect(screen.getByRole("button", { name: /create an account/i })).toBeInTheDocument();
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
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();
    });
  });

  it("displays error for invalid credentials", async () => {
    mockFetchFailure();
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "wrong" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
    });
  });

  it("successfully logs in with correct credentials", async () => {
    mockFetchSuccess();
    render(
      <AuthProvider>
        <TestWrapper />
      </AuthProvider>
    );
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText("Authenticated")).toBeInTheDocument();
    });
  });

  it("switches to registration mode", async () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    });
  });

  it("shows error when registration passwords do not match", async () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));
    await waitFor(() => screen.getByLabelText(/confirm password/i));
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newuser" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Login and Authentication Flow", () => {
  test("should show login page on initial load", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await expect(page.locator("h1")).toContainText("Sign In");
    await expect(
      page.locator("input[placeholder='Enter username']")
    ).toBeVisible();
    await expect(
      page.locator("input[placeholder='Enter password']")
    ).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.fill("input[placeholder='Enter username']", "wrong");
    await page.fill("input[placeholder='Enter password']", "wrong");
    await page.click("button:has-text('Sign In')");
    await expect(page.locator("text=Invalid credentials")).toBeVisible();
  });

  test("should show error for empty credentials", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.click("button:has-text('Sign In')");
    await expect(
      page.locator("text=Please enter both username and password")
    ).toBeVisible();
  });

  test("should log in with valid credentials and show Kanban board", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000");
    await page.fill("input[placeholder='Enter username']", "user");
    await page.fill("input[placeholder='Enter password']", "password");
    await page.click("button:has-text('Sign In')");
    await expect(page.locator("h1")).toContainText("Kanban Studio");
    await expect(page.getByText("Backlog", { exact: true }).first()).toBeVisible();
  });

  test("should show Sign Out button after login", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.fill("input[placeholder='Enter username']", "user");
    await page.fill("input[placeholder='Enter password']", "password");
    await page.click("button:has-text('Sign In')");
    await expect(page.locator("button:has-text('Sign Out')")).toBeVisible();
  });

  test("should log out and return to login page", async ({ page }) => {
    await page.goto("http://localhost:3000");
    // Login
    await page.fill("input[placeholder='Enter username']", "user");
    await page.fill("input[placeholder='Enter password']", "password");
    await page.click("button:has-text('Sign In')");
    await expect(page.locator("h1")).toContainText("Kanban Studio");
    // Logout
    await page.click("button:has-text('Sign Out')");
    await expect(page.locator("h1")).toContainText("Sign In");
  });

  test("should persist login state across page reload", async ({ page }) => {
    await page.goto("http://localhost:3000");
    // Login
    await page.fill("input[placeholder='Enter username']", "user");
    await page.fill("input[placeholder='Enter password']", "password");
    await page.click("button:has-text('Sign In')");
    await expect(page.locator("h1")).toContainText("Kanban Studio");
    // Reload
    await page.reload();
    // Should still be logged in
    await expect(page.locator("h1")).toContainText("Kanban Studio");
  });
});

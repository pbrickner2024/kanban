import { test, expect, type Page } from "@playwright/test";

async function loginAndNavigateToBoard(page: Page) {
  await page.goto("http://localhost:3000");
  await page.fill("input[placeholder='Enter username']", "user");
  await page.fill("input[placeholder='Enter password']", "password");
  await page.click("button:has-text('Sign In')");
  await expect(page.locator("h1")).toContainText("Kanban Studio");
}

// Create the waitForResponse promise BEFORE triggering the action to avoid races
function pendingAiResponse(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/api/ai/chat") && response.status() === 200,
    { timeout: 30000 }
  );
}

const textarea = (page: Page) =>
  page.locator("textarea[placeholder='Ask the AI to plan or update the board...']");

const sendButton = (page: Page) => page.locator("button:has-text('Send')");

test.describe("AI Sidebar Flow", () => {
  test("should display AI sidebar on the Kanban board", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await expect(page.locator("text=AI Copilot")).toBeVisible();
    await expect(page.locator("text=Board Assistant")).toBeVisible();
    await expect(page.locator("text=Live")).toBeVisible();
  });

  test("should display quick prompt buttons", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await expect(
      page.locator("button:has-text('Move the top backlog card to Done.')")
    ).toBeVisible();
    await expect(
      page.locator("button:has-text('Create a card in Discovery called User interview prep.')")
    ).toBeVisible();
    await expect(
      page.locator("button:has-text('Rename In Progress to Doing.')")
    ).toBeVisible();
  });

  test("should show initial helper text in chat area", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await expect(
      page.locator(
        "text=Try: \"Move card-1 to Done\" or \"Create a card in Backlog for API docs\"."
      )
    ).toBeVisible();
  });

  test("should display textarea for typing messages", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await expect(textarea(page)).toBeVisible();
  });

  test("should have disabled send button when textarea is empty", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await expect(sendButton(page)).toBeDisabled();
  });

  test("should enable send button when textarea has text", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Create a test card");
    await expect(sendButton(page)).toBeEnabled();
  });

  test("should send a custom message via textarea", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("List my tasks");

    const aiDone = pendingAiResponse(page);
    await sendButton(page).click();

    const response = await aiDone;
    const result = await response.json();
    expect(result).toHaveProperty("reply");
  });

  test("should display user message in chat after sending", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("What is the current status?");

    const aiDone = pendingAiResponse(page);
    await sendButton(page).click();
    await aiDone;

    await expect(
      page.locator("span:has-text('What is the current status?')")
    ).toBeVisible();
  });

  test("should display AI response message in chat", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Hello AI");

    const aiDone = pendingAiResponse(page);
    await sendButton(page).click();
    await aiDone;
    await page.waitForTimeout(300);

    await expect(page.locator("span:has-text('Hello AI')")).toBeVisible();
    const chatSpans = page.locator("aside .space-y-3 span");
    await expect(chatSpans).toHaveCount(2, { timeout: 5000 });
  });

  test("should clear textarea after sending", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Test message");
    await sendButton(page).click();
    // Textarea is cleared immediately on send before awaiting the response
    await expect(textarea(page)).toHaveValue("");
  });

  test("should disable send button while AI is thinking", async ({ page }) => {
    await page.route("**/api/ai/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Think for a moment");
    await sendButton(page).click();
    await expect(sendButton(page)).toBeDisabled();
  });

  test("should show status text while loading", async ({ page }) => {
    await page.route("**/api/ai/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Process this");
    await sendButton(page).click();
    await expect(page.locator("aside p:has-text('Thinking...')")).toBeVisible();
  });

  test("should show applied updates status after AI operation", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Create a new task called E2E test card");

    const aiDone = pendingAiResponse(page);
    await sendButton(page).click();
    await aiDone;
    await page.waitForTimeout(300);

    const statusEl = page.locator("aside p").first();
    await expect(statusEl).not.toHaveText("Thinking...", { timeout: 5000 });
    const text = await statusEl.textContent();
    expect(text).toBeTruthy();
  });

  test("should handle API errors gracefully", async ({ page }) => {
    await page.route("**/api/ai/chat", (route) => route.abort());
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("This will fail");
    await sendButton(page).click();

    await expect(
      page.locator("span:has-text('I could not complete that request right now')")
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show conversation history", async ({ page }) => {
    await loginAndNavigateToBoard(page);

    await textarea(page).fill("First question");
    let aiDone = pendingAiResponse(page);
    await sendButton(page).click();
    await aiDone;
    await page.waitForTimeout(300);

    await textarea(page).fill("Second question");
    aiDone = pendingAiResponse(page);
    await sendButton(page).click();
    await aiDone;
    await page.waitForTimeout(300);

    await expect(page.locator("span:has-text('First question')")).toBeVisible();
    await expect(page.locator("span:has-text('Second question')")).toBeVisible();

    const chatSpans = page.locator("aside .space-y-3 span");
    const count = await chatSpans.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("should send quick prompt when clicked", async ({ page }) => {
    await loginAndNavigateToBoard(page);

    const aiDone = pendingAiResponse(page);
    await page.locator("button:has-text('Rename In Progress to Doing.')").click();
    await aiDone;
    await page.waitForTimeout(300);

    await expect(
      page.locator("aside .space-y-3 span:has-text('Rename In Progress to Doing.')")
    ).toBeVisible();
  });

  test("should disable quick prompts while AI is thinking", async ({ page }) => {
    await page.route("**/api/ai/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });
    await loginAndNavigateToBoard(page);

    const quickPromptButton = page.locator(
      "button:has-text('Rename In Progress to Doing.')"
    );
    const aiDone = pendingAiResponse(page);
    await quickPromptButton.click();

    await expect(quickPromptButton).toBeDisabled();

    await aiDone;
    await page.waitForTimeout(300);

    await expect(quickPromptButton).toBeEnabled({ timeout: 5000 });
  });

  test("should show latest messages in chat after multiple sends", async ({
    page,
  }) => {
    await loginAndNavigateToBoard(page);

    for (let i = 0; i < 3; i++) {
      await textarea(page).fill(`Message ${i + 1}`);
      const aiDone = pendingAiResponse(page);
      await sendButton(page).click();
      await aiDone;
      await page.waitForTimeout(200);
    }

    await expect(page.locator("span:has-text('Message 3')")).toBeVisible();
  });
});

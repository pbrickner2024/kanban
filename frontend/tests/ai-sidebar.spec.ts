import { test, expect, type Page } from "@playwright/test";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatResponse = {
  reply: string;
  kanban_update: {
    operations: Array<{
      action: "rename_column" | "create_card" | "update_card" | "delete_card" | "move_card";
      column_id?: string | null;
      card_id?: string | null;
      title?: string | null;
      details?: string | null;
      position?: number | null;
    }>;
  } | null;
};

type AiMockOptions = {
  abort?: boolean;
  delayMs?: number;
  responder?: (messages: ChatMessage[]) => ChatResponse;
};

function latestUserMessage(messages: ChatMessage[]): string {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function defaultAiResponse(messages: ChatMessage[]): ChatResponse {
  const lastMessage = latestUserMessage(messages);

  return {
    reply: lastMessage ? `Mock reply: ${lastMessage}` : "Mock reply: Ready to help.",
    kanban_update: null,
  };
}

async function mockAiChat(page: Page, options: AiMockOptions = {}) {
  await page.route("**/api/ai/chat", async (route) => {
    if (options.abort) {
      await route.abort();
      return;
    }

    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    const body = route.request().postDataJSON() as { messages?: ChatMessage[] } | null;
    const messages = body?.messages ?? [];
    const response = (options.responder ?? defaultAiResponse)(messages);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

async function mockCreateCardMutation(page: Page) {
  await page.route("**/api/board/columns/*/cards", async (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/");
    const columnId = segments[segments.length - 2];
    const body = route.request().postDataJSON() as { title: string; details?: string };

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "card-e2e-mock",
        column_id: columnId,
        title: body.title,
        details: body.details ?? "",
      }),
    });
  });
}

async function loginAndNavigateToBoard(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Enter username").fill("user");
  await page.getByPlaceholder("Enter password").fill("password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
}

function pendingAiResponse(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/api/ai/chat") && response.status() === 200,
    { timeout: 30000 }
  );
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const textarea = (page: Page) =>
  page.locator("textarea[placeholder='Ask the AI to plan or update the board...']");

const sendButton = (page: Page) => page.getByRole("button", { name: "Send" });

const chatBubble = (page: Page, text: string) =>
  page
    .locator("aside .space-y-3 span")
    .filter({ hasText: new RegExp(`^${escapeRegex(text)}$`) });

const statusText = (page: Page) => page.locator("aside > p");

test.describe("AI Sidebar Flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockAiChat(page);
  });

  test("should display AI sidebar on the Kanban board", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await expect(page.getByText("AI Copilot")).toBeVisible();
    await expect(page.getByText("Board Assistant")).toBeVisible();
    await expect(page.getByText("Live")).toBeVisible();
  });

  test("should display quick prompt buttons", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await expect(
      page.getByRole("button", { name: "Move the top backlog card to Done." })
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Create a card in Discovery called User interview prep.",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Rename In Progress to Doing." })
    ).toBeVisible();
  });

  test("should show initial helper text in chat area", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await expect(
      page.getByText(
        'Try: "Move card-1 to Done" or "Create a card in Backlog for API docs".'
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
    await expect(await response.json()).toEqual({
      reply: "Mock reply: List my tasks",
      kanban_update: null,
    });
  });

  test("should display user message in chat after sending", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("What is the current status?");

    const aiDone = pendingAiResponse(page);
    await sendButton(page).click();
    await aiDone;

    await expect(chatBubble(page, "What is the current status?")).toBeVisible();
  });

  test("should display AI response message in chat", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Hello AI");

    const aiDone = pendingAiResponse(page);
    await sendButton(page).click();
    await aiDone;

    await expect(page.getByText("Mock reply: Hello AI")).toBeVisible();
    await expect(page.locator("aside .space-y-3 span")).toHaveCount(2);
  });

  test("should clear textarea after sending", async ({ page }) => {
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Test message");
    await sendButton(page).click();
    await expect(textarea(page)).toHaveValue("");
  });

  test("should disable send button while AI is thinking", async ({ page }) => {
    await page.unroute("**/api/ai/chat");
    await mockAiChat(page, { delayMs: 1500 });
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Think for a moment");
    await sendButton(page).click();
    await expect(sendButton(page)).toBeDisabled();
    await expect(page.getByText("Mock reply: Think for a moment")).toBeVisible();
  });

  test("should show status text while loading", async ({ page }) => {
    await page.unroute("**/api/ai/chat");
    await mockAiChat(page, { delayMs: 2000 });
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Process this");
    await sendButton(page).click();
    await expect(page.locator("aside p").filter({ hasText: "Thinking..." })).toBeVisible();
    await expect(page.getByText("Mock reply: Process this")).toBeVisible();
  });

  test("should show applied updates status after AI operation", async ({ page }) => {
    await page.unroute("**/api/ai/chat");
    await mockAiChat(page, {
      responder: (messages) => ({
        reply: `Created ${latestUserMessage(messages)}.`,
        kanban_update: {
          operations: [
            {
              action: "create_card",
              column_id: "col-backlog",
              title: "E2E test card",
              details: "Created by mocked AI",
            },
          ],
        },
      }),
    });
    await mockCreateCardMutation(page);
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("Create a new task called E2E test card");

    const aiDone = pendingAiResponse(page);
    await sendButton(page).click();
    await aiDone;

    await expect(statusText(page)).toHaveText("Applied 1 board update.");
  });

  test("should handle API errors gracefully", async ({ page }) => {
    await page.unroute("**/api/ai/chat");
    await mockAiChat(page, { abort: true });
    await loginAndNavigateToBoard(page);
    await textarea(page).fill("This will fail");
    await sendButton(page).click();

    await expect(
      page.getByText("I could not complete that request right now. Please try again.")
    ).toBeVisible();
  });

  test("should show conversation history", async ({ page }) => {
    await loginAndNavigateToBoard(page);

    await textarea(page).fill("First question");
    let aiDone = pendingAiResponse(page);
    await sendButton(page).click();
    await aiDone;

    await textarea(page).fill("Second question");
    aiDone = pendingAiResponse(page);
    await sendButton(page).click();
    await aiDone;

    await expect(chatBubble(page, "First question")).toBeVisible();
    await expect(chatBubble(page, "Mock reply: First question")).toBeVisible();
    await expect(chatBubble(page, "Second question")).toBeVisible();
    await expect(chatBubble(page, "Mock reply: Second question")).toBeVisible();
    await expect(page.locator("aside .space-y-3 span")).toHaveCount(4);
  });

  test("should send quick prompt when clicked", async ({ page }) => {
    await loginAndNavigateToBoard(page);

    const aiDone = pendingAiResponse(page);
    await page.getByRole("button", { name: "Rename In Progress to Doing." }).click();
    await aiDone;

    await expect(chatBubble(page, "Rename In Progress to Doing.")).toBeVisible();
    await expect(chatBubble(page, "Mock reply: Rename In Progress to Doing.")).toBeVisible();
  });

  test("should disable quick prompts while AI is thinking", async ({ page }) => {
    await page.unroute("**/api/ai/chat");
    await mockAiChat(page, { delayMs: 2000 });
    await loginAndNavigateToBoard(page);

    const quickPromptButton = page.getByRole("button", {
      name: "Rename In Progress to Doing.",
    });
    await quickPromptButton.click();

    await expect(quickPromptButton).toBeDisabled();
    await expect(page.getByText("Mock reply: Rename In Progress to Doing.")).toBeVisible();
    await expect(quickPromptButton).toBeEnabled();
  });

  test("should show latest messages in chat after multiple sends", async ({ page }) => {
    await loginAndNavigateToBoard(page);

    for (let i = 0; i < 3; i++) {
      await textarea(page).fill(`Message ${i + 1}`);
      const aiDone = pendingAiResponse(page);
      await sendButton(page).click();
      await aiDone;
    }

    await expect(chatBubble(page, "Message 3")).toBeVisible();
    await expect(chatBubble(page, "Mock reply: Message 3")).toBeVisible();
  });
});

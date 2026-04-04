import { expect, test, type Page } from "@playwright/test";

async function loginAndOpenBoard(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Enter username").fill("user");
  await page.getByPlaceholder("Enter password").fill("password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
}

test("loads the kanban board", async ({ page }) => {
  await loginAndOpenBoard(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await loginAndOpenBoard(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const cardTitle = `Playwright card ${Date.now()}`;
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(cardTitle);
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(cardTitle)).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await loginAndOpenBoard(page);
  const card = page.getByTestId("card-card-1");
  const reviewColumn = page.getByTestId("column-col-review");
  const doneColumn = page.getByTestId("column-col-done");
  const cardAlreadyInReview = (await reviewColumn.getByTestId("card-card-1").count()) > 0;
  const targetColumn = cardAlreadyInReview ? doneColumn : reviewColumn;
  const targetCard = cardAlreadyInReview
    ? page.getByTestId("card-card-7")
    : page.getByTestId("card-card-6");
  const cardBox = await card.boundingBox();
  const targetCardBox = await targetCard.boundingBox();
  if (!cardBox || !targetCardBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  const moveDone = page.waitForResponse(
    (response) =>
      response.url().includes("/api/board/cards/card-1/move") &&
      response.request().method() === "PATCH" &&
      response.status() === 200
  );

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetCardBox.x + targetCardBox.width / 2,
    targetCardBox.y + targetCardBox.height / 2,
    { steps: 16 }
  );
  await page.mouse.up();

  await moveDone;
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

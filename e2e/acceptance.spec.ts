import { E2E_USERS } from "./constants.ts";
import {
  addTransaction,
  createTab,
  expect,
  expectTouchFriendly,
  outstandingCards,
  signIn,
  tap,
  test,
  transactionRows,
} from "./support.ts";

/** TESTING.md → Manual acceptance flow, entirely by tapping. */
test("manual acceptance flow", async ({ page }, testInfo) => {
  await signIn(page, E2E_USERS.bea);
  await page.goto("/tabs/new");
  await expectTouchFriendly(page, "new tab");
  const tab = await createTab(page, `Acceptance ${testInfo.project.name}`, ["Adrian", "Klyde"]);
  await expectTouchFriendly(page, "overview");

  await page.goto(`${tab}/settlements`);
  await expect(page.getByRole("heading", { name: "Nothing to settle yet" })).toBeVisible();

  await addTransaction(page, tab, { description: "Mineral Water", amount: "123.03", from: "Adrian", to: "Klyde" });
  await expectTouchFriendly(page, "transactions");
  await page.goto(`${tab}/settlements`);
  await expect(outstandingCards(page)).toHaveCount(1);
  await expect(outstandingCards(page).first()).toContainText("Adrian");
  await expect(outstandingCards(page).first()).toContainText("₱123.03");

  await addTransaction(page, tab, { description: "Water during Checkout", amount: "100", from: "Klyde", to: "Adrian" });
  await page.goto(`${tab}/settlements`);
  await expect(outstandingCards(page).first()).toContainText("₱23.03");

  // Expand the card: both rows, the reverse one labelled as an offset.
  const card = outstandingCards(page).first();
  await tap(card.locator("summary"));
  await expect(card).toContainText("Mineral Water");
  await expect(card).toContainText("Offset");
  await expectTouchFriendly(page, "settlements, card open");

  await tap(card.getByRole("button", { name: "Record payment" }));
  const sheet = page.locator("dialog[open]");
  await expect(sheet.getByLabel("Amount (₱)")).toHaveValue("23.03");
  await expectTouchFriendly(page, "record payment");
  await tap(sheet.getByRole("button", { name: "Save payment" }));
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  await expect(outstandingCards(page)).toHaveCount(0);
  await expect(page.getByText("Everyone is square.")).toBeVisible();
  await tap(page.locator("summary", { hasText: "Settled (1 pair)" }));
  const settled = page.locator("details.group\\/settled article").first();
  await tap(settled.locator("summary"));
  await expect(settled).toContainText("Mineral Water");
  await expect(settled).toContainText("Payment");

  // History is kept: both expenses and the payment are still listed after the pair settles.
  await page.goto(`${tab}/transactions`);
  await expect(transactionRows(page)).toHaveCount(3);
});

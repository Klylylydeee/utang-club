import type { Page } from "@playwright/test";
import { E2E_USERS } from "./constants.ts";
import { addTransaction, createTab, expect, expectTouchFriendly, isPhoneLayout, signIn, tap, test, transactionRows } from "./support.ts";

/** Deletes a row with whichever surface this viewport shows. */
async function deleteRow(page: Page, description: string) {
  if (await isPhoneLayout(page)) {
    await tap(page.getByRole("list", { name: "Transactions" }).getByRole("button", { name: new RegExp(description) }));
    const sheet = page.locator("dialog[open]");
    await tap(sheet.getByRole("button", { name: "Delete" }));
    await tap(sheet.getByRole("group", { name: "Delete this transaction?" }).getByRole("button", { name: "Delete" }));
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  } else {
    await tap(page.getByRole("button", { name: `Delete ${description}` }));
    await tap(page.getByRole("group", { name: `Confirm deleting ${description}` }).getByRole("button", { name: "Delete" }));
  }
}

/** Deleting keeps the row: Undo right away, or Restore later from "Recently deleted". */
test("delete, undo, then restore from Recently deleted", async ({ page }, testInfo) => {
  await signIn(page, E2E_USERS.bea);
  const tab = await createTab(page, `Deleted ${testInfo.project.name}`, ["Bea", "Dave"]);
  await addTransaction(page, tab, { description: "Ramen", amount: "500", from: "Dave", to: "Bea" });
  await addTransaction(page, tab, { description: "Taxi", amount: "120", from: "Dave", to: "Bea" });

  // Delete, then Undo straight away.
  await deleteRow(page, "Taxi");
  await expect(transactionRows(page)).toHaveCount(1);
  const notice = page.getByRole("status").filter({ hasText: "Deleted “Taxi”." }).filter({ visible: true });
  await expect(notice).toBeVisible();
  await expectTouchFriendly(page, "undo notice");
  await tap(notice.getByRole("button", { name: "Undo" }));
  await expect(transactionRows(page)).toHaveCount(2);
  await expect(page.getByText("Deleted “Taxi”.").filter({ visible: true })).toHaveCount(0);

  // Delete again; the settlement drops it, and the row waits under Recently deleted.
  await deleteRow(page, "Taxi");
  await expect(transactionRows(page)).toHaveCount(1);
  await page.goto(`${tab}/settlements`);
  await expect(page.locator("section[aria-labelledby=outstanding-heading]")).toContainText("₱500.00");

  await page.goto(`${tab}/transactions`);
  const deleted = page.locator("summary", { hasText: "Recently deleted (1 transaction)" });
  await tap(deleted);
  const list = page.getByRole("list", { name: "Deleted transactions" });
  await expect(list).toContainText("Taxi");
  await expect(list).toContainText("Deleted by you on");
  await expectTouchFriendly(page, "recently deleted");
  await tap(list.getByRole("button", { name: "Restore Taxi" }));
  await expect(transactionRows(page)).toHaveCount(2);
  await expect(page.locator("summary", { hasText: "Recently deleted" })).toHaveCount(0);
});

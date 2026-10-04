import { E2E_USERS } from "./constants.ts";
import { addTransaction, createTab, expect, expectTouchFriendly, signIn, test } from "./support.ts";

test("an admin sees another user's tab read-only and can still export it", async ({ page, browser }, testInfo) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signIn(owner, E2E_USERS.bea);
  const tab = await createTab(owner, `Admin view ${testInfo.project.name}`, ["Bea", "Dave"]);
  await addTransaction(owner, tab, { description: "Snacks", amount: "80", from: "Dave", to: "Bea" });
  await ownerContext.close();

  await signIn(page, E2E_USERS.admin);
  await page.goto("/admin");
  await expectTouchFriendly(page, "admin users");
  await page.goto(`${tab}/settlements`);
  await expect(page.getByText("You’re viewing Bea’s tab as an administrator.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share image" })).toBeVisible();
  await expectTouchFriendly(page, "admin view of settlements");
});

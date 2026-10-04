import { E2E_USERS } from "./constants.ts";
import { addTransaction, createTab, expect, expectTouchFriendly, signIn, tap, test, transactionRows } from "./support.ts";

/** D19: the owner shares by email with view or edit access, changes it, and the friend can leave. */
test("share a tab: view only, then edit, then leave", async ({ page, browser }, testInfo) => {
  // Two people on two devices through every section: slow on a cold dev server.
  test.setTimeout(120_000);
  const name = `Shared ${testInfo.project.name}`;
  await signIn(page, E2E_USERS.bea);
  const tab = await createTab(page, name, ["Bea", "Dave"]);
  await addTransaction(page, tab, { description: "Pizza", amount: "450", from: "Dave", to: "Bea" });

  // Owner shares with Dave, view only.
  await page.goto(tab);
  const sharing = page.locator("section[aria-labelledby=sharing-heading]");
  await expect(sharing.getByText("Only you can see this tab.")).toBeVisible();
  await sharing.getByLabel("Friend’s email").fill("nobody@e2e.test");
  await tap(sharing.getByRole("button", { name: "Share" }));
  await expect(sharing.getByText("No account uses that email.")).toBeVisible();
  await sharing.getByLabel("Friend’s email").fill(E2E_USERS.dave.email);
  await tap(sharing.getByRole("button", { name: "Share" }));
  await expect(sharing.getByRole("status")).toContainText("Shared with Dave");
  const daveRow = sharing.getByRole("list", { name: "Shared with" }).getByRole("listitem");
  await expect(daveRow).toContainText(E2E_USERS.dave.email);
  await expect(daveRow.getByLabel("Access for Dave")).toHaveValue("viewer");
  await expectTouchFriendly(page, "sharing panel");

  // Dave, on his own device, finds it under "Shared with you" and can only look.
  const daveContext = await browser.newContext({ ...testInfo.project.use });
  const dave = await daveContext.newPage();
  await signIn(dave, E2E_USERS.dave);
  const sharedList = dave.getByRole("list", { name: "Tabs shared with you" });
  await expect(sharedList).toContainText(name);
  await expect(sharedList).toContainText("Shared by Bea");
  await expect(sharedList).toContainText("View only");
  await expectTouchFriendly(dave, "tab list with shared tabs");
  await tap(sharedList.getByRole("link", { name: new RegExp(name) }));
  await expect(dave.getByText("Bea shared this tab with you.")).toBeVisible();
  await expect(dave.getByText("You can view it, but not change it.")).toBeVisible();
  await expect(dave.getByLabel("Add a person")).toHaveCount(0);
  await expect(dave.locator("section[aria-labelledby=sharing-heading]")).toHaveCount(0);
  await dave.goto(`${tab}/settlements`);
  await expect(dave.getByText("₱450.00").first()).toBeVisible();
  await expect(dave.getByRole("button", { name: "Record payment" })).toHaveCount(0);
  await expect(dave.getByRole("button", { name: "Share image" })).toBeVisible();

  // Owner gives edit access; Dave can now add a transaction, but not rename or share.
  await tap(daveRow.getByLabel("Access for Dave"));
  await daveRow.getByLabel("Access for Dave").selectOption("editor");
  await expect(daveRow.getByLabel("Access for Dave")).toHaveValue("editor");
  await page.waitForTimeout(500); // let the change save before Dave reloads
  await dave.goto(tab);
  await expect(dave.getByText("You can add and change people and transactions.")).toBeVisible();
  await expect(dave.locator("section[aria-labelledby=settings-heading]")).toHaveCount(0);
  await addTransaction(dave, tab, { description: "Drinks", amount: "200", from: "Bea", to: "Dave" });
  await expect(transactionRows(dave)).toHaveCount(2);

  // The owner sees Dave's row.
  await page.goto(`${tab}/transactions`);
  await expect(transactionRows(page)).toHaveCount(2);

  // Dave leaves; the tab is gone from his list and his access ends.
  await dave.goto(tab);
  await tap(dave.getByRole("button", { name: "Remove from my tabs" }));
  await tap(dave.getByRole("group", { name: "Remove this tab from your list?" }).getByRole("button", { name: "Remove" }));
  await expect(dave.getByRole("heading", { name: "Tabs", exact: true })).toBeVisible();
  await expect(dave.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
  expect((await dave.goto(tab))?.status()).toBe(404);
  await daveContext.close();
});

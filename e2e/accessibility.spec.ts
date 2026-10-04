import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { E2E_USERS } from "./constants.ts";
import { addTransaction, createTab, expect, signIn, tap, test } from "./support.ts";

/** WCAG 2.2 A and AA rules from axe; any violation fails with its rule id and the offending elements. */
async function expectNoAxeViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const summary = violations.map((v) => `${v.id}: ${v.nodes.map((node) => node.target.join(" ")).join(", ")}`);
  expect(summary, `axe: ${label}`).toEqual([]);
}

test("signed-out pages meet WCAG AA", async ({ page }) => {
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    await expectNoAxeViolations(page, path);
  }
});

test("main screens meet WCAG AA", async ({ page }, testInfo) => {
  await signIn(page, E2E_USERS.bea);
  await expectNoAxeViolations(page, "tab list");
  await page.goto("/tabs/new");
  await expectNoAxeViolations(page, "new tab");

  const tab = await createTab(page, `A11y ${testInfo.project.name}`, ["Bea", "Dave"]);
  await expectNoAxeViolations(page, "overview");
  await addTransaction(page, tab, { description: "Lunch", amount: "320", from: "Dave", to: "Bea" });
  await expectNoAxeViolations(page, "transactions");

  await page.goto(`${tab}/settlements`);
  await tap(page.locator("section[aria-labelledby=outstanding-heading] summary").first());
  await expectNoAxeViolations(page, "settlements, card open");
  await tap(page.getByRole("button", { name: "Record payment" }));
  await expect(page.locator("dialog[open]")).toBeVisible();
  await expectNoAxeViolations(page, "record payment sheet");
});

test("a tab you may not see is 'not found', with the app bar kept", async ({ browser }, testInfo) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signIn(owner, E2E_USERS.bea);
  const tab = await createTab(owner, `Private ${testInfo.project.name}`, ["Bea"]);
  await ownerContext.close();

  // A page of its own: the browser rightly logs the 404 response, which the
  // console check on the `page` fixture would count as a failure.
  const visitorContext = await browser.newContext({ ...testInfo.project.use });
  const page = await visitorContext.newPage();
  await signIn(page, E2E_USERS.dave);
  const response = await page.goto(tab);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByLabel(`Account: ${E2E_USERS.dave.name}`)).toBeVisible();
  await expect(page).toHaveTitle("Not found · Utang Club");
  await expectNoAxeViolations(page, "not found");
  await visitorContext.close();
});

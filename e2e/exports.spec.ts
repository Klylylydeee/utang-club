import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { E2E_USERS } from "./constants.ts";
import { addTransaction, createTab, expect, expectTouchFriendly, signIn, tap, test } from "./support.ts";

async function tabWithBalances(page: Page, name: string): Promise<string> {
  await signIn(page, E2E_USERS.bea);
  const tab = await createTab(page, name, ["Bea", "Dave", "Kim"]);
  await addTransaction(page, tab, { description: "Ramen", amount: "642.75", from: "Dave", to: "Bea" });
  await addTransaction(page, tab, { description: "=1+1", amount: "100", from: "Kim", to: "Bea" });
  return tab;
}

test("share image: downloads a PNG over plain HTTP", async ({ page }, testInfo) => {
  const tab = await tabWithBalances(page, `Share ${testInfo.project.name}`);
  await page.goto(`${tab}/settlements`);
  await expectTouchFriendly(page, "settlements with export buttons");

  // Over plain HTTP there is no Web Share API, so the button downloads.
  const download = page.waitForEvent("download");
  await tap(page.getByRole("button", { name: "Share image" }));
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^utang-club-share-[a-z]+-\d{4}-\d{2}-\d{2}\.png$/);
  const bytes = await readFile(await file.path());
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  await expect(page.getByRole("button", { name: "Image saved" })).toBeVisible();
});

test("share image and CSV: owner and admin only, 404 for everyone else", async ({ page, browser }, testInfo) => {
  const tab = await tabWithBalances(page, `Access ${testInfo.project.name}`);

  const image = await page.request.get(`${tab}/settlements/image`);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect(image.headers()["cache-control"]).toContain("no-store");

  const csv = await page.request.get(`${tab}/settlements/csv`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text).toContain("Ramen,Expense,Dave,Bea,642.75");
  expect(text).toContain("'=1+1,Expense,Kim,Bea,100.00");
  expect(text).toContain("Dave,Bea,642.75,Outstanding");

  const visitors = [
    { who: "admin", user: E2E_USERS.admin, status: 200 },
    { who: "another user", user: E2E_USERS.dave, status: 404 },
    { who: "signed out", user: null, status: 404 },
  ];
  for (const { who, user, status } of visitors) {
    const context = await browser.newContext();
    const other = await context.newPage();
    if (user) await signIn(other, user);
    for (const kind of ["image", "csv"]) {
      const response = await other.request.get(`${tab}/settlements/${kind}`, { maxRedirects: 0 });
      expect(response.status(), `${kind} for ${who}`).toBe(status);
    }
    await context.close();
  }

  const malformed = await page.request.get("/tabs/not-an-id/settlements/image", { maxRedirects: 0 });
  expect(malformed.status()).toBe(404);
});

test("print layout hides the app chrome and opens every card", async ({ page }, testInfo) => {
  const tab = await tabWithBalances(page, `Print ${testInfo.project.name}`);
  await page.goto(`${tab}/settlements`);
  await expect(page.getByRole("button", { name: "Print or save PDF" })).toBeVisible();

  // Repeats until hydration has attached PrintButton's listener.
  await expect
    .poll(() =>
      page.evaluate(() => {
        window.dispatchEvent(new Event("beforeprint"));
        return [...document.querySelectorAll("main details")].every((d) => (d as HTMLDetailsElement).open);
      }),
    )
    .toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("body > header")).toBeHidden();
  await expect(page.getByRole("button", { name: "Copy summary" })).toBeHidden();
  await expect(page.getByText(/^As of .* · Utang Club$/)).toBeVisible();
  await expect(page.getByText("Ramen").first()).toBeVisible();

  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  expect(await page.locator("main details[open]").count()).toBe(0);
  await expect(page.locator("body > header")).toBeVisible();
});

import { expect, test as base, type Locator, type Page } from "@playwright/test";
import type { E2EUser } from "./constants.ts";

/** Browser noise that says nothing about the app. Keep this list short and exact. */
const BENIGN_CONSOLE = [
  /favicon/,
  // WebKit doesn't know this viewport key (it helps Chromium's on-screen keyboard) and says so.
  /Viewport argument key "interactive-widget" not recognized/,
  // WebKit reports a link prefetch that page.goto() cancelled as an uncaught error like this.
  /\?_rsc=\w+ due to access control checks/,
];

/**
 * Every test fails if the page logs an error or a CSP violation, or throws
 * (TESTING.md: "the console shows no CSP violations or blocked requests").
 */
export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && !BENIGN_CONSOLE.some((pattern) => pattern.test(message.text()))) {
          problems.push(message.text());
        }
      });
      page.on("pageerror", (error) => {
        if (!BENIGN_CONSOLE.some((pattern) => pattern.test(error.message))) problems.push(error.message);
      });
      await use(problems);
      expect(problems, "console errors or CSP violations").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Signs in through the form, by tapping where the device has touch. */
export async function signIn(page: Page, user: E2EUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await tap(page.getByRole("button", { name: "Sign in" }));
  await expect(page.getByRole("heading", { name: "Tabs", exact: true })).toBeVisible();
}

/** Tap on touch devices (the phone projects), click elsewhere. */
export async function tap(locator: Locator) {
  try {
    await locator.tap();
  } catch (error) {
    if (!String(error).includes("does not support tap")) throw error;
    await locator.click();
  }
}

/** True when the page shows the phone layout (list and sheet instead of the table). */
export async function isPhoneLayout(page: Page): Promise<boolean> {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

/** Creates a tab with people and returns its URL (`/tabs/<id>`). */
export async function createTab(page: Page, name: string, people: string[]): Promise<string> {
  await page.goto("/tabs/new");
  await page.getByLabel("Name").fill(name);
  await tap(page.getByRole("button", { name: "Create tab" }));
  // WebKit fires no "load" for in-app navigation: wait for content instead.
  await page.waitForURL(/\/tabs\/[a-f0-9]{24}$/, { waitUntil: "commit" });
  const addPerson = page.getByLabel("Add a person");
  await addPerson.waitFor();
  // The title streams in just after the content on client-side navigation.
  await expect(page).toHaveTitle(`${name} · Utang Club`);
  for (const person of people) {
    await addPerson.fill(person);
    await addPerson.press("Enter");
    await page.getByRole("list", { name: "People in this tab" }).getByText(person, { exact: true }).waitFor();
  }
  return new URL(page.url()).pathname;
}

export type Row = { description: string; amount: string; from: string; to: string; type?: "expense" | "payment" };

/** Adds a transaction with whichever entry surface this viewport shows. */
export async function addTransaction(page: Page, tabPath: string, row: Row) {
  if (!page.url().endsWith(`${tabPath}/transactions`)) await page.goto(`${tabPath}/transactions`);
  if (await isPhoneLayout(page)) {
    const list = page.getByRole("list", { name: "Transactions" });
    const before = await list.locator(":scope > li").count();
    await tap(page.getByRole("button", { name: "Add transaction" }));
    const sheet = page.locator("dialog[open]");
    await sheet.getByLabel("Description").fill(row.description);
    await sheet.getByLabel("Amount (₱)").fill(row.amount);
    await sheet.getByLabel("To pay").selectOption({ label: row.from });
    await sheet.getByLabel("To be paid").selectOption({ label: row.to });
    if (row.type === "payment") await sheet.getByLabel("Type").selectOption("payment");
    await tap(sheet.getByRole("button", { name: "Add", exact: true }));
    await expect(list.locator(":scope > li")).toHaveCount(before + 1);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    return;
  }
  const saved = page.locator("tbody tr[data-row-key]:not([data-entry])");
  const before = await saved.count();
  const entry = page.locator("tr[data-entry]");
  await entry.getByLabel("Description, new row").fill(row.description);
  await entry.getByLabel("Amount in PHP, new row").fill(row.amount);
  await entry.getByLabel("To pay, new row").selectOption({ label: row.from });
  await entry.getByLabel("To be paid, new row").selectOption({ label: row.to });
  await entry.getByLabel("Type, new row").selectOption(row.type ?? "expense");
  await entry.getByLabel("Amount in PHP, new row").press("Enter");
  await expect(saved).toHaveCount(before + 1);
  await expect(page.getByText("Saving")).toHaveCount(0);
}

/** Saved transaction rows in whichever layout is showing. */
export function transactionRows(page: Page): Locator {
  return page
    .locator('ul[aria-label="Transactions"] > li, tbody tr[data-row-key]:not([data-entry])')
    .filter({ visible: true });
}

/** The outstanding settlement cards. */
export function outstandingCards(page: Page): Locator {
  return page.locator("section[aria-labelledby=outstanding-heading] > ul > li");
}

/**
 * UI_SPEC.md touch rules for what's on screen now: every visible link,
 * button, input, select and summary is hit-testable at its centre (nothing
 * covers it) and at least 44px tall, and the page never scrolls sideways.
 * Inside an open dialog only the dialog is checked.
 */
export async function expectTouchFriendly(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const problems: string[] = [];
    const scope: ParentNode = document.querySelector("dialog[open]") ?? document;
    const appBar = document.querySelector("body > header");
    const stickyBottom = appBar && getComputedStyle(appBar).position === "sticky" ? appBar.getBoundingClientRect().bottom : 0;
    for (const el of scope.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, summary")) {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || (el as HTMLButtonElement).disabled) continue;
      if (getComputedStyle(el).visibility === "hidden" || el.closest("[hidden], .sr-only, .hidden")) continue;
      const closedDetails = el.matches("summary") ? el.parentElement?.closest("details:not([open])") : el.closest("details:not([open])");
      if (closedDetails) continue;
      // Only what is on screen now; a control cut off by the bottom edge is checked where its centre shows.
      const centreX = box.left + box.width / 2;
      const centreY = box.top + box.height / 2;
      if (centreY < 0 || centreY > innerHeight || centreX < 0 || centreX > innerWidth) continue;
      // Content scrolled under the sticky app bar is out of reach by design, not covered by mistake.
      if (!el.closest("body > header") && centreY < stickyBottom) continue;
      const hit = document.elementFromPoint(centreX, centreY);
      const covered = !(hit && (hit === el || el.contains(hit)));
      const small = box.height < 43.5 && el.tagName !== "TEXTAREA";
      if (covered || small) {
        const name = (el.getAttribute("aria-label") ?? el.id ?? el.textContent ?? "").trim().slice(0, 30) || el.outerHTML.slice(0, 80);
        const by = covered && hit ? ` covered by <${hit.tagName.toLowerCase()} class="${String(hit.className).slice(0, 60)}">` : "";
        problems.push(`${el.tagName} "${name}"${by}${small ? ` h=${Math.round(box.height)}` : ""}`);
      }
    }
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth) problems.push(`page scrolls sideways (${root.scrollWidth} > ${root.clientWidth})`);
    return problems;
  });
  expect(result, `touch audit: ${label}`).toEqual([]);
}

import { E2E_USERS } from "./constants.ts";
import { addTransaction, createTab, expect, expectTouchFriendly, signIn, test } from "./support.ts";

test("tab sections: no stray scrollbars, nothing wider than the screen", async ({ page }, testInfo) => {
  await signIn(page, E2E_USERS.bea);
  const tab = await createTab(page, `Layout ${testInfo.project.name}`, ["Bea", "Dave"]);
  await addTransaction(page, tab, { description: "Taxi", amount: "250", from: "Dave", to: "Bea" });

  for (const section of ["", "/transactions", "/settlements"]) {
    await page.goto(`${tab}${section}`);
    const nav = page.getByRole("navigation", { name: "Tab sections" });
    await expect(nav).toBeVisible();
    // Regression: the active underline overflowed the nav, which then showed a vertical scrollbar.
    const overflow = await nav.evaluate((el: HTMLElement) => ({
      vertical: el.scrollHeight > el.clientHeight,
      scrollbar: el.offsetHeight - el.clientHeight,
    }));
    expect(overflow, `section nav on ${section || "overview"}`).toEqual({ vertical: false, scrollbar: 0 });
    await expectTouchFriendly(page, `tab ${section || "overview"}`);
  }
});

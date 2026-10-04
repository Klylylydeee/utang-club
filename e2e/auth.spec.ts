import { E2E_USERS } from "./constants.ts";
import { expect, expectTouchFriendly, signIn, tap, test } from "./support.ts";

test("signed-out visitors land on sign-in, which works by touch over plain HTTP", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Created by cly_gvr32")).toBeVisible();
  await expectTouchFriendly(page, "sign-in");

  await page.goto("/tabs/000000000000000000000000/settlements");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("a wrong password gets the generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USERS.dave.email);
  await page.getByLabel("Password").fill("not the password at all");
  await tap(page.getByRole("button", { name: "Sign in" }));
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
});

test("the session survives a reload over HTTP, and sign out ends it", async ({ page }) => {
  await signIn(page, E2E_USERS.bea);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tabs", exact: true })).toBeVisible();
  await expectTouchFriendly(page, "tab list");

  await tap(page.getByLabel(`Account: ${E2E_USERS.bea.name}`));
  await tap(page.getByRole("button", { name: "Sign out" }));
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("anyone can register and starts with no tabs", async ({ page }, testInfo) => {
  await page.goto("/register");
  await expectTouchFriendly(page, "register");
  await page.getByLabel("Your name").fill("New Person");
  await page.getByLabel("Email").fill(`new-${testInfo.project.name}-${Date.now()}@e2e.test`);
  await page.getByLabel("Password", { exact: true }).fill("a long test password");
  await page.getByLabel("Confirm password").fill("a long test password");
  await tap(page.getByRole("button", { name: "Create account" }));
  await expect(page.getByRole("heading", { name: "Tabs", exact: true })).toBeVisible();
});

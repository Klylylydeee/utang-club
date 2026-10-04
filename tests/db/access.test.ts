import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/actions/result";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionRecord, findActiveSession } from "@/lib/auth/sessionStore";
import { recordPayment } from "@/lib/payments/paymentService";
import { getSettlementExport, getSettlements } from "@/lib/settlements/settlementService";
import {
  addPerson,
  createTab,
  deletePerson,
  getTabDetail,
  listTabs,
  listSharedTabs,
  listTabsForUser,
  renamePerson,
  setTabArchived,
  updateTabDetails,
} from "@/lib/tabs/tabService";
import { leaveTab, listTabShares, removeShare, shareTab, updateShare } from "@/lib/tabs/shareService";
import { splitExpense } from "@/lib/transactions/splitService";
import {
  createTransaction,
  deleteTransaction,
  duplicateTransaction,
  listDeletedTransactions,
  listTransactions,
  restoreTransaction,
  updateTransaction,
} from "@/lib/transactions/transactionService";
import {
  findUserForSignIn,
  getUserSummary,
  listUsers,
  registerUser,
  resetUserPassword,
  setUserRole,
  setUserStatus,
} from "@/lib/users/userService";
import { User } from "@/models/User";
import { registerSchema } from "@/schemas/account";
import { recordPaymentSchema } from "@/schemas/payment";
import { shareTabSchema } from "@/schemas/share";
import { splitExpenseSchema } from "@/schemas/split";
import { transactionInputSchema } from "@/schemas/transaction";
import { startTestDatabase } from "../support/mongo";
import { createTestUser } from "../support/users";

let db: Awaited<ReturnType<typeof startTestDatabase>>;

beforeAll(async () => {
  db = await startTestDatabase("access-test");
});
beforeEach(async () => {
  await db.clear();
});
afterAll(async () => {
  await db?.stop();
});

async function expectDomainError(promise: Promise<unknown>, code: DomainError["code"]) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  return error as DomainError;
}

/** Bea's tab with two people and one row, plus Dave (another user) and an admin. */
async function setUp() {
  const bea = await createTestUser("user", "Bea");
  const dave = await createTestUser("user", "Dave");
  const admin = await createTestUser("admin", "Klyde");
  const { id: tabId } = await createTab({ name: "Japan trip", description: undefined }, bea.actor);
  const { id: a } = await addPerson({ tabId, displayName: "Bea" }, bea.actor);
  const { id: b } = await addPerson({ tabId, displayName: "Kim" }, bea.actor);
  const row = await createTransaction(
    transactionInputSchema.parse({ tabId, description: "Ramen", amountPhp: "500", payerId: b, recipientId: a }),
    bea.actor,
  );
  const input = transactionInputSchema.parse({ tabId, description: "Taxi", amountPhp: "100", payerId: b, recipientId: a });
  // A deleted row: hidden from every list and total, but restorable.
  const deletedRow = await createTransaction(
    transactionInputSchema.parse({ tabId, description: "Wrong entry", amountPhp: "999", payerId: b, recipientId: a }),
    bea.actor,
  );
  await deleteTransaction({ transactionId: deletedRow.id }, bea.actor);
  return { bea, dave, admin, tabId, personA: a, personB: b, row, input, deletedRow };
}

describe("another user (no access)", () => {
  it("can't see the tab, its rows or its settlements, and can't tell it exists", async () => {
    const { dave, tabId } = await setUp();
    await expect(getTabDetail(tabId, dave.actor)).resolves.toBeNull();
    await expectDomainError(listTransactions(tabId, dave.actor), "not-found");
    await expectDomainError(getSettlements(tabId, dave.actor), "not-found");
    await expectDomainError(getSettlementExport(tabId, dave.actor), "not-found");
    await expectDomainError(listDeletedTransactions(tabId, dave.actor), "not-found");
    expect(await listTabs(dave.actor)).toEqual([]);
    expect(await listSharedTabs(dave.actor)).toEqual([]);
    await expectDomainError(listTabShares(tabId, dave.actor), "not-found");
    await expectDomainError(listTabsForUser((await setUp()).bea.id, dave.actor), "not-found");
  });

  it("can't change anything in it, even with valid ids", async () => {
    const { dave, tabId, personA, personB, row, input } = await setUp();
    await expectDomainError(updateTabDetails({ tabId, name: "Mine now", description: undefined }, dave.actor), "not-found");
    await expectDomainError(setTabArchived({ tabId, archived: true }, dave.actor), "not-found");
    await expectDomainError(addPerson({ tabId, displayName: "Eve" }, dave.actor), "not-found");
    await expectDomainError(renamePerson({ personId: personA, displayName: "Eve" }, dave.actor), "not-found");
    await expectDomainError(deletePerson({ personId: personA }, dave.actor), "not-found");
    await expectDomainError(createTransaction(input, dave.actor), "not-found");
    await expectDomainError(updateTransaction({ ...input, transactionId: row.id }, dave.actor), "not-found");
    await expectDomainError(deleteTransaction({ transactionId: row.id }, dave.actor), "not-found");
    await expectDomainError(duplicateTransaction({ transactionId: row.id }, dave.actor), "not-found");
    await expectDomainError(restoreTransaction({ transactionId: (await setUp()).deletedRow.id }, dave.actor), "not-found");
    await expectDomainError(
      recordPayment(
        recordPaymentSchema.parse({ tabId, debtorId: personB, creditorId: personA, amountPhp: "1", allowOverpayment: true }),
        dave.actor,
      ),
      "not-found",
    );
    await expectDomainError(
      splitExpense(
        splitExpenseSchema.parse({ tabId, description: "x", amountPhp: "10", payerId: personA, participantIds: [personA, personB] }),
        dave.actor,
      ),
      "not-found",
    );
  });

  it("can't share the tab or leave it", async () => {
    const { dave, admin, tabId } = await setUp();
    await expectDomainError(shareTab(share(tabId, admin.email, "editor"), dave.actor), "not-found");
    await expectDomainError(updateShare({ tabId, userId: admin.id, role: "editor" }, dave.actor), "not-found");
    await expectDomainError(removeShare({ tabId, userId: admin.id }, dave.actor), "not-found");
    await expectDomainError(leaveTab({ tabId }, dave.actor), "not-found");
  });

  it("keeps their own tabs separate", async () => {
    const { bea, dave } = await setUp();
    await createTab({ name: "Dave's dinner", description: undefined }, dave.actor);
    expect((await listTabs(dave.actor)).map((tab) => tab.name)).toEqual(["Dave's dinner"]);
    expect((await listTabs(bea.actor)).map((tab) => tab.name)).toEqual(["Japan trip"]);
  });
});

describe("administrator", () => {
  it("can read anyone's tab, rows and settlements", async () => {
    const { admin, tabId } = await setUp();
    await expect(getTabDetail(tabId, admin.actor)).resolves.toMatchObject({ access: "admin", ownerName: "Bea" });
    await expect(listTransactions(tabId, admin.actor)).resolves.toHaveLength(1); // the deleted row stays hidden
    await expect(listDeletedTransactions(tabId, admin.actor)).resolves.toMatchObject([
      { description: "Wrong entry", deletedBy: { name: "Bea", isYou: false } },
    ]);
    await expect(getSettlements(tabId, admin.actor)).resolves.toMatchObject({ outstanding: [{ amountPhpCentavos: 50000 }] });
    await expect(getSettlementExport(tabId, admin.actor)).resolves.toMatchObject({
      tabName: "Japan trip",
      rows: [{ description: "Ramen" }],
      summary: { outstanding: [{ amountPhpCentavos: 50000 }] },
    });
    expect(await listTabs(admin.actor)).toEqual([]); // their own list stays their own
  });

  it("can list a user's tabs", async () => {
    const { admin, bea } = await setUp();
    expect((await listTabsForUser(bea.id, admin.actor)).map((tab) => tab.name)).toEqual(["Japan trip"]);
  });

  it("can't change someone else's tab (view only, D17)", async () => {
    const { admin, tabId, personA, row, input } = await setUp();
    const error = await expectDomainError(createTransaction(input, admin.actor), "read-only");
    expect(error.message).toContain("can't change");
    await expectDomainError(setTabArchived({ tabId, archived: true }, admin.actor), "read-only");
    await expectDomainError(renamePerson({ personId: personA, displayName: "X" }, admin.actor), "read-only");
    await expectDomainError(deleteTransaction({ transactionId: row.id }, admin.actor), "read-only");
    await expectDomainError(restoreTransaction({ transactionId: (await setUp()).deletedRow.id }, admin.actor), "read-only");
  });

  it("can't manage sharing on someone else's tab", async () => {
    const { admin, dave, tabId } = await setUp();
    await expectDomainError(listTabShares(tabId, admin.actor), "read-only");
    await expectDomainError(shareTab(share(tabId, dave.email, "viewer"), admin.actor), "read-only");
  });

  it("owns and edits their own tabs normally", async () => {
    const { admin } = await setUp();
    const { id } = await createTab({ name: "Admin's tab", description: undefined }, admin.actor);
    await expect(addPerson({ tabId: id, displayName: "Klyde" }, admin.actor)).resolves.toBeDefined();
  });
});

describe("accounts", () => {
  const form = (overrides: Record<string, string> = {}) =>
    registerSchema.parse({
      name: "Bea Santos",
      email: "Bea@Example.com ",
      password: "correct horse battery",
      confirmPassword: "correct horse battery",
      ...overrides,
    });

  it("registers a regular user with a normalized email and a hashed password", async () => {
    const { id, passwordHash } = await registerUser(form());
    const stored = await User.findById(id).lean();
    expect(stored).toMatchObject({ email: "bea@example.com", name: "Bea Santos", role: "user", status: "active" });
    expect(stored?.passwordHash).toBe(passwordHash);
    expect(passwordHash).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery", passwordHash)).resolves.toBe(true);
    await expect(findUserForSignIn("bea@example.com")).resolves.toMatchObject({ id, status: "active" });
  });

  it("rejects a second account with the same email, in any case", async () => {
    await registerUser(form());
    const error = await expectDomainError(registerUser(form({ email: "BEA@example.COM" })), "conflict");
    expect(error.fieldErrors).toHaveProperty("email");
  });

  it("validates the form", () => {
    const issues = (input: Record<string, string>) => {
      const result = registerSchema.safeParse(input);
      return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
    };
    expect(issues({ name: "", email: "nope", password: "short", confirmPassword: "other" })).toEqual(
      expect.arrayContaining(["name", "email", "password"]),
    );
    expect(issues({ name: "B", email: "b@x.co", password: "long enough pass", confirmPassword: "different pass!" })).toEqual([
      "confirmPassword",
    ]);
  });
});

describe("admin user management", () => {
  it("is hidden from regular users", async () => {
    const { bea, dave } = await setUp();
    await expectDomainError(listUsers(bea.actor), "not-found");
    await expectDomainError(getUserSummary(dave.id, bea.actor), "not-found");
    await expectDomainError(setUserStatus({ userId: dave.id, status: "disabled" }, bea.actor), "not-found");
    await expectDomainError(setUserRole({ userId: bea.id, role: "admin" }, bea.actor), "not-found");
  });

  it("lists users with their tab counts and never the password hash", async () => {
    const { admin } = await setUp();
    const users = await listUsers(admin.actor);
    expect(users.map((user) => [user.name, user.tabCount])).toEqual(
      expect.arrayContaining([
        ["Bea", 1],
        ["Dave", 0],
        ["Klyde", 0],
      ]),
    );
    expect(JSON.stringify(users)).not.toContain("scrypt:");
  });

  it("disabling signs the user out and keeps their tabs", async () => {
    const { admin, bea, tabId } = await setUp();
    const { token } = await createSessionRecord(bea);
    await setUserStatus({ userId: bea.id, status: "disabled" }, admin.actor);
    await expect(findActiveSession(token)).resolves.toBeNull();
    await expect(getTabDetail(tabId, admin.actor)).resolves.not.toBeNull();
    await setUserStatus({ userId: bea.id, status: "active" }, admin.actor);
    expect((await getUserSummary(bea.id, admin.actor))?.status).toBe("active");
  });

  it("resetting a password signs the user out and the new password works", async () => {
    const { admin, bea } = await setUp();
    const { token } = await createSessionRecord(bea);
    await resetUserPassword({ userId: bea.id, password: "a brand new password" }, admin.actor);
    await expect(findActiveSession(token)).resolves.toBeNull();
    const user = await User.findById(bea.id).lean();
    await expect(verifyPassword("a brand new password", user!.passwordHash)).resolves.toBe(true);
  });

  it("promotes and demotes others, but never changes their own account", async () => {
    const { admin, dave } = await setUp();
    await setUserRole({ userId: dave.id, role: "admin" }, admin.actor);
    expect((await getUserSummary(dave.id, admin.actor))?.role).toBe("admin");
    await expectDomainError(setUserRole({ userId: admin.id, role: "user" }, admin.actor), "conflict");
    await expectDomainError(setUserStatus({ userId: admin.id, status: "disabled" }, admin.actor), "conflict");
    await expectDomainError(resetUserPassword({ userId: admin.id, password: "whatever password" }, admin.actor), "conflict");
  });
});

function share(tabId: string, email: string, role: "viewer" | "editor") {
  return shareTabSchema.parse({ tabId, email, role });
}

/** Every change inside a tab, as the given actor; each must fail with `code`. */
async function expectNoChanges(
  actor: Awaited<ReturnType<typeof createTestUser>>["actor"],
  ids: Awaited<ReturnType<typeof setUp>>,
  code: DomainError["code"],
) {
  const { tabId, personA, personB, row, input, deletedRow } = ids;
  await expectDomainError(addPerson({ tabId, displayName: "Eve" }, actor), code);
  await expectDomainError(restoreTransaction({ transactionId: deletedRow.id }, actor), code);
  await expectDomainError(renamePerson({ personId: personA, displayName: "Eve" }, actor), code);
  await expectDomainError(deletePerson({ personId: personA }, actor), code);
  await expectDomainError(createTransaction(input, actor), code);
  await expectDomainError(updateTransaction({ ...input, transactionId: row.id }, actor), code);
  await expectDomainError(deleteTransaction({ transactionId: row.id }, actor), code);
  await expectDomainError(duplicateTransaction({ transactionId: row.id }, actor), code);
  await expectDomainError(
    recordPayment(
      recordPaymentSchema.parse({ tabId, debtorId: personB, creditorId: personA, amountPhp: "1", allowOverpayment: true }),
      actor,
    ),
    code,
  );
  await expectDomainError(
    splitExpense(
      splitExpenseSchema.parse({ tabId, description: "x", amountPhp: "10", payerId: personA, participantIds: [personA, personB] }),
      actor,
    ),
    code,
  );
}

/** Tab-level changes: the owner's alone, whatever the share (D19). */
async function expectNoTabManagement(
  actor: Awaited<ReturnType<typeof createTestUser>>["actor"],
  ids: Awaited<ReturnType<typeof setUp>>,
) {
  const { tabId, admin } = ids;
  await expectDomainError(updateTabDetails({ tabId, name: "Mine now", description: undefined }, actor), "read-only");
  await expectDomainError(setTabArchived({ tabId, archived: true }, actor), "read-only");
  await expectDomainError(listTabShares(tabId, actor), "read-only");
  await expectDomainError(shareTab(share(tabId, admin.email, "editor"), actor), "read-only");
  await expectDomainError(updateShare({ tabId, userId: admin.id, role: "editor" }, actor), "read-only");
  await expectDomainError(removeShare({ tabId, userId: admin.id }, actor), "read-only");
}

describe("shared with view access (D19)", () => {
  it("can read the tab, its rows, settlements and exports, and finds it under Shared with you", async () => {
    const ids = await setUp();
    const { bea, dave, tabId } = ids;
    await shareTab(share(tabId, dave.email, "viewer"), bea.actor);

    await expect(getTabDetail(tabId, dave.actor)).resolves.toMatchObject({ access: "viewer", ownerName: "Bea", ownerId: null });
    await expect(listTransactions(tabId, dave.actor)).resolves.toHaveLength(1);
    await expect(getSettlements(tabId, dave.actor)).resolves.toMatchObject({ outstanding: [{ amountPhpCentavos: 50000 }] });
    await expect(getSettlementExport(tabId, dave.actor)).resolves.toMatchObject({ tabName: "Japan trip" });
    await expect(listDeletedTransactions(tabId, dave.actor)).resolves.toHaveLength(1);
    expect(await listSharedTabs(dave.actor)).toMatchObject([{ id: tabId, name: "Japan trip", ownerName: "Bea", role: "viewer" }]);
    expect(await listTabs(dave.actor)).toEqual([]); // not theirs
  });

  it("can't change anything", async () => {
    const ids = await setUp();
    await shareTab(share(ids.tabId, ids.dave.email, "viewer"), ids.bea.actor);
    await expectNoChanges(ids.dave.actor, ids, "read-only");
    await expectNoTabManagement(ids.dave.actor, ids);
    const error = await expectDomainError(createTransaction(ids.input, ids.dave.actor), "read-only");
    expect(error.message).toContain("Ask its owner for edit access");
  });
});

describe("shared with edit access (D19)", () => {
  it("can change everything inside the tab", async () => {
    const { bea, dave, tabId, personA, personB, row, input, deletedRow } = await setUp();
    await shareTab(share(tabId, dave.email, "editor"), bea.actor);
    await restoreTransaction({ transactionId: deletedRow.id }, dave.actor);
    await deleteTransaction({ transactionId: deletedRow.id }, dave.actor);

    await expect(getTabDetail(tabId, dave.actor)).resolves.toMatchObject({ access: "editor", ownerName: "Bea" });
    const { id: carol } = await addPerson({ tabId, displayName: "Carol" }, dave.actor);
    await renamePerson({ personId: carol, displayName: "Caroline" }, dave.actor);
    await deletePerson({ personId: carol }, dave.actor);
    const added = await createTransaction(input, dave.actor);
    await updateTransaction({ ...input, transactionId: row.id, description: "Ramen bar" }, dave.actor);
    await duplicateTransaction({ transactionId: added.id }, dave.actor);
    await deleteTransaction({ transactionId: added.id }, dave.actor);
    await recordPayment(
      recordPaymentSchema.parse({ tabId, debtorId: personB, creditorId: personA, amountPhp: "100", allowOverpayment: false }),
      dave.actor,
    );
    await splitExpense(
      splitExpenseSchema.parse({ tabId, description: "Snacks", amountPhp: "10", payerId: personA, participantIds: [personA, personB] }),
      dave.actor,
    );
    // The owner sees the editor's work.
    const rows = await listTransactions(tabId, bea.actor);
    const descriptions = rows.map((r) => r.description);
    expect(descriptions).toContain("Ramen bar");
    expect(descriptions).toContain("Snacks");
    expect(rows.filter((r) => r.type === "payment")).toHaveLength(1);
    expect(rows).toHaveLength(4); // Ramen bar, the duplicated Taxi, the payment, and the split row
  });

  it("can't rename, archive or share the tab", async () => {
    const ids = await setUp();
    await shareTab(share(ids.tabId, ids.dave.email, "editor"), ids.bea.actor);
    await expectNoTabManagement(ids.dave.actor, ids);
    const error = await expectDomainError(setTabArchived({ tabId: ids.tabId, archived: true }, ids.dave.actor), "read-only");
    expect(error.message).toBe("Only the tab's owner can do this.");
  });

  it("is read-only while the tab is archived", async () => {
    const ids = await setUp();
    await shareTab(share(ids.tabId, ids.dave.email, "editor"), ids.bea.actor);
    await setTabArchived({ tabId: ids.tabId, archived: true }, ids.bea.actor);
    await expectNoChanges(ids.dave.actor, ids, "read-only");
  });

  it("gives an admin edit access to that one tab", async () => {
    const ids = await setUp();
    await shareTab(share(ids.tabId, ids.admin.email, "editor"), ids.bea.actor);
    await expect(getTabDetail(ids.tabId, ids.admin.actor)).resolves.toMatchObject({ access: "editor" });
    await expect(createTransaction(ids.input, ids.admin.actor)).resolves.toBeDefined();
  });
});

describe("managing shares (D19)", () => {
  it("lets the owner share, change access and stop sharing, taking effect at once", async () => {
    const ids = await setUp();
    const { bea, dave, tabId, input } = ids;
    const shared = await shareTab(share(tabId, dave.email.toUpperCase(), "viewer"), bea.actor);
    expect(shared).toMatchObject({ userId: dave.id, name: "Dave", email: dave.email, role: "viewer" });
    expect(await listTabShares(tabId, bea.actor)).toEqual([shared]);

    await updateShare({ tabId, userId: dave.id, role: "editor" }, bea.actor);
    await expect(createTransaction(input, dave.actor)).resolves.toBeDefined();
    await updateShare({ tabId, userId: dave.id, role: "viewer" }, bea.actor);
    await expectDomainError(createTransaction(input, dave.actor), "read-only");

    await removeShare({ tabId, userId: dave.id }, bea.actor);
    await expect(getTabDetail(tabId, dave.actor)).resolves.toBeNull();
    expect(await listSharedTabs(dave.actor)).toEqual([]);
    await expectDomainError(updateShare({ tabId, userId: dave.id, role: "editor" }, bea.actor), "not-found");
  });

  it("works on an archived tab", async () => {
    const { bea, dave, tabId } = await setUp();
    await setTabArchived({ tabId, archived: true }, bea.actor);
    await expect(shareTab(share(tabId, dave.email, "viewer"), bea.actor)).resolves.toMatchObject({ role: "viewer" });
  });

  it("refuses unknown and disabled accounts with the same message, the owner, and duplicates", async () => {
    const { bea, dave, admin, tabId } = await setUp();
    const unknown = await expectDomainError(shareTab(share(tabId, "nobody@example.test", "viewer"), bea.actor), "not-found");
    expect(unknown.fieldErrors?.email).toContain("No account uses that email");

    await setUserStatus({ userId: dave.id, status: "disabled" }, admin.actor);
    const disabled = await expectDomainError(shareTab(share(tabId, dave.email, "viewer"), bea.actor), "not-found");
    expect(disabled.message).toBe(unknown.message);
    await setUserStatus({ userId: dave.id, status: "active" }, admin.actor);

    await expectDomainError(shareTab(share(tabId, bea.email, "viewer"), bea.actor), "conflict");
    await shareTab(share(tabId, dave.email, "viewer"), bea.actor);
    await expectDomainError(shareTab(share(tabId, dave.email, "editor"), bea.actor), "conflict");
  });

  it("lets someone leave a tab shared with them, but not the owner", async () => {
    const { bea, dave, tabId } = await setUp();
    await shareTab(share(tabId, dave.email, "editor"), bea.actor);
    await leaveTab({ tabId }, dave.actor);
    await expect(getTabDetail(tabId, dave.actor)).resolves.toBeNull();
    await expectDomainError(leaveTab({ tabId }, bea.actor), "conflict");
  });
});

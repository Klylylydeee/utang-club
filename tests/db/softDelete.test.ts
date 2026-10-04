import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/actions/result";
import { getSettlements } from "@/lib/settlements/settlementService";
import { shareTab } from "@/lib/tabs/shareService";
import { addPerson, createTab, deletePerson, getTabDetail, listTabs, setTabArchived } from "@/lib/tabs/tabService";
import {
  createTransaction,
  deleteTransaction,
  duplicateTransaction,
  listDeletedTransactions,
  listTransactions,
  restoreTransaction,
  updateTransaction,
} from "@/lib/transactions/transactionService";
import { Transaction } from "@/models/Transaction";
import { shareTabSchema } from "@/schemas/share";
import { transactionInputSchema } from "@/schemas/transaction";
import { startTestDatabase } from "../support/mongo";
import { createTestUser } from "../support/users";

let db: Awaited<ReturnType<typeof startTestDatabase>>;

beforeAll(async () => {
  db = await startTestDatabase("soft-delete-test");
});
beforeEach(async () => {
  await db.clear();
});
afterAll(async () => {
  await db?.stop();
});

async function setUp() {
  const bea = await createTestUser("user", "Bea");
  const dave = await createTestUser("user", "Dave");
  const { id: tabId } = await createTab({ name: "Trip", description: undefined }, bea.actor);
  const { id: beaPerson } = await addPerson({ tabId, displayName: "Bea" }, bea.actor);
  const { id: kim } = await addPerson({ tabId, displayName: "Kim" }, bea.actor);
  await shareTab(shareTabSchema.parse({ tabId, email: dave.email, role: "editor" }), bea.actor);
  const input = (description: string, amountPhp: string, payerId = kim) =>
    transactionInputSchema.parse({ tabId, description, amountPhp, payerId, recipientId: beaPerson });
  return { bea, dave, tabId, beaPerson, kim, input };
}

async function expectCode(promise: Promise<unknown>, code: DomainError["code"]) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  return error as DomainError;
}

describe("deleting a transaction", () => {
  it("keeps the row, records who deleted it, and drops it from every total", async () => {
    const { bea, dave, tabId, input } = await setUp();
    await createTransaction(input("Ramen", "500"), bea.actor);
    const taxi = await createTransaction(input("Taxi", "100"), bea.actor);
    await deleteTransaction({ transactionId: taxi.id }, dave.actor);

    const stored = await Transaction.findById(taxi.id).lean();
    expect(stored).toMatchObject({ description: "Taxi", amountPhpCentavos: 10000 });
    expect(stored?.deletedAt).toBeInstanceOf(Date);
    expect(stored?.deletedBy?.toString()).toBe(dave.id);

    expect((await listTransactions(tabId, bea.actor)).map((row) => row.description)).toEqual(["Ramen"]);
    expect((await getSettlements(tabId, bea.actor)).outstanding[0].amountPhpCentavos).toBe(50000);
    expect((await getTabDetail(tabId, bea.actor))?.tab.transactionCount).toBe(1);
    expect((await listTabs(bea.actor))[0].transactionCount).toBe(1);
    expect((await getTabDetail(tabId, bea.actor))?.people.find((p) => p.displayName === "Kim")?.transactionCount).toBe(1);

    expect(await listDeletedTransactions(tabId, bea.actor)).toMatchObject([
      { description: "Taxi", addedBy: { name: "Bea", isYou: true }, deletedBy: { name: "Dave", isYou: false } },
    ]);
  });

  it("can't edit, duplicate or delete a deleted row", async () => {
    const { bea, input } = await setUp();
    const row = await createTransaction(input("Taxi", "100"), bea.actor);
    await deleteTransaction({ transactionId: row.id }, bea.actor);
    await expectCode(updateTransaction({ ...input("Taxi", "200"), transactionId: row.id }, bea.actor), "not-found");
    await expectCode(duplicateTransaction({ transactionId: row.id }, bea.actor), "not-found");
    await expectCode(deleteTransaction({ transactionId: row.id }, bea.actor), "not-found");
  });
});

describe("restoring a transaction", () => {
  it("brings it back as it was, without counting as an edit", async () => {
    const { bea, dave, tabId, input } = await setUp();
    const row = await createTransaction(input("Taxi", "100"), bea.actor);
    await deleteTransaction({ transactionId: row.id }, bea.actor);
    await restoreTransaction({ transactionId: row.id }, dave.actor);

    const [restored] = await listTransactions(tabId, bea.actor);
    expect(restored).toMatchObject({ id: row.id, description: "Taxi", amountPhpCentavos: 10000, editedBy: null });
    expect(restored.addedBy).toEqual({ name: "Bea", isYou: true });
    expect(await listDeletedTransactions(tabId, bea.actor)).toEqual([]);
    const stored = await Transaction.findById(row.id).lean();
    expect(stored?.deletedAt).toBeUndefined();
    expect(stored?.deletedBy).toBeUndefined();
  });

  it("refuses a row that isn't deleted, and an archived tab", async () => {
    const { bea, tabId, input } = await setUp();
    const row = await createTransaction(input("Taxi", "100"), bea.actor);
    await expectCode(restoreTransaction({ transactionId: row.id }, bea.actor), "not-found");
    await deleteTransaction({ transactionId: row.id }, bea.actor);
    await setTabArchived({ tabId, archived: true }, bea.actor);
    await expectCode(restoreTransaction({ transactionId: row.id }, bea.actor), "read-only");
  });
});

describe("people in deleted rows", () => {
  it("can't be removed, so a restore never points at a missing person", async () => {
    const { bea, tabId, input } = await setUp();
    const { id: carol } = await addPerson({ tabId, displayName: "Carol" }, bea.actor);
    const row = await createTransaction(input("Boat", "300", carol), bea.actor);
    await deleteTransaction({ transactionId: row.id }, bea.actor);

    const error = await expectCode(deletePerson({ personId: carol }, bea.actor), "in-use");
    expect(error.message).toContain("deleted transactions, which can still be restored");

    // Someone in no rows at all can still be removed.
    const { id: eve } = await addPerson({ tabId, displayName: "Eve" }, bea.actor);
    await expect(deletePerson({ personId: eve }, bea.actor)).resolves.toEqual({ tabId });
  });
});

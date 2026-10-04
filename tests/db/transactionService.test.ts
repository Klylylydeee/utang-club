import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/actions/result";
import { addPerson, createTab, deletePerson, getTabDetail, setTabArchived } from "@/lib/tabs/tabService";
import {
  createTransaction,
  deleteTransaction,
  duplicateTransaction,
  listTransactions,
  updateTransaction,
} from "@/lib/transactions/transactionService";
import { transactionInputSchema, transactionUpdateSchema, type TransactionFormInput } from "@/schemas/transaction";
import { startTestDatabase } from "../support/mongo";

let db: Awaited<ReturnType<typeof startTestDatabase>>;

beforeAll(async () => {
  db = await startTestDatabase("transactions-test");
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

/** A tab with Adrian and Klyde, plus a parser for rows typed into it. */
async function setUp() {
  const { id: tabId } = await createTab({ name: "October 2026", description: undefined });
  const { id: adrian } = await addPerson({ tabId, displayName: "Adrian" });
  const { id: klyde } = await addPerson({ tabId, displayName: "Klyde" });
  const input = (overrides: Partial<TransactionFormInput> = {}) =>
    transactionInputSchema.parse({
      tabId,
      description: "Mineral Water",
      amountPhp: "123.03",
      payerId: adrian,
      recipientId: klyde,
      ...overrides,
    });
  return { tabId, adrian, klyde, input };
}

describe("createTransaction", () => {
  it("stores a row and lists it back in entry order", async () => {
    const { tabId, adrian, klyde, input } = await setUp();
    const first = await createTransaction(input());
    const second = await createTransaction(input({ description: "Taxi", amountPhp: "1,301" }));

    expect(first).toMatchObject({
      type: "expense",
      description: "Mineral Water",
      amountPhpCentavos: 12303,
      payerId: adrian,
      recipientId: klyde,
      foreignCurrency: null,
      foreignAmountMinor: null,
      transactionDate: null,
      notes: null,
    });
    const rows = await listTransactions(tabId);
    expect(rows.map((row) => row.id)).toEqual([first.id, second.id]);
    expect(rows[1].amountPhpCentavos).toBe(130100);
  });

  it("keeps foreign amounts, dates and notes", async () => {
    const { input } = await setUp();
    const row = await createTransaction(
      input({ foreignCurrency: "jpy", foreignAmount: "1500", transactionDate: "2026-10-04", notes: "Lawson" }),
    );
    expect(row).toMatchObject({
      foreignCurrency: "JPY",
      foreignAmountMinor: 1500,
      transactionDate: "2026-10-04",
      notes: "Lawson",
    });
  });

  it("allows duplicate descriptions", async () => {
    const { tabId, input } = await setUp();
    await createTransaction(input());
    await createTransaction(input());
    expect(await listTransactions(tabId)).toHaveLength(2);
  });

  it("rejects a person from a different tab, naming the field", async () => {
    const { input } = await setUp();
    const { id: otherTab } = await createTab({ name: "Other", description: undefined });
    const { id: stranger } = await addPerson({ tabId: otherTab, displayName: "Simon" });

    const error = await expectDomainError(createTransaction(input({ recipientId: stranger })), "validation");
    expect(error.fieldErrors).toEqual({ recipientId: "Choose someone in this tab" });

    const both = await expectDomainError(
      createTransaction(input({ payerId: stranger, recipientId: "65a0000000000000000000ee" })),
      "validation",
    );
    expect(Object.keys(both.fieldErrors ?? {}).sort()).toEqual(["payerId", "recipientId"]);
  });

  it("rejects writes to an archived tab (D6) and an unknown tab", async () => {
    const { tabId, input } = await setUp();
    await setTabArchived({ tabId, archived: true });
    await expectDomainError(createTransaction(input()), "read-only");
    await expectDomainError(createTransaction(input({ tabId: "65a0000000000000000000ff" })), "not-found");
  });

  it("counts toward the tab and blocks removing people in use (D5)", async () => {
    const { tabId, adrian, input } = await setUp();
    await createTransaction(input());
    const detail = await getTabDetail(tabId);
    expect(detail?.tab.transactionCount).toBe(1);
    expect(detail?.people.map((person) => person.transactionCount)).toEqual([1, 1]);
    await expectDomainError(deletePerson({ personId: adrian }), "in-use");
  });
});

describe("updateTransaction", () => {
  it("replaces every field, clearing optional ones that were removed", async () => {
    const { tabId, adrian, klyde, input } = await setUp();
    const row = await createTransaction(input({ foreignCurrency: "USD", foreignAmount: "2.46", notes: "note" }));

    const updated = await updateTransaction(
      transactionUpdateSchema.parse({
        transactionId: row.id,
        tabId,
        type: "payment",
        description: "Paid back",
        amountPhp: "100",
        payerId: klyde,
        recipientId: adrian,
      }),
    );

    expect(updated).toMatchObject({
      id: row.id,
      type: "payment",
      description: "Paid back",
      amountPhpCentavos: 10000,
      payerId: klyde,
      recipientId: adrian,
      foreignCurrency: null,
      foreignAmountMinor: null,
      notes: null,
      createdAt: row.createdAt,
    });
    expect(await listTransactions(tabId)).toEqual([updated]);
  });

  it("can't move a row to another tab or use people from another tab", async () => {
    const { tabId, klyde, input } = await setUp();
    const row = await createTransaction(input());
    const other = await setUp();

    await expectDomainError(
      updateTransaction({ ...input({ tabId: other.tabId, payerId: other.adrian, recipientId: other.klyde }), transactionId: row.id }),
      "not-found",
    );
    const error = await expectDomainError(
      updateTransaction({ ...input({ payerId: other.adrian, recipientId: klyde }), transactionId: row.id }),
      "validation",
    );
    expect(error.fieldErrors).toEqual({ payerId: "Choose someone in this tab" });
    expect(await listTransactions(tabId)).toEqual([row]);
  });

  it("rejects edits to an archived tab and to a deleted row", async () => {
    const { tabId, input } = await setUp();
    const row = await createTransaction(input());
    await setTabArchived({ tabId, archived: true });
    await expectDomainError(updateTransaction({ ...input(), transactionId: row.id }), "read-only");
    await setTabArchived({ tabId, archived: false });
    await deleteTransaction({ transactionId: row.id });
    await expectDomainError(updateTransaction({ ...input(), transactionId: row.id }), "not-found");
  });
});

describe("deleteTransaction and duplicateTransaction", () => {
  it("deletes only the chosen row", async () => {
    const { tabId, input } = await setUp();
    const keep = await createTransaction(input());
    const remove = await createTransaction(input({ description: "Taxi" }));
    await expect(deleteTransaction({ transactionId: remove.id })).resolves.toEqual({ tabId });
    expect(await listTransactions(tabId)).toEqual([keep]);
    await expectDomainError(deleteTransaction({ transactionId: remove.id }), "not-found");
  });

  it("duplicates the saved values into a new row at the end", async () => {
    const { tabId, input } = await setUp();
    const original = await createTransaction(input({ foreignCurrency: "USD", foreignAmount: "2.46" }));
    await createTransaction(input({ description: "Taxi" }));

    const copy = await duplicateTransaction({ transactionId: original.id });
    expect(copy.id).not.toBe(original.id);
    expect(copy.tabId).toBe(tabId);
    expect({ ...copy, id: original.id, createdAt: original.createdAt, tabId: undefined }).toEqual({
      ...original,
      tabId: undefined,
    });
    expect((await listTransactions(tabId)).at(-1)?.id).toBe(copy.id);
  });

  it("refuses both on an archived tab", async () => {
    const { tabId, input } = await setUp();
    const row = await createTransaction(input());
    await setTabArchived({ tabId, archived: true });
    await expectDomainError(deleteTransaction({ transactionId: row.id }), "read-only");
    await expectDomainError(duplicateTransaction({ transactionId: row.id }), "read-only");
    expect(await listTransactions(tabId)).toHaveLength(1);
  });
});

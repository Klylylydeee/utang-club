import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/actions/result";
import { recordPayment } from "@/lib/payments/paymentService";
import { getSettlements } from "@/lib/settlements/settlementService";
import { addPerson, createTab, setTabArchived } from "@/lib/tabs/tabService";
import { splitExpense } from "@/lib/transactions/splitService";
import { createTransaction, listTransactions } from "@/lib/transactions/transactionService";
import { recordPaymentSchema, type RecordPaymentFormInput } from "@/schemas/payment";
import { splitExpenseSchema, type SplitExpenseFormInput } from "@/schemas/split";
import { transactionInputSchema } from "@/schemas/transaction";
import type { Actor } from "@/lib/auth/actor";
import { startTestDatabase } from "../support/mongo";
import { createTestUser } from "../support/users";

let db: Awaited<ReturnType<typeof startTestDatabase>>;

beforeAll(async () => {
  db = await startTestDatabase("payments-test");
});
let owner: Actor;

beforeEach(async () => {
  await db.clear();
  owner = (await createTestUser()).actor;
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

async function setUp() {
  const { id: tabId } = await createTab({ name: "October 2026", description: undefined }, owner);
  // Added out of name order on purpose; splits must use display-name order.
  const { id: simon } = await addPerson({ tabId, displayName: "Simon" }, owner);
  const { id: klyde } = await addPerson({ tabId, displayName: "Klyde" }, owner);
  const { id: adrian } = await addPerson({ tabId, displayName: "Adrian" }, owner);
  const expense = (payerId: string, recipientId: string, amountPhp: string) =>
    createTransaction(transactionInputSchema.parse({ tabId, description: "Expense", amountPhp, payerId, recipientId }), owner);
  const pay = (overrides: Partial<RecordPaymentFormInput>) =>
    recordPayment(recordPaymentSchema.parse({ tabId, debtorId: adrian, creditorId: klyde, amountPhp: "0", ...overrides }), owner);
  const split = (overrides: Partial<SplitExpenseFormInput>) =>
    splitExpense(
      splitExpenseSchema.parse({
        tabId,
        description: "Dinner",
        amountPhp: "100",
        payerId: klyde,
        participantIds: [simon, klyde, adrian],
        ...overrides,
      }), owner);
  return { tabId, adrian, klyde, simon, expense, pay, split };
}

describe("recordPayment", () => {
  it("criterion 5: a full payment settles the pair and keeps every row", async () => {
    const { tabId, adrian, klyde, expense, pay } = await setUp();
    await expense(adrian, klyde, "3,885.10");

    const payment = await pay({ amountPhp: "3,885.10" });
    expect(payment).toMatchObject({ type: "payment", payerId: adrian, recipientId: klyde, amountPhpCentavos: 388510, description: "Payment" });

    const summary = await getSettlements(tabId, owner);
    expect(summary.outstanding).toEqual([]);
    expect(summary.settled[0].lines.map((line) => line.type)).toEqual(["expense", "payment"]);
    expect(await listTransactions(tabId, owner)).toHaveLength(2);
  });

  it("a partial payment reduces what is outstanding", async () => {
    const { tabId, adrian, klyde, expense, pay } = await setUp();
    await expense(adrian, klyde, "123.03");
    await expense(klyde, adrian, "100");
    await pay({ amountPhp: "20", description: "GCash" });
    const [card] = (await getSettlements(tabId, owner)).outstanding;
    expect(card).toMatchObject({ debtor: { id: adrian }, amountPhpCentavos: 303 });
    expect(card.lines.at(-1)).toMatchObject({ description: "GCash", type: "payment" });
  });

  it("refuses an overpayment until it is confirmed (D1), then flips the balance", async () => {
    const { tabId, adrian, klyde, expense, pay } = await setUp();
    await expense(adrian, klyde, "23.03");

    const error = await expectDomainError(pay({ amountPhp: "30" }), "conflict");
    expect(error.fieldErrors?.amountPhp).toContain("₱23.03 outstanding");
    expect(await listTransactions(tabId, owner)).toHaveLength(1);

    await pay({ amountPhp: "30", allowOverpayment: true });
    expect((await getSettlements(tabId, owner)).outstanding[0]).toMatchObject({
      debtor: { id: klyde },
      creditor: { id: adrian },
      amountPhpCentavos: 697,
    });
  });

  it("warns when nothing is owed in that direction", async () => {
    const { adrian, klyde, expense, pay } = await setUp();
    await expense(klyde, adrian, "50");
    const error = await expectDomainError(pay({ amountPhp: "10" }), "conflict");
    expect(error.message).toContain("Nothing is owed in this direction");
  });

  it("checks people and archived tabs like any other write", async () => {
    const { tabId, adrian, klyde, expense, pay } = await setUp();
    await expense(adrian, klyde, "10");
    const other = await setUp();
    await expectDomainError(pay({ creditorId: other.klyde, amountPhp: "1", allowOverpayment: true }), "validation");
    await setTabArchived({ tabId, archived: true }, owner);
    await expectDomainError(pay({ amountPhp: "1" }), "read-only");
  });
});

describe("splitExpense", () => {
  it("rule example: ₱100 between Adrian, Klyde and Simon, Klyde paid", async () => {
    const { tabId, adrian, klyde, simon, split } = await setUp();
    await expect(split({})).resolves.toEqual({ created: 2 });

    const rows = await listTransactions(tabId, owner);
    expect(rows.map((row) => [row.payerId, row.recipientId, row.amountPhpCentavos, row.type, row.description])).toEqual([
      [adrian, klyde, 3334, "expense", "Dinner"],
      [simon, klyde, 3333, "expense", "Dinner"],
    ]);
    expect(rows[0].notes).toBe("Split of ₱100.00 between 3 people, paid by Klyde");

    const { outstanding } = await getSettlements(tabId, owner);
    expect(outstanding.map((card) => [card.debtor.displayName, card.amountPhpCentavos])).toEqual([
      ["Adrian", 3334],
      ["Simon", 3333],
    ]);
  });

  it("works without the payer as a participant", async () => {
    const { tabId, adrian, simon, split } = await setUp();
    await split({ amountPhp: "3,000", participantIds: [adrian, simon] });
    expect((await listTransactions(tabId, owner)).map((row) => row.amountPhpCentavos)).toEqual([150000, 150000]);
  });

  it("rejects bad splits with field errors and writes nothing", async () => {
    const { tabId, klyde, split } = await setUp();
    const onlyPayer = await expectDomainError(split({ participantIds: [klyde] }), "validation");
    expect(onlyPayer.fieldErrors).toHaveProperty("participantIds");
    const tooSmall = await expectDomainError(split({ amountPhp: "0.02" }), "validation");
    expect(tooSmall.fieldErrors?.amountPhp).toBe("Too small to split between 3 people");
    const other = await setUp();
    const stranger = await expectDomainError(split({ participantIds: [klyde, other.adrian] }), "validation");
    expect(stranger.fieldErrors).toHaveProperty("participantIds");
    expect(await listTransactions(tabId, owner)).toEqual([]);
  });

  it("validates input shape", () => {
    const base = { tabId: "65a0000000000000000000ff", description: "x", amountPhp: "1", payerId: "65a000000000000000000001" };
    expect(splitExpenseSchema.safeParse({ ...base, participantIds: [] }).success).toBe(false);
    expect(
      splitExpenseSchema.safeParse({ ...base, participantIds: ["65a000000000000000000001", "65a000000000000000000001"] }).success,
    ).toBe(false);
  });

  it("refuses archived tabs", async () => {
    const { tabId, split } = await setUp();
    await setTabArchived({ tabId, archived: true }, owner);
    await expectDomainError(split({}), "read-only");
  });
});

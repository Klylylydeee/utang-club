import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { recordPayment } from "@/lib/payments/paymentService";
import { getSettlements } from "@/lib/settlements/settlementService";
import { shareTab } from "@/lib/tabs/shareService";
import { addPerson, createTab, getTabDetail } from "@/lib/tabs/tabService";
import { splitExpense } from "@/lib/transactions/splitService";
import {
  createTransaction,
  duplicateTransaction,
  listTransactions,
  updateTransaction,
} from "@/lib/transactions/transactionService";
import { Transaction } from "@/models/Transaction";
import { User } from "@/models/User";
import { recordPaymentSchema } from "@/schemas/payment";
import { shareTabSchema } from "@/schemas/share";
import { splitExpenseSchema } from "@/schemas/split";
import { transactionInputSchema } from "@/schemas/transaction";
import { startTestDatabase } from "../support/mongo";
import { createTestUser } from "../support/users";

let db: Awaited<ReturnType<typeof startTestDatabase>>;

beforeAll(async () => {
  db = await startTestDatabase("authorship-test");
});
beforeEach(async () => {
  await db.clear();
});
afterAll(async () => {
  await db?.stop();
});

/** Bea's tab, shared with Dave as an editor; Kim owes Bea. */
async function setUp() {
  const bea = await createTestUser("user", "Bea");
  const dave = await createTestUser("user", "Dave");
  const { id: tabId } = await createTab({ name: "Trip", description: undefined }, bea.actor);
  const { id: beaPerson } = await addPerson({ tabId, displayName: "Bea" }, bea.actor);
  const { id: kim } = await addPerson({ tabId, displayName: "Kim" }, bea.actor);
  await shareTab(shareTabSchema.parse({ tabId, email: dave.email, role: "editor" }), bea.actor);
  const input = (description: string, amountPhp = "100") =>
    transactionInputSchema.parse({ tabId, description, amountPhp, payerId: kim, recipientId: beaPerson });
  return { bea, dave, tabId, beaPerson, kim, input };
}

describe("who added and changed a transaction", () => {
  it("records the author of every new row, however it was made", async () => {
    const { bea, dave, tabId, beaPerson, kim, input } = await setUp();
    const ramen = await createTransaction(input("Ramen"), bea.actor);
    await duplicateTransaction({ transactionId: ramen.id }, dave.actor);
    await recordPayment(
      recordPaymentSchema.parse({ tabId, debtorId: kim, creditorId: beaPerson, amountPhp: "50", allowOverpayment: false }),
      dave.actor,
    );
    await splitExpense(
      splitExpenseSchema.parse({ tabId, description: "Snacks", amountPhp: "10", payerId: beaPerson, participantIds: [beaPerson, kim] }),
      dave.actor,
    );

    const rows = await listTransactions(tabId, bea.actor);
    expect(rows.map((row) => [row.description, row.addedBy, row.editedBy])).toEqual([
      ["Ramen", { name: "Bea", isYou: true }, null],
      ["Ramen", { name: "Dave", isYou: false }, null], // the copy is Dave's
      [expect.any(String), { name: "Dave", isYou: false }, null], // payment
      ["Snacks", { name: "Dave", isYou: false }, null],
    ]);
  });

  it("says 'you' to whoever is reading", async () => {
    const { bea, dave, tabId, input } = await setUp();
    await createTransaction(input("Ramen"), bea.actor);
    expect((await listTransactions(tabId, dave.actor))[0].addedBy).toEqual({ name: "Bea", isYou: false });
    expect((await listTransactions(tabId, bea.actor))[0].addedBy).toEqual({ name: "Bea", isYou: true });
  });

  it("records who changed a row, but only when something actually changed", async () => {
    const { bea, dave, tabId, input } = await setUp();
    const row = await createTransaction(input("Ramen"), bea.actor);

    const unchanged = await updateTransaction({ ...input("Ramen"), transactionId: row.id }, dave.actor);
    expect(unchanged.editedBy).toBeNull();
    expect((await Transaction.findById(row.id).lean())?.updatedBy).toBeUndefined();

    const changed = await updateTransaction({ ...input("Ramen", "120"), transactionId: row.id }, dave.actor);
    expect(changed).toMatchObject({ addedBy: { name: "Bea" }, editedBy: { name: "Dave", isYou: true } });

    // The last person to change it is the one shown.
    await updateTransaction({ ...input("Ramen bar", "120"), transactionId: row.id }, bea.actor);
    expect((await listTransactions(tabId, dave.actor))[0].editedBy).toEqual({ name: "Bea", isYou: false });
  });

  it("follows a renamed account, and leaves rows from before tracking blank", async () => {
    const { bea, dave, tabId, input } = await setUp();
    await createTransaction(input("Ramen"), dave.actor);
    await User.updateOne({ _id: dave.id }, { $set: { name: "David" } });
    const legacy = await createTransaction(input("Old row"), bea.actor);
    await Transaction.updateOne({ _id: legacy.id }, { $unset: { createdBy: 1 } });

    const rows = await listTransactions(tabId, bea.actor);
    expect(rows[0].addedBy).toEqual({ name: "David", isYou: false });
    expect(rows[1]).toMatchObject({ addedBy: null, editedBy: null });
  });

  it("carries authors onto settlement lines, and tells pages the tab is shared", async () => {
    const { bea, dave, tabId, input } = await setUp();
    await createTransaction(input("Ramen"), dave.actor);
    const summary = await getSettlements(tabId, bea.actor);
    expect(summary.outstanding[0].lines[0]).toMatchObject({ addedBy: { name: "Dave", isYou: false }, editedBy: null });
    await expect(getTabDetail(tabId, bea.actor)).resolves.toMatchObject({ isShared: true });
    const { id: solo } = await createTab({ name: "Solo", description: undefined }, bea.actor);
    await expect(getTabDetail(solo, bea.actor)).resolves.toMatchObject({ isShared: false });
  });
});

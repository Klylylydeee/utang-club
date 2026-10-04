import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getSettlements } from "@/lib/settlements/settlementService";
import { addPerson, createTab, renamePerson } from "@/lib/tabs/tabService";
import { createTransaction, deleteTransaction, updateTransaction } from "@/lib/transactions/transactionService";
import { transactionInputSchema, type TransactionFormInput } from "@/schemas/transaction";
import type { Actor } from "@/lib/auth/actor";
import { startTestDatabase } from "../support/mongo";
import { createTestUser } from "../support/users";

let db: Awaited<ReturnType<typeof startTestDatabase>>;

beforeAll(async () => {
  db = await startTestDatabase("settlements-test");
});
let owner: Actor;

beforeEach(async () => {
  await db.clear();
  owner = (await createTestUser()).actor;
});
afterAll(async () => {
  await db?.stop();
});

describe("getSettlements (integration)", () => {
  it("recalculates as rows are added, edited and deleted", async () => {
    const { id: tabId } = await createTab({ name: "October 2026", description: undefined }, owner);
    const { id: adrian } = await addPerson({ tabId, displayName: "Adrian" }, owner);
    const { id: klyde } = await addPerson({ tabId, displayName: "Klyde" }, owner);
    const input = (overrides: Partial<TransactionFormInput> = {}) =>
      transactionInputSchema.parse({
        tabId,
        description: "Mineral Water",
        amountPhp: "123.03",
        payerId: adrian,
        recipientId: klyde,
        ...overrides,
      });

    expect(await getSettlements(tabId, owner)).toMatchObject({ outstanding: [], settled: [] });

    const water = await createTransaction(input(), owner);
    let summary = await getSettlements(tabId, owner);
    expect(summary.outstanding[0]).toMatchObject({ debtor: { displayName: "Adrian" }, amountPhpCentavos: 12303 });

    const back = await createTransaction(input({ amountPhp: "100", payerId: klyde, recipientId: adrian }), owner);
    summary = await getSettlements(tabId, owner);
    expect(summary.outstanding[0].amountPhpCentavos).toBe(2303);

    await updateTransaction({ ...input({ amountPhp: "100" }), transactionId: water.id }, owner);
    summary = await getSettlements(tabId, owner);
    expect(summary.outstanding).toEqual([]);
    expect(summary.settled[0].lines).toHaveLength(2);

    await deleteTransaction({ transactionId: back.id }, owner);
    summary = await getSettlements(tabId, owner);
    expect(summary.outstanding[0]).toMatchObject({ amountPhpCentavos: 10000, creditor: { displayName: "Klyde" } });

    await renamePerson({ personId: adrian, displayName: "Adrian G." }, owner);
    expect((await getSettlements(tabId, owner)).outstanding[0].debtor.displayName).toBe("Adrian G.");
  });

  it("only includes the requested tab", async () => {
    const { id: first } = await createTab({ name: "One", description: undefined }, owner);
    const { id: second } = await createTab({ name: "Two", description: undefined }, owner);
    for (const tabId of [first, second]) {
      const { id: a } = await addPerson({ tabId, displayName: "A" }, owner);
      const { id: b } = await addPerson({ tabId, displayName: "B" }, owner);
      await createTransaction(
        transactionInputSchema.parse({
          tabId,
          description: "x",
          amountPhp: tabId === first ? "1" : "2",
          payerId: a,
          recipientId: b,
        }), owner);
    }
    expect((await getSettlements(first, owner)).outstanding.map((card) => card.amountPhpCentavos)).toEqual([100]);
  });
});

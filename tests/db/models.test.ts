import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectToDatabase } from "@/lib/db/connect";
import { Person } from "@/models/Person";
import { Tab } from "@/models/Tab";
import { Transaction } from "@/models/Transaction";
import { startTestDatabase } from "../support/mongo";

let db: Awaited<ReturnType<typeof startTestDatabase>>;

beforeAll(async () => {
  db = await startTestDatabase("models-test");
});

afterAll(async () => {
  await db?.stop();
});

describe("database connection", () => {
  it("reuses one connection across calls", async () => {
    const [a, b] = await Promise.all([connectToDatabase(), connectToDatabase()]);
    expect(a).toBe(b);
  });

  it("strips query operators from filters (sanitizeFilter)", async () => {
    await Tab.create({ name: "Secret" });
    const injected = { name: { $ne: null } } as unknown as { name: string };
    // Wrapped as a literal `$eq` value: it either fails to cast or matches nothing.
    const leaked = await Tab.find(injected).catch(() => []);
    expect(leaked).toHaveLength(0);
  });
});

describe("models", () => {
  it("defaults a tab to active PHP", async () => {
    const tab = await Tab.create({ name: "October 2026" });
    expect(tab.status).toBe("active");
    expect(tab.baseCurrency).toBe("PHP");
  });

  it("enforces unique normalized names per tab, but not across tabs", async () => {
    const [tabA, tabB] = await Tab.create([{ name: "A" }, { name: "B" }]);
    await Person.create({ tabId: tabA._id, displayName: "Adrian", normalizedName: "adrian" });
    await expect(
      Person.create({ tabId: tabA._id, displayName: "ADRIAN", normalizedName: "adrian" }),
    ).rejects.toThrow(/duplicate key/);
    await expect(
      Person.create({ tabId: tabB._id, displayName: "Adrian", normalizedName: "adrian" }),
    ).resolves.toBeDefined();
  });

  it("validates transactions at the model layer too", async () => {
    const tab = await Tab.create({ name: "C" });
    const [adrian, klyde] = await Person.create([
      { tabId: tab._id, displayName: "Adrian", normalizedName: "adrian" },
      { tabId: tab._id, displayName: "Klyde", normalizedName: "klyde" },
    ]);
    const base = {
      tabId: tab._id,
      description: "Mineral Water",
      amountPhpCentavos: 12303,
      payerId: adrian._id,
      recipientId: klyde._id,
    };

    await expect(Transaction.create(base)).resolves.toMatchObject({ type: "expense", amountPhpCentavos: 12303 });
    await expect(Transaction.create({ ...base, amountPhpCentavos: 123.03 })).rejects.toThrow(/minor units/);
    await expect(Transaction.create({ ...base, amountPhpCentavos: 0 })).rejects.toThrow(/minor units/);
    await expect(Transaction.create({ ...base, recipientId: adrian._id })).rejects.toThrow(/different people/);
    await expect(Transaction.create({ ...base, foreignCurrency: "USD" })).rejects.toThrow(/together/);
    // strict: "throw" — unknown fields are rejected, not silently dropped.
    const withUnknownField = { ...base, unknownField: 1 } as typeof base;
    await expect(Transaction.create(withUnknownField)).rejects.toThrow(/not in schema/);
  });
});

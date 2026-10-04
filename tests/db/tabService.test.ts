import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/actions/result";
import {
  addPerson,
  createTab,
  deletePerson,
  getTabDetail,
  listTabs,
  renamePerson,
  setTabArchived,
  updateTabDetails,
} from "@/lib/tabs/tabService";
import { Transaction } from "@/models/Transaction";
import { startTestDatabase } from "../support/mongo";

let db: Awaited<ReturnType<typeof startTestDatabase>>;

beforeAll(async () => {
  db = await startTestDatabase("tabs-test");
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

describe("tabs", () => {
  it("creates, lists and loads a tab", async () => {
    const { id } = await createTab({ name: "October 2026", description: undefined });
    const tabs = await listTabs();
    expect(tabs).toMatchObject([{ id, name: "October 2026", status: "active", participantCount: 0, transactionCount: 0 }]);
    const detail = await getTabDetail(id);
    expect(detail?.tab.name).toBe("October 2026");
    expect(detail?.people).toEqual([]);
  });

  it("returns null for an unknown tab", async () => {
    await expect(getTabDetail("65a0000000000000000000ff")).resolves.toBeNull();
  });

  it("renames and clears the description", async () => {
    const { id } = await createTab({ name: "Oct", description: "groceries" });
    await updateTabDetails({ tabId: id, name: "October 2026", description: undefined });
    const detail = await getTabDetail(id);
    expect(detail?.tab).toMatchObject({ name: "October 2026", description: null });
  });
});

describe("participants (Phase 4 exit criterion)", () => {
  it("adds Adrian and Klyde, and rejects 'adrian' as a duplicate", async () => {
    const { id: tabId } = await createTab({ name: "October 2026", description: undefined });
    await addPerson({ tabId, displayName: "Adrian" });
    await addPerson({ tabId, displayName: "Klyde" });

    const error = await expectDomainError(addPerson({ tabId, displayName: "adrian" }), "conflict");
    expect(error.fieldErrors?.displayName).toBeDefined();

    const detail = await getTabDetail(tabId);
    expect(detail?.people.map((person) => person.displayName)).toEqual(["Adrian", "Klyde"]);
    expect(detail?.tab.participantCount).toBe(2);
  });

  it("allows the same name in different tabs", async () => {
    const a = await createTab({ name: "September", description: undefined });
    const b = await createTab({ name: "October", description: undefined });
    await addPerson({ tabId: a.id, displayName: "Adrian" });
    await expect(addPerson({ tabId: b.id, displayName: "Adrian" })).resolves.toBeDefined();
  });

  it("renames, including a case-only change, but not onto someone else's name", async () => {
    const { id: tabId } = await createTab({ name: "T", description: undefined });
    const adrian = await addPerson({ tabId, displayName: "adrian" });
    await addPerson({ tabId, displayName: "Klyde" });

    await renamePerson({ personId: adrian.id, displayName: "Adrian" });
    await expectDomainError(renamePerson({ personId: adrian.id, displayName: "KLYDE" }), "conflict");

    const detail = await getTabDetail(tabId);
    expect(detail?.people.map((person) => person.displayName)).toEqual(["Adrian", "Klyde"]);
  });

  it("keeps history linked by id when a person is renamed", async () => {
    const { id: tabId } = await createTab({ name: "T", description: undefined });
    const adrian = await addPerson({ tabId, displayName: "Adrian" });
    const klyde = await addPerson({ tabId, displayName: "Klyde" });
    await Transaction.create({
      tabId,
      description: "Mineral Water",
      amountPhpCentavos: 12303,
      payerId: adrian.id,
      recipientId: klyde.id,
    });
    await renamePerson({ personId: adrian.id, displayName: "Adi" });
    const detail = await getTabDetail(tabId);
    expect(detail?.people.find((person) => person.id === adrian.id)).toMatchObject({
      displayName: "Adi",
      transactionCount: 1,
    });
  });

  it("removes a person with no transactions, but not one with history (D5)", async () => {
    const { id: tabId } = await createTab({ name: "T", description: undefined });
    const adrian = await addPerson({ tabId, displayName: "Adrian" });
    const klyde = await addPerson({ tabId, displayName: "Klyde" });
    const via = await addPerson({ tabId, displayName: "Via" });
    await Transaction.create({
      tabId,
      description: "Lunch",
      amountPhpCentavos: 50000,
      payerId: adrian.id,
      recipientId: klyde.id,
    });

    await expectDomainError(deletePerson({ personId: klyde.id }), "in-use");
    await deletePerson({ personId: via.id });

    const detail = await getTabDetail(tabId);
    expect(detail?.people.map((person) => person.displayName)).toEqual(["Adrian", "Klyde"]);
  });

  it("reports unknown people and tabs as not-found", async () => {
    await expectDomainError(renamePerson({ personId: "65a0000000000000000000aa", displayName: "X" }), "not-found");
    await expectDomainError(addPerson({ tabId: "65a0000000000000000000ff", displayName: "X" }), "not-found");
  });
});

describe("archived tabs are read-only (D6)", () => {
  it("blocks edits until unarchived", async () => {
    const { id: tabId } = await createTab({ name: "September", description: undefined });
    const adrian = await addPerson({ tabId, displayName: "Adrian" });
    await setTabArchived({ tabId, archived: true });

    await expectDomainError(addPerson({ tabId, displayName: "Klyde" }), "read-only");
    await expectDomainError(renamePerson({ personId: adrian.id, displayName: "Adi" }), "read-only");
    await expectDomainError(deletePerson({ personId: adrian.id }), "read-only");
    await expectDomainError(updateTabDetails({ tabId, name: "New", description: undefined }), "read-only");

    await setTabArchived({ tabId, archived: false });
    await expect(addPerson({ tabId, displayName: "Klyde" })).resolves.toBeDefined();
  });

  it("lists archived tabs with their status", async () => {
    const { id } = await createTab({ name: "September", description: undefined });
    await setTabArchived({ tabId: id, archived: true });
    expect((await listTabs())[0].status).toBe("archived");
  });
});

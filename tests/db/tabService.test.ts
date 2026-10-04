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
import type { Actor } from "@/lib/auth/actor";
import { startTestDatabase } from "../support/mongo";
import { createTestUser } from "../support/users";

let db: Awaited<ReturnType<typeof startTestDatabase>>;

beforeAll(async () => {
  db = await startTestDatabase("tabs-test");
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

describe("tabs", () => {
  it("creates, lists and loads a tab", async () => {
    const { id } = await createTab({ name: "October 2026", description: undefined }, owner);
    const tabs = await listTabs(owner);
    expect(tabs).toMatchObject([{ id, name: "October 2026", status: "active", participantCount: 0, transactionCount: 0 }]);
    const detail = await getTabDetail(id, owner);
    expect(detail?.tab.name).toBe("October 2026");
    expect(detail?.people).toEqual([]);
  });

  it("returns null for an unknown tab", async () => {
    await expect(getTabDetail("65a0000000000000000000ff", owner)).resolves.toBeNull();
  });

  it("renames and clears the description", async () => {
    const { id } = await createTab({ name: "Oct", description: "groceries" }, owner);
    await updateTabDetails({ tabId: id, name: "October 2026", description: undefined }, owner);
    const detail = await getTabDetail(id, owner);
    expect(detail?.tab).toMatchObject({ name: "October 2026", description: null });
  });
});

describe("participants (Phase 4 exit criterion)", () => {
  it("adds Adrian and Klyde, and rejects 'adrian' as a duplicate", async () => {
    const { id: tabId } = await createTab({ name: "October 2026", description: undefined }, owner);
    await addPerson({ tabId, displayName: "Adrian" }, owner);
    await addPerson({ tabId, displayName: "Klyde" }, owner);

    const error = await expectDomainError(addPerson({ tabId, displayName: "adrian" }, owner), "conflict");
    expect(error.fieldErrors?.displayName).toBeDefined();

    const detail = await getTabDetail(tabId, owner);
    expect(detail?.people.map((person) => person.displayName)).toEqual(["Adrian", "Klyde"]);
    expect(detail?.tab.participantCount).toBe(2);
  });

  it("allows the same name in different tabs", async () => {
    const a = await createTab({ name: "September", description: undefined }, owner);
    const b = await createTab({ name: "October", description: undefined }, owner);
    await addPerson({ tabId: a.id, displayName: "Adrian" }, owner);
    await expect(addPerson({ tabId: b.id, displayName: "Adrian" }, owner)).resolves.toBeDefined();
  });

  it("renames, including a case-only change, but not onto someone else's name", async () => {
    const { id: tabId } = await createTab({ name: "T", description: undefined }, owner);
    const adrian = await addPerson({ tabId, displayName: "adrian" }, owner);
    await addPerson({ tabId, displayName: "Klyde" }, owner);

    await renamePerson({ personId: adrian.id, displayName: "Adrian" }, owner);
    await expectDomainError(renamePerson({ personId: adrian.id, displayName: "KLYDE" }, owner), "conflict");

    const detail = await getTabDetail(tabId, owner);
    expect(detail?.people.map((person) => person.displayName)).toEqual(["Adrian", "Klyde"]);
  });

  it("keeps history linked by id when a person is renamed", async () => {
    const { id: tabId } = await createTab({ name: "T", description: undefined }, owner);
    const adrian = await addPerson({ tabId, displayName: "Adrian" }, owner);
    const klyde = await addPerson({ tabId, displayName: "Klyde" }, owner);
    await Transaction.create({
      tabId,
      description: "Mineral Water",
      amountPhpCentavos: 12303,
      payerId: adrian.id,
      recipientId: klyde.id,
    });
    await renamePerson({ personId: adrian.id, displayName: "Adi" }, owner);
    const detail = await getTabDetail(tabId, owner);
    expect(detail?.people.find((person) => person.id === adrian.id)).toMatchObject({
      displayName: "Adi",
      transactionCount: 1,
    });
  });

  it("removes a person with no transactions, but not one with history (D5)", async () => {
    const { id: tabId } = await createTab({ name: "T", description: undefined }, owner);
    const adrian = await addPerson({ tabId, displayName: "Adrian" }, owner);
    const klyde = await addPerson({ tabId, displayName: "Klyde" }, owner);
    const via = await addPerson({ tabId, displayName: "Via" }, owner);
    await Transaction.create({
      tabId,
      description: "Lunch",
      amountPhpCentavos: 50000,
      payerId: adrian.id,
      recipientId: klyde.id,
    });

    await expectDomainError(deletePerson({ personId: klyde.id }, owner), "in-use");
    await deletePerson({ personId: via.id }, owner);

    const detail = await getTabDetail(tabId, owner);
    expect(detail?.people.map((person) => person.displayName)).toEqual(["Adrian", "Klyde"]);
  });

  it("reports unknown people and tabs as not-found", async () => {
    await expectDomainError(renamePerson({ personId: "65a0000000000000000000aa", displayName: "X" }, owner), "not-found");
    await expectDomainError(addPerson({ tabId: "65a0000000000000000000ff", displayName: "X" }, owner), "not-found");
  });
});

describe("archived tabs are read-only (D6)", () => {
  it("blocks edits until unarchived", async () => {
    const { id: tabId } = await createTab({ name: "September", description: undefined }, owner);
    const adrian = await addPerson({ tabId, displayName: "Adrian" }, owner);
    await setTabArchived({ tabId, archived: true }, owner);

    await expectDomainError(addPerson({ tabId, displayName: "Klyde" }, owner), "read-only");
    await expectDomainError(renamePerson({ personId: adrian.id, displayName: "Adi" }, owner), "read-only");
    await expectDomainError(deletePerson({ personId: adrian.id }, owner), "read-only");
    await expectDomainError(updateTabDetails({ tabId, name: "New", description: undefined }, owner), "read-only");

    await setTabArchived({ tabId, archived: false }, owner);
    await expect(addPerson({ tabId, displayName: "Klyde" }, owner)).resolves.toBeDefined();
  });

  it("lists archived tabs with their status", async () => {
    const { id } = await createTab({ name: "September", description: undefined }, owner);
    await setTabArchived({ tabId: id, archived: true }, owner);
    expect((await listTabs(owner))[0].status).toBe("archived");
  });
});

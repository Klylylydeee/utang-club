import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DomainError } from "@/lib/actions/result";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const { authedAction } = await import("@/lib/auth/authedAction");

const schema = z.object({ name: z.string().min(1, "Name is required") });
const SESSION = { id: "s1", user: { id: "65a000000000000000000001", name: "Klyde", email: "k@example.test", role: "user" } };

beforeEach(() => {
  getSession.mockReset();
});

describe("authedAction", () => {
  it("rejects without a session and never runs the handler or reads input", async () => {
    getSession.mockResolvedValue(null);
    const handler = vi.fn();
    const action = authedAction(schema, handler);
    await expect(action({ name: "x" })).resolves.toMatchObject({ ok: false, code: "unauthenticated" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("validates input and returns field errors", async () => {
    getSession.mockResolvedValue(SESSION);
    const handler = vi.fn();
    const result = await authedAction(schema, handler)({ name: "" });
    expect(result).toEqual({
      ok: false,
      code: "validation",
      error: expect.any(String),
      fieldErrors: { name: "Name is required" },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler with parsed input and the session", async () => {
    getSession.mockResolvedValue(SESSION);
    const action = authedAction(schema, async (input, { session, actor }) => `${input.name}:${session.id}:${actor.userId}`);
    await expect(action({ name: "Adrian" })).resolves.toEqual({ ok: true, data: "Adrian:s1:65a000000000000000000001" });
  });

  it("maps DomainError to a structured failure", async () => {
    getSession.mockResolvedValue(SESSION);
    const action = authedAction(schema, async () => {
      throw new DomainError("conflict", "Taken", { name: "Taken" });
    });
    await expect(action({ name: "x" })).resolves.toEqual({
      ok: false,
      code: "conflict",
      error: "Taken",
      fieldErrors: { name: "Taken" },
    });
  });

  it("hides unexpected errors behind a generic message", async () => {
    getSession.mockResolvedValue(SESSION);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const action = authedAction(schema, async () => {
      throw new Error("connection string mongodb://secret@host leaked?");
    });
    const result = await action({ name: "x" });
    expect(result).toMatchObject({ ok: false, code: "server" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("fails closed when the session check itself errors", async () => {
    getSession.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn();
    await expect(authedAction(schema, handler)({ name: "x" })).resolves.toMatchObject({ ok: false, code: "server" });
    expect(handler).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import {
  CLIENT_POLICY,
  GLOBAL_POLICY,
  isLocked,
  registerFailure,
  type ThrottleState,
} from "@/lib/auth/throttlePolicy";

const MINUTE = 60_000;
const t0 = new Date("2026-10-03T00:00:00Z");
const at = (minutes: number) => new Date(t0.getTime() + minutes * MINUTE);

function fail(times: number, state: ThrottleState | null, now: Date, policy = CLIENT_POLICY) {
  let current = state;
  for (let i = 0; i < times; i++) current = registerFailure(current, now, policy);
  return current;
}

describe("login throttle policy", () => {
  it("allows four failures, locks on the fifth within 15 minutes", () => {
    const four = fail(4, null, t0);
    expect(isLocked(four, t0)).toBe(false);
    const five = registerFailure(four, at(1), CLIENT_POLICY);
    expect(isLocked(five, at(1))).toBe(true);
    expect(five.lockedUntil).toEqual(at(6)); // 5-minute first lock
  });

  it("unlocks after the lock expires", () => {
    const locked = fail(5, null, t0);
    expect(isLocked(locked, at(4.9))).toBe(true);
    expect(isLocked(locked, at(5))).toBe(false);
  });

  it("forgets failures once the 15-minute window passes", () => {
    const four = fail(4, null, t0);
    const later = registerFailure(four, at(15), CLIENT_POLICY);
    expect(later.failures).toBe(1);
    expect(isLocked(later, at(15))).toBe(false);
  });

  it("doubles each lock, capped at one hour", () => {
    let state: ThrottleState | null = null;
    const locks: number[] = [];
    let now = t0;
    for (let round = 0; round < 7; round++) {
      const next = fail(5, state, now);
      const lockedUntil = next?.lockedUntil;
      if (!lockedUntil) throw new Error("expected a lock");
      locks.push((lockedUntil.getTime() - now.getTime()) / MINUTE);
      state = next;
      now = lockedUntil;
    }
    expect(locks).toEqual([5, 10, 20, 40, 60, 60, 60]);
  });

  it("global policy needs 20 failures", () => {
    expect(isLocked(fail(19, null, t0, GLOBAL_POLICY), t0)).toBe(false);
    expect(isLocked(fail(20, null, t0, GLOBAL_POLICY), t0)).toBe(true);
  });

  it("null state is never locked", () => {
    expect(isLocked(null, t0)).toBe(false);
  });
});

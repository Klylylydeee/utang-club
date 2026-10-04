/**
 * Login brute-force policy (PHASING.md → Phase 3). Pure functions over a
 * small state record so the rules are unit-testable without a database.
 */

export type ThrottleState = {
  /** Start of the current counting window. */
  windowStartedAt: Date;
  /** Failures inside the current window. */
  failures: number;
  /** Set while the key is locked out. */
  lockedUntil: Date | null;
  /** How many lockouts so far; drives exponential backoff. */
  lockCount: number;
};

export type ThrottlePolicy = {
  maxFailures: number;
  windowMs: number;
  baseLockMs: number;
  maxLockMs: number;
};

const MINUTE = 60 * 1000;

/** Per client: 5 failures in 15 min → 5, 10, 20, 40, then 60 min (cap). */
export const CLIENT_POLICY: ThrottlePolicy = {
  maxFailures: 5,
  windowMs: 15 * MINUTE,
  baseLockMs: 5 * MINUTE,
  maxLockMs: 60 * MINUTE,
};

/** Everyone together: 20 failures in 15 min → brief global lock. */
export const GLOBAL_POLICY: ThrottlePolicy = {
  maxFailures: 20,
  windowMs: 15 * MINUTE,
  baseLockMs: 5 * MINUTE,
  maxLockMs: 30 * MINUTE,
};

/** Throttle records are forgotten after a day of inactivity (TTL). */
export const THROTTLE_RETENTION_MS = 24 * 60 * MINUTE;

export const GLOBAL_THROTTLE_KEY = "global";

export function isLocked(state: ThrottleState | null, now: Date): boolean {
  return state?.lockedUntil != null && state.lockedUntil.getTime() > now.getTime();
}

/** The state after one more failed attempt. */
export function registerFailure(state: ThrottleState | null, now: Date, policy: ThrottlePolicy): ThrottleState {
  const windowExpired = !state || now.getTime() - state.windowStartedAt.getTime() >= policy.windowMs;
  const failures = windowExpired ? 1 : state.failures + 1;
  const windowStartedAt = windowExpired ? now : state.windowStartedAt;
  const lockCount = state?.lockCount ?? 0;

  if (failures < policy.maxFailures) {
    return { windowStartedAt, failures, lockedUntil: state?.lockedUntil ?? null, lockCount };
  }

  const lockMs = Math.min(policy.baseLockMs * 2 ** lockCount, policy.maxLockMs);
  return {
    // Start a fresh window once locked, so the next lock needs a new burst.
    windowStartedAt: now,
    failures: 0,
    lockedUntil: new Date(now.getTime() + lockMs),
    lockCount: lockCount + 1,
  };
}

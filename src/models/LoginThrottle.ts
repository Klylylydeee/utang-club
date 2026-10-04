import "server-only";
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** Failed-login counters per hashed client key, plus one "global" record. */
const loginThrottleSchema = new Schema(
  {
    key: { type: String, required: true },
    windowStartedAt: { type: Date, required: true },
    failures: { type: Number, required: true, min: 0 },
    lockedUntil: { type: Date, default: null },
    lockCount: { type: Number, required: true, min: 0 },
    // TTL: forgotten after a quiet day, which also resets backoff.
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: "throw" },
);

loginThrottleSchema.index({ key: 1 }, { unique: true });
loginThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginThrottleRecord = InferSchemaType<typeof loginThrottleSchema>;

export const LoginThrottle: Model<LoginThrottleRecord> =
  (models.LoginThrottle as Model<LoginThrottleRecord> | undefined) ?? model("LoginThrottle", loginThrottleSchema);

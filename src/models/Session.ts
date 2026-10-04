import "server-only";
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** Server-side login session (D12, per user since D15). The cookie holds only the raw token. */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // SHA-256 of the cookie token; the raw token is never stored.
    tokenHash: { type: String, required: true },
    // Must match the fingerprint of the user's current password hash to be valid.
    passwordFingerprint: { type: String, required: true },
    lastSeenAt: { type: Date, required: true },
    // Sliding idle expiry; the TTL index deletes the document after it.
    expiresAt: { type: Date, required: true },
    // Hard cap regardless of activity.
    absoluteExpiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: "throw" },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1 });

export type SessionRecord = InferSchemaType<typeof sessionSchema>;

export const Session: Model<SessionRecord> =
  (models.Session as Model<SessionRecord> | undefined) ?? model("Session", sessionSchema);

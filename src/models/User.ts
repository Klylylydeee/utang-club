import "server-only";
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const USER_ROLES = ["user", "admin"] as const;
export const USER_STATUSES = ["active", "disabled"] as const;

/**
 * An account (decision D15). The password is stored only as a scrypt hash.
 * Sessions are tied to the hash, so a password reset signs the user out
 * everywhere; disabling the account does too.
 */
const userSchema = new Schema(
  {
    // Lowercased and trimmed by normalizeEmail before it gets here.
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: USER_ROLES, default: "user" },
    status: { type: String, required: true, enum: USER_STATUSES, default: "active" },
  },
  { timestamps: true, strict: "throw" },
);

userSchema.index({ email: 1 }, { unique: true });

export type UserRecord = InferSchemaType<typeof userSchema>;

export const User: Model<UserRecord> = (models.User as Model<UserRecord> | undefined) ?? model("User", userSchema);

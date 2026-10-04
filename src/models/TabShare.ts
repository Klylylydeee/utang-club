import "server-only";
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const SHARE_ROLES = ["viewer", "editor"] as const;

/**
 * A tab shared with another account (D19). `viewer` may read the tab;
 * `editor` may also change what's inside it. Only the owner manages shares.
 */
const tabShareSchema = new Schema(
  {
    tabId: { type: Schema.Types.ObjectId, ref: "Tab", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, required: true, enum: SHARE_ROLES },
  },
  { timestamps: true, strict: "throw" },
);

// One share per person per tab; and "tabs shared with me" by user.
tabShareSchema.index({ tabId: 1, userId: 1 }, { unique: true });
tabShareSchema.index({ userId: 1 });

export type TabShareRecord = InferSchemaType<typeof tabShareSchema>;

export const TabShare: Model<TabShareRecord> =
  (models.TabShare as Model<TabShareRecord> | undefined) ?? model("TabShare", tabShareSchema);

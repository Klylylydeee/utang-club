import "server-only";
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const TAB_STATUSES = ["active", "archived"] as const;

/** A tab of shared expenses for one activity: a trip, a night out, a dinner. Owned by one user (D15). */
const tabSchema = new Schema(
  {
    // Tabs created before accounts existed have none until `pnpm create-admin` claims them.
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500 },
    baseCurrency: { type: String, required: true, enum: ["PHP"], default: "PHP" },
    status: { type: String, required: true, enum: TAB_STATUSES, default: "active" },
  },
  { timestamps: true, strict: "throw" },
);

tabSchema.index({ ownerId: 1, updatedAt: -1 });

export type TabRecord = InferSchemaType<typeof tabSchema>;

export const Tab: Model<TabRecord> = (models.Tab as Model<TabRecord> | undefined) ?? model("Tab", tabSchema);

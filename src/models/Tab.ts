import "server-only";
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const TAB_STATUSES = ["active", "archived"] as const;

const tabSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500 },
    baseCurrency: { type: String, required: true, enum: ["PHP"], default: "PHP" },
    status: { type: String, required: true, enum: TAB_STATUSES, default: "active" },
  },
  { timestamps: true, strict: "throw" },
);

tabSchema.index({ status: 1, updatedAt: -1 });

export type TabRecord = InferSchemaType<typeof tabSchema>;

export const Tab: Model<TabRecord> = (models.Tab as Model<TabRecord> | undefined) ?? model("Tab", tabSchema);

import "server-only";
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const personSchema = new Schema(
  {
    tabId: { type: Schema.Types.ObjectId, ref: "Tab", required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    // Case-insensitive key for duplicate detection; see normalizePersonName.
    normalizedName: { type: String, required: true, maxlength: 60 },
  },
  { timestamps: true, strict: "throw" },
);

personSchema.index({ tabId: 1, normalizedName: 1 }, { unique: true });

export type PersonRecord = InferSchemaType<typeof personSchema>;

export const Person: Model<PersonRecord> =
  (models.Person as Model<PersonRecord> | undefined) ?? model("Person", personSchema);

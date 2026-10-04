import "server-only";
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const TRANSACTION_TYPES = ["expense", "payment"] as const;

const positiveSafeInteger = {
  validator: (value: number) => Number.isSafeInteger(value) && value > 0,
  message: "{PATH} must be a positive whole number of minor units",
};

const transactionSchema = new Schema(
  {
    tabId: { type: Schema.Types.ObjectId, ref: "Tab", required: true },
    type: { type: String, required: true, enum: TRANSACTION_TYPES, default: "expense" },
    description: { type: String, required: true, trim: true, maxlength: 200 },

    foreignCurrency: { type: String, uppercase: true, match: /^[A-Z]{3}$/ },
    foreignAmountMinor: { type: Number, validate: positiveSafeInteger },

    // Integer centavos; never a float. Must be > 0 (decision D4).
    amountPhpCentavos: { type: Number, required: true, validate: positiveSafeInteger },

    payerId: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "Person", required: true },

    transactionDate: { type: Date },
    notes: { type: String, trim: true, maxlength: 1000 },

    // Who added the row, and who last changed a field in it. Rows from
    // before these were recorded have neither.
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // Deleting keeps the row (the audit trail) and hides it everywhere;
    // it can be restored. Absent on live rows.
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: "throw" },
);

transactionSchema.index({ tabId: 1, createdAt: 1 });
transactionSchema.index({ tabId: 1, payerId: 1 });
transactionSchema.index({ tabId: 1, recipientId: 1 });

transactionSchema.pre("validate", function () {
  if (this.payerId && this.recipientId && this.payerId.equals(this.recipientId)) {
    this.invalidate("recipientId", "Payer and recipient must be different people");
  }
  if ((this.foreignCurrency == null) !== (this.foreignAmountMinor == null)) {
    this.invalidate("foreignAmountMinor", "Foreign currency and foreign amount must be provided together");
  }
});

export type TransactionRecord = InferSchemaType<typeof transactionSchema>;

export const Transaction: Model<TransactionRecord> =
  (models.Transaction as Model<TransactionRecord> | undefined) ?? model("Transaction", transactionSchema);

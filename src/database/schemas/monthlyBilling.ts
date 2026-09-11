import { Schema, InferSchemaType } from "mongoose";

export interface IMonthlyBilling {
  userId: string;
  clientName: string;
  botName: string;
  monthYear: string; // Ex: "2026-10"
  amount: number;
  pixPayload: string;
  status: "sent" | "paid";
  sentAt: Date;
  paidAt?: Date;
  isTest?: boolean;
}

export const monthlyBillingSchema = new Schema<IMonthlyBilling>(
  {
    userId: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    botName: { type: String, required: true },
    monthYear: { type: String, required: true, index: true },
    amount: { type: Number, required: true, default: 15.0 },
    pixPayload: { type: String, required: true },
    status: { type: String, enum: ["sent", "paid"], default: "sent" },
    sentAt: { type: Date, default: Date.now },
    paidAt: { type: Date },
    isTest: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

monthlyBillingSchema.index({ userId: 1, monthYear: 1 }, { unique: true });

export type MonthlyBillingSchema = InferSchemaType<typeof monthlyBillingSchema>;

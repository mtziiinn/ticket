import { Schema, InferSchemaType } from "mongoose";

export interface IMonthlyBilling {
  userId: string;
  clientName: string;
  botName: string;
  monthYear: string; // Ex: "2026-10"
  amount: number;
  pixPayload?: string;
  // "skipped": mes intencionalmente nao cobrado (ex: ja foi acertado por
  // fora), sem fingir que houve pagamento — so bloqueia a recobranca
  // automatica do dia 06 e fica de fora de lembrete/desligamento.
  status: "sent" | "pending" | "paid" | "skipped";
  mpPaymentId?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  dmMessageId?: string;
  dmChannelId?: string;
  sentAt: Date;
  paidAt?: Date;
  isTest?: boolean;
  reminderCount?: number;
  lastReminderAt?: Date;
}

export const monthlyBillingSchema = new Schema<IMonthlyBilling>(
  {
    userId: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    botName: { type: String, required: true },
    monthYear: { type: String, required: true, index: true },
    amount: { type: Number, required: true, default: 15.0 },
    pixPayload: { type: String },
    status: {
      type: String,
      enum: ["sent", "pending", "paid", "skipped"],
      default: "sent",
    },
    mpPaymentId: { type: String, index: true },
    qrCode: { type: String },
    qrCodeBase64: { type: String },
    ticketUrl: { type: String },
    dmMessageId: { type: String },
    dmChannelId: { type: String },
    sentAt: { type: Date, default: Date.now },
    paidAt: { type: Date },
    isTest: { type: Boolean, default: false },
    reminderCount: { type: Number, default: 0 },
    lastReminderAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

monthlyBillingSchema.index({ userId: 1, monthYear: 1 }, { unique: true });

export type MonthlyBillingSchema = InferSchemaType<typeof monthlyBillingSchema>;

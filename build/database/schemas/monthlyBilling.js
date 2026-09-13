import { Schema } from "mongoose";
export const monthlyBillingSchema = new Schema({
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
}, {
    timestamps: true,
});
monthlyBillingSchema.index({ userId: 1, monthYear: 1 }, { unique: true });

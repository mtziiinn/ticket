import { Schema } from "mongoose";
import { t } from "../utils.js";
export const ticketSchema = new Schema({
    guildId: t.string,
    ownerId: t.string,
    channelId: t.string,
    messageId: String,
    ticketId: { type: String, unique: true },
    category: t.string,
    description: t.string,
    status: { type: String, default: "open" },
    claimedBy: String,
    closed: { type: Boolean, default: false },
    closedBy: String,
    openedAt: { type: Date, default: Date.now },
    closedAt: Date,
    deliveries: [
        {
            url: { type: String, required: true },
            filename: { type: String, required: true },
            description: { type: String, default: "" },
            deliveredBy: { type: String, required: true },
            deliveredAt: { type: Date, default: Date.now },
        },
    ],
    payment: {
        id: String,
        amount: Number,
        status: { type: String, default: "pending" },
        description: String,
        method: String,
        paidAt: Date,
        preferenceId: String,
        initPoint: String,
        qrCode: String,
        qrCodeBase64: String,
        ticketUrl: String,
    },
}, {
    statics: {
        async getByChannel(channelId) {
            return await this.findOne({ channelId });
        },
    },
});
ticketSchema.index({ channelId: 1 });
ticketSchema.index({ guildId: 1, ownerId: 1, closed: 1 });
ticketSchema.index({ guildId: 1, openedAt: -1 });
ticketSchema.index({ openedAt: 1 });

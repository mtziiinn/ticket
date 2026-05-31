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
    deliveries: [{
            url: { type: String, required: true },
            filename: { type: String, required: true },
            description: { type: String, default: "" },
            deliveredBy: { type: String, required: true },
            deliveredAt: { type: Date, default: Date.now },
        }],
}, {
    statics: {
        async getByChannel(channelId) {
            return await this.findOne({ channelId });
        },
    },
});

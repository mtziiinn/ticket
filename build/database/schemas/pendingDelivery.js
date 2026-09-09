import { Schema } from "mongoose";
export const pendingDeliverySchema = new Schema({
    token: { type: String, unique: true, required: true },
    channelId: { type: String, required: true },
    staffId: { type: String, required: true },
    description: { type: String, default: "" },
    ticketId: { type: String, required: true },
    status: {
        type: String,
        enum: ["pending", "processing", "completed"],
        default: "pending",
    },
    url: { type: String, default: null },
    filename: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
});
pendingDeliverySchema.index({ channelId: 1 });
pendingDeliverySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

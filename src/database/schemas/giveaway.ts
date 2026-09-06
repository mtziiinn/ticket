import { Schema } from "mongoose";

export const giveawaySchema = new Schema(
  {
    messageId: { type: String, unique: true, required: true },
    channelId: { type: String, required: true },
    guildId: { type: String, required: true },
    item: { type: String, required: true },
    winnersCount: { type: Number, default: 1 },
    endsAt: { type: Date, required: true },
    ended: { type: Boolean, default: false },
    participants: { type: [String], default: [] },
    winners: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  {
    statics: {
      async getByMessage(messageId: string) {
        return await this.findOne({ messageId });
      },
    },
  },
);

giveawaySchema.index({ messageId: 1 });
giveawaySchema.index({ guildId: 1, ended: 1 });
giveawaySchema.index({ endsAt: 1, ended: 1 });

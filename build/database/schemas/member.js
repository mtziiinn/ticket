import { Schema } from "mongoose";
import { t } from "../utils.js";
export const memberSchema = new Schema({
    id: t.string,
    guildId: t.string,
    wallet: {
        coins: { type: Number, default: 0 },
    },
    payments: {
        pixKey: String,
        pixType: String,
        mpAccessToken: String,
        stripeSecretKey: String,
    },
}, {
    statics: {
        async get(member) {
            const query = { id: member.id, guildId: member.guild.id };
            return (await this.findOne(query)) ?? (await this.create(query));
        },
    },
});
memberSchema.index({ id: 1, guildId: 1 }, { unique: true });

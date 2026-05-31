import { Schema } from "mongoose";
import { t } from "../utils.js";
export const guildSchema = new Schema({
    id: t.string,
    channels: {
        logs: String,
        vault: String,
        general: String,
        tickets: String,
        staffRole: String,
        pixKey: String,
        closed: Boolean,
        categories: {
            suporte: String,
            denuncia: String,
            financeiro: String,
            bugs: String,
        },
        ticketCategories: [
            {
                name: String,
                value: String,
                description: String,
                emoji: String,
                channelEmoji: String,
                parentId: String,
            },
        ],
    },
}, {
    statics: {
        async get(id) {
            return (await this.findOne({ id })) ?? this.create({ id });
        },
    },
});

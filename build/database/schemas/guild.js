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
    welcome: {
        channelEntry: String,
        channelExit: String,
        autoRole: String,
        minAccountAgeDays: { type: Number, default: 0 },
    },
    verification: {
        channel: String,
        logsChannel: String,
        verifiedRole: String,
        unverifiedRole: String,
    },
    botLogsChannel: String,
    payments: {
        pixKey: String,
        pixType: String,
        mpAccessToken: String,
        mpPublicKey: String,
        stripeSecretKey: String,
        stripeWebhookSecret: String,
    },
    identity: {
        botName: String,
        avatarUrl: String,
        primaryColor: String,
        ticketEmbedColor: String,
        bannerUrl: String,
    },
});
guildSchema.index({ id: 1 }, { unique: true });
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minuto
guildSchema.post("save", (doc) => {
    cache.set(doc.id, { data: doc, expires: Date.now() + CACHE_TTL });
});
guildSchema.statics.get = async function (id) {
    const cached = cache.get(id);
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }
    const doc = (await this.findOne({ id })) ?? (await this.create({ id }));
    cache.set(id, { data: doc, expires: Date.now() + CACHE_TTL });
    return doc;
};
export function cleanupGuildCache() {
    const now = Date.now();
    for (const [key, val] of cache.entries()) {
        if (val.expires <= now) {
            cache.delete(key);
        }
    }
}

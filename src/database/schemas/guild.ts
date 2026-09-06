import { Model, Schema, HydratedDocument } from "mongoose";
import { t } from "../utils.js";

export interface IGuild {
  id: string;
  channels?: {
    logs?: string;
    vault?: string;
    general?: string;
    tickets?: string;
    staffRole?: string;
    pixKey?: string;
    closed?: boolean;
    categories?: {
      suporte?: string;
      denuncia?: string;
      financeiro?: string;
      bugs?: string;
    };
    ticketCategories?: Array<{
      name?: string;
      value?: string;
      description?: string;
      emoji?: string;
      channelEmoji?: string;
      parentId?: string;
    }>;
  };
  welcome?: {
    channelEntry?: string;
    channelExit?: string;
    autoRole?: string;
    minAccountAgeDays?: number;
  };
  verification?: {
    channel?: string;
    logsChannel?: string;
    verifiedRole?: string;
    unverifiedRole?: string;
  };
  botLogsChannel?: string;
  payments?: {
    pixKey?: string;
    pixType?: string;
    mpAccessToken?: string;
    mpPublicKey?: string;
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
  };
  identity?: {
    botName?: string;
    avatarUrl?: string;
    primaryColor?: string;
    bannerUrl?: string;
  };
}

export interface GuildModel extends Model<IGuild> {
  get(id: string): Promise<HydratedDocument<IGuild>>;
}

export const guildSchema = new Schema<IGuild, GuildModel>({
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
    bannerUrl: String,
  },
});

guildSchema.index({ id: 1 }, { unique: true });

const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 60 * 1000; // 1 minuto

guildSchema.post("save", (doc) => {
  cache.set(doc.id, { data: doc, expires: Date.now() + CACHE_TTL });
});

guildSchema.statics.get = async function (id: string) {
  const cached = cache.get(id);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  const doc = (await this.findOne({ id })) ?? (await this.create({ id }));
  cache.set(id, { data: doc, expires: Date.now() + CACHE_TTL });
  return doc;
};

export function cleanupGuildCache(force = false): number {
  const now = Date.now();
  let count = 0;
  for (const [key, val] of cache.entries()) {
    if (force || val.expires <= now) {
      cache.delete(key);
      count++;
    }
  }
  return count;
}

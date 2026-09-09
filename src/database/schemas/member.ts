import { HydratedDocument, Model, Schema } from "mongoose";
import { t } from "../utils.js";

export interface IMember {
  id: string;
  guildId: string;
  wallet?: {
    coins?: number;
  };
  payments?: {
    pixName?: string;
    pixKey?: string;
    pixType?: string;
    mpAccessToken?: string;
    stripeSecretKey?: string;
  };
}

export interface MemberModel extends Model<IMember> {
  get(member: { id: string; guild: { id: string } }): Promise<HydratedDocument<IMember>>;
}

export const memberSchema = new Schema<IMember, MemberModel>(
  {
    id: t.string,
    guildId: t.string,
    wallet: {
      coins: { type: Number, default: 0 },
    },
    payments: {
      pixName: String,
      pixKey: String,
      pixType: String,
      mpAccessToken: String,
      stripeSecretKey: String,
    },
  },
  {
    statics: {
      async get(member: { id: string; guild: { id: string } }) {
        const query = { id: member.id, guildId: member.guild.id };
        return (await this.findOne(query)) ?? (await this.create(query));
      },
    },
  },
);

memberSchema.index({ id: 1, guildId: 1 }, { unique: true });

import mongoose, {
  InferSchemaType,
  model,
  Schema,
} from "mongoose";
import { guildSchema, IGuild, GuildModel } from "./schemas/guild.js";
import { memberSchema } from "./schemas/member.js";
import { ticketSchema } from "./schemas/ticket.js";
import { transcriptSchema } from "./schemas/transcript.js";
import { pendingDeliverySchema } from "./schemas/pendingDelivery.js";
import { giveawaySchema } from "./schemas/giveaway.js";
import { env } from "#env";
import chalk from "chalk";

try {
  console.log(chalk.blue("Connecting to MongoDB..."));
  await mongoose.connect(env.MONGO_URI, {
    dbName: env.DATABASE_NAME || "database",
  });
  console.log(chalk.green("MongoDB connected"));
} catch (err) {
  console.error(err);
  process.exit(1);
}

const dmQueueSchema = new Schema({
  ownerId: { type: String, required: true },
  staffId: { type: String, required: true },
  filename: { type: String, required: true },
  description: { type: String, default: "" },
  downloadUrl: { type: String, required: true },
  channelId: { type: String, required: true },
  fileCount: { type: Number, default: 1 },
  fileList: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

dmQueueSchema.index({ createdAt: 1 });

export const db = {
  guilds: model<IGuild, GuildModel>("guild", guildSchema, "guilds"),
  members: model("member", memberSchema, "members"),
  tickets: model("ticket", ticketSchema, "tickets"),
  transcripts: model("transcript", transcriptSchema, "transcripts"),
  pendingDeliveries: model(
    "pendingDelivery",
    pendingDeliverySchema,
    "pending_deliveries",
  ),
  giveaways: model("giveaway", giveawaySchema, "giveaways"),
  dmQueue: model("dmQueue", dmQueueSchema, "dm_queue"),
};

export type GuildSchema = InferSchemaType<typeof guildSchema>;
export type MemberSchema = InferSchemaType<typeof memberSchema>;
export type TicketSchema = InferSchemaType<typeof ticketSchema>;
export type TranscriptSchema = InferSchemaType<typeof transcriptSchema>;
export type GiveawaySchema = InferSchemaType<typeof giveawaySchema>;

export { cleanupGuildCache } from "./schemas/guild.js";

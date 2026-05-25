import mongoose, { InferSchemaType, model } from "mongoose";
import { guildSchema } from "./schemas/guild.js";
import { memberSchema } from "./schemas/member.js";
import { ticketSchema } from "./schemas/ticket.js";
import { transcriptSchema } from "./schemas/transcript.js";
import { pendingDeliverySchema } from "./schemas/pendingDelivery.js";
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

export const db = {
  guilds: model("guild", guildSchema, "guilds"),
  members: model("member", memberSchema, "members"),
  tickets: model("ticket", ticketSchema, "tickets"),
  transcripts: model("transcript", transcriptSchema, "transcripts"),
  pendingDeliveries: model("pendingDelivery", pendingDeliverySchema, "pending_deliveries"),
};

export type GuildSchema = InferSchemaType<typeof guildSchema>;
export type MemberSchema = InferSchemaType<typeof memberSchema>;
export type TicketSchema = InferSchemaType<typeof ticketSchema>;
export type TranscriptSchema = InferSchemaType<typeof transcriptSchema>;

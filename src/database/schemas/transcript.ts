import { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    id: { type: String, required: true },
    messageId: { type: String, required: true },
    authorId: { type: String, required: true },
    authorUsername: { type: String, required: true },
    authorAvatar: String,
    authorBot: { type: Boolean, default: false },
    isStaff: { type: Boolean, default: false },
    content: { type: String, default: "" },
    timestamp: { type: String, required: true },
    attachments: [
      {
        url: String,
        filename: String,
        contentType: String,
        width: Number,
        height: Number,
      },
    ],
    embeds: [
      {
        title: String,
        description: String,
        color: Number,
        image: String,
        thumbnail: String,
      },
    ],
  },
  { _id: false },
);

export const transcriptSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    guildName: String,
    channelId: { type: String, required: true },
    channelName: String,
    category: { type: String, default: "Suporte" },
    description: String,
    createdAt: { type: String, required: true },
    closedAt: String,
    openedBy: {
      id: { type: String, required: true },
      username: { type: String, required: true },
      avatar: String,
    },
    closedBy: {
      id: String,
      username: String,
      avatar: String,
    },
    claimedBy: {
      id: String,
      username: String,
      avatar: String,
    },
    deliveries: [
      {
        url: String,
        filename: String,
        description: String,
        deliveredBy: String,
        deliveredAt: String,
      },
    ],
    messageCount: { type: Number, default: 0 },
    messages: [messageSchema],
  },
  {
    timestamps: true,
    collection: "transcripts", // Forçar o nome da coleção para bater com o Next.js
  },
);

transcriptSchema.index({ guildId: 1, createdAt: -1 });
transcriptSchema.index({ channelId: 1 });

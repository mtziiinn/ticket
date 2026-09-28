import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import {
  AuditLogEvent,
  ForumChannel,
  MediaChannel,
  NewsChannel,
  TextChannel,
  VoiceChannel,
} from "discord.js";
import { getEmojiTag, sendBotLog } from "#functions";

type WebhookUpdateChannel = TextChannel | NewsChannel | VoiceChannel | ForumChannel | MediaChannel;

const WEBHOOK_LOG_TYPES = [
  { type: AuditLogEvent.WebhookCreate, label: "Criado", emoji: "action_add" as const, color: "#22c55e" },
  { type: AuditLogEvent.WebhookDelete, label: "Excluído", emoji: "action_remove" as const, color: "#ef4444" },
  { type: AuditLogEvent.WebhookUpdate, label: "Atualizado", emoji: "action_info" as const, color: "#eab308" },
];

// webhookUpdate só avisa "algo mudou nos webhooks desse canal", sem dizer o
// quê — usa o audit log pra descobrir se foi criação, edição ou exclusão.
createEvent({
  name: "webhookUpdate",
  event: "webhookUpdate",
  async run(channel: WebhookUpdateChannel) {
    const guild = channel.guild;
    if (!guild) return;

    try {
      const now = Date.now();
      let best: { entry: any; label: string; emoji: "action_add" | "action_remove" | "action_info"; color: string } | null = null;

      for (const t of WEBHOOK_LOG_TYPES) {
        const logs = await guild.fetchAuditLogs({ type: t.type, limit: 1 }).catch(() => null);
        const entry = logs?.entries.first();
        if (!entry) continue;
        if (now - entry.createdTimestamp > 10_000) continue;
        if (!best || entry.createdTimestamp > best.entry.createdTimestamp) {
          best = { entry, label: t.label, emoji: t.emoji, color: t.color };
        }
      }

      if (!best) return;

      const targetName = (best.entry.target as any)?.name || "Webhook";
      const executor = best.entry.executor;

      const container = createContainer(
        best.color,
        `## ${getEmojiTag(best.emoji)} Webhook ${best.label}`,
        [
          `| ${getEmojiTag("folder")} <#${channel.id}>`,
          `| \`${targetName}\``,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[webhookUpdate] Erro ao registrar log:", err);
    }
  },
});

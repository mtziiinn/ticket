import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import {
  AuditLogEvent,
  ChannelType,
  DMChannel,
  NonThreadGuildBasedChannel,
} from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

const channelTypeMap: Record<number, string> = {
  [ChannelType.GuildText]: "Texto",
  [ChannelType.GuildVoice]: "Voz",
  [ChannelType.GuildCategory]: "Categoria",
  [ChannelType.GuildAnnouncement]: "Anúncios",
  [ChannelType.GuildStageVoice]: "Palco",
  [ChannelType.GuildForum]: "Fórum",
};

createEvent({
  name: "channelDelete",
  event: "channelDelete",
  async run(channel: DMChannel | NonThreadGuildBasedChannel) {
    if (channel.isDMBased() || !channel.guild) return;

    try {
      const executor = await getAuditLogExecutor(
        channel.guild,
        AuditLogEvent.ChannelDelete,
        channel.id,
      );

      const typeName = channelTypeMap[channel.type] || `Tipo ${channel.type}`;

      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("action_x")} Canal Excluído`,
        [
          `| \`${channel.name}\` (\`${typeName}\`)`,
          executor ? `| Por: <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(channel.guild, container);
    } catch (err) {
      console.error("[channelDelete] Erro ao registrar log:", err);
    }
  },
});

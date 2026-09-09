import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, DMChannel, NonThreadGuildBasedChannel } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "channelUpdate",
  event: "channelUpdate",
  async run(
    oldChannel: DMChannel | NonThreadGuildBasedChannel,
    newChannel: DMChannel | NonThreadGuildBasedChannel,
  ) {
    if (oldChannel.isDMBased() || newChannel.isDMBased() || !newChannel.guild) return;

    try {
      const changes: string[] = [];

      if (oldChannel.name !== newChannel.name) {
        changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldChannel.name}\` ➔ \`${newChannel.name}\``);
      }

      if (oldChannel.parentId !== newChannel.parentId) {
        const oldParent = oldChannel.parent?.name || "Nenhuma";
        const newParent = newChannel.parent?.name || "Nenhuma";
        changes.push(`• ${getEmojiTag("folder_open")} Categoria: \`${oldParent}\` ➔ \`${newParent}\``);
      }

      const oldTopic = (oldChannel as any).topic || "";
      const newTopic = (newChannel as any).topic || "";
      if (oldTopic !== newTopic) {
        changes.push(`• ${getEmojiTag("clipboard")} Tópico alterado`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newChannel.guild,
        AuditLogEvent.ChannelUpdate,
        newChannel.id,
      );

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Canal Atualizado`,
        [
          `| ${getEmojiTag("folder")} <#${newChannel.id}>`,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(newChannel.guild, container);
    } catch (err) {
      console.error("[channelUpdate] Erro ao registrar log:", err);
    }
  },
});

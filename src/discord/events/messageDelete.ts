import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, Message, PartialMessage } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "messageDelete",
  event: "messageDelete",
  async run(message: Message | PartialMessage) {
    if (!message.guild) return;
    if (message.author?.bot) return;

    try {
      const executor = await getAuditLogExecutor(
        message.guild,
        AuditLogEvent.MessageDelete,
        message.author?.id,
      );

      const author = message.author;
      const content = message.content?.trim() || "*sem conteúdo*";

      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("action_x")} Mensagem Excluída`,
        [
          `| Canal: <#${message.channelId}>`,
          author ? `| Autor: <@${author.id}>` : "",
          executor ? `| Por: <@${executor.id}>` : "",
          `\`\`\`${content.slice(0, 300)}\`\`\``,
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(message.guild, container);
    } catch (err) {
      console.error("[messageDelete] Erro ao registrar log:", err);
    }
  },
});

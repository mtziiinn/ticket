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
      // Sem o autor (mensagem fora do cache) o audit log não tem como confirmar
      // quem apagou: buscar sem alvo poderia creditar outra exclusão.
      const executor = message.author
        ? await getAuditLogExecutor(
            message.guild,
            AuditLogEvent.MessageDelete,
            message.author.id,
          )
        : null;

      const author = message.author;
      const content = message.partial
        ? "*indisponível (mensagem fora do cache)*"
        : message.content?.trim() || "*sem conteúdo*";

      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("action_x")} Mensagem Excluída`,
        [
          `| ${getEmojiTag("folder")} <#${message.channelId}>`,
          author ? `| ${getEmojiTag("user")} <@${author.id}>` : "",
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
          `\`\`\`${content.slice(0, 300)}\`\`\``,
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(message.guild, container);
    } catch (err) {
      console.error("[messageDelete] Erro ao registrar log:", err);
    }
  },
});

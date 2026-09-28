import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { Message, PartialMessage } from "discord.js";
import { getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "messageUpdate",
  event: "messageUpdate",
  async run(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage,
  ) {
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;

    // Enquete finalizada: o texto da mensagem não muda, só o campo
    // poll.resultsFinalized — tratado separado do diff de conteúdo abaixo.
    if (
      !oldMessage.partial &&
      oldMessage.poll &&
      newMessage.poll &&
      !oldMessage.poll.resultsFinalized &&
      newMessage.poll.resultsFinalized
    ) {
      try {
        const container = createContainer(
          constants.colors.primary,
          `## ${getEmojiTag("action_check")} Enquete Finalizada`,
          [
            `| Canal: <#${newMessage.channelId}>`,
            `| \`${newMessage.poll.question.text || "Enquete"}\``,
            `| [Ir para a mensagem](${newMessage.url})`,
          ].join("\n"),
        );
        await sendBotLog(newMessage.guild, container);
      } catch (err) {
        console.error("[messageUpdate] Erro ao registrar log de enquete:", err);
      }
    }

    // Sem a versão antiga no cache não dá para saber se houve edição: só segue
    // se a edição é recente (evita logar atualização de prévia de link).
    if (oldMessage.partial) {
      const editedAt = newMessage.editedTimestamp;
      if (!editedAt || Date.now() - editedAt > 30_000) return;
    }

    const oldContent = oldMessage.content?.trim();
    const newContent = newMessage.content?.trim();

    if (oldContent === newContent) return;
    if (!oldContent && !newContent) return;

    try {
      const author = newMessage.author;
      const beforeText = oldMessage.partial
        ? "*indisponível (mensagem fora do cache)*"
        : oldContent || "*vazio*";
      const afterText = newContent || "*vazio*";

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Mensagem Editada`,
        [
          `| Canal: <#${newMessage.channelId}>`,
          author ? `| Autor: <@${author.id}>` : "",
          `| [Ir para a mensagem](${newMessage.url})`,
          `**Antes:**\n\`\`\`${beforeText.slice(0, 300)}\`\`\``,
          `**Depois:**\n\`\`\`${afterText.slice(0, 300)}\`\`\``,
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(newMessage.guild, container);
    } catch (err) {
      console.error("[messageUpdate] Erro ao registrar log:", err);
    }
  },
});

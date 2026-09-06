import { createEvent } from "#base";
import { createContainer, createSection, Separator } from "@magicyan/discord";
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

    const oldContent = oldMessage.content?.trim();
    const newContent = newMessage.content?.trim();

    // Se o conteúdo for igual (ex: carregamento de embed ou pin), ignorar
    if (oldContent === newContent) return;
    if (!oldContent && !newContent) return;

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const author = newMessage.author;
      const authorAvatar =
        author?.displayAvatarURL() ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      const beforeText = oldContent || "*Conteúdo anterior não armazenado em cache.*";
      const afterText = newContent || "*Mensagem vazia.*";

      const container = createContainer(
        "#eab308",
        createSection({
          content: `## ${getEmojiTag("action_info")} Mensagem Editada\nUma mensagem foi modificada em <#${newMessage.channelId}>.`,
          thumbnail: authorAvatar as any,
        }),
        Separator.Default,
        [
          `| ${getEmojiTag("user")} **Autor:** ${author ? `<@${author.id}> (\`${author.tag}\`)` : "*Desconhecido*"}`,
          `| ${getEmojiTag("folder")} **Canal:** <#${newMessage.channelId}>`,
          `| ${getEmojiTag("action_check")} **Mensagem Original:** [Ir para a mensagem](${newMessage.url})`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
        Separator.Default,
        `**Antes:**\n\`\`\`\n${beforeText.slice(0, 500)}\n\`\`\``,
        `**Depois:**\n\`\`\`\n${afterText.slice(0, 500)}\n\`\`\``,
      );

      await sendBotLog(newMessage.guild, container);
    } catch (err) {
      console.error("[messageUpdate] Erro ao registrar log:", err);
    }
  },
});

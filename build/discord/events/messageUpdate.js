import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "messageUpdate",
    event: "messageUpdate",
    async run(oldMessage, newMessage) {
        if (!newMessage.guild)
            return;
        if (newMessage.author?.bot)
            return;
        const oldContent = oldMessage.content?.trim();
        const newContent = newMessage.content?.trim();
        if (oldContent === newContent)
            return;
        if (!oldContent && !newContent)
            return;
        try {
            const author = newMessage.author;
            const beforeText = oldContent || "*vazio*";
            const afterText = newContent || "*vazio*";
            const container = createContainer("#eab308", `## ${getEmojiTag("action_info")} Mensagem Editada`, [
                `| Canal: <#${newMessage.channelId}>`,
                author ? `| Autor: <@${author.id}>` : "",
                `| [Ir para a mensagem](${newMessage.url})`,
                `**Antes:**\n\`\`\`${beforeText.slice(0, 300)}\`\`\``,
                `**Depois:**\n\`\`\`${afterText.slice(0, 300)}\`\`\``,
            ].filter(Boolean).join("\n"));
            await sendBotLog(newMessage.guild, container);
        }
        catch (err) {
            console.error("[messageUpdate] Erro ao registrar log:", err);
        }
    },
});

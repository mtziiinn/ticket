import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "messageDelete",
    event: "messageDelete",
    async run(message) {
        if (!message.guild)
            return;
        if (message.author?.bot)
            return;
        try {
            const executor = await getAuditLogExecutor(message.guild, AuditLogEvent.MessageDelete, message.author?.id);
            const author = message.author;
            const content = message.content?.trim() || "*sem conteúdo*";
            const container = createContainer("#ef4444", `## ${getEmojiTag("action_x")} Mensagem Excluída`, [
                `| ${getEmojiTag("folder")} <#${message.channelId}>`,
                author ? `| ${getEmojiTag("user")} <@${author.id}>` : "",
                executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
                `\`\`\`${content.slice(0, 300)}\`\`\``,
            ].filter(Boolean).join("\n"));
            await sendBotLog(message.guild, container);
        }
        catch (err) {
            console.error("[messageDelete] Erro ao registrar log:", err);
        }
    },
});

import { createEvent } from "#base";
import { createContainer, createSection, Separator } from "@magicyan/discord";
import { AuditLogEvent } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "messageDelete",
    event: "messageDelete",
    async run(message) {
        if (!message.guild)
            return;
        // Ignorar mensagens de bots para evitar spam em comandos/painéis
        if (message.author?.bot)
            return;
        try {
            const executor = await getAuditLogExecutor(message.guild, AuditLogEvent.MessageDelete, message.author?.id);
            const timestamp = Math.floor(Date.now() / 1000);
            const author = message.author;
            const authorAvatar = author?.displayAvatarURL() ||
                "https://cdn.discordapp.com/embed/avatars/0.png";
            const content = message.content?.trim() || "*Mensagem sem texto ou não armazenada em cache.*";
            const attachmentsCount = message.attachments?.size ?? 0;
            const attachmentText = attachmentsCount > 0
                ? `\n| ${getEmojiTag("apps_figma")} **Anexos:** \`${attachmentsCount}\` arquivo(s)`
                : "";
            const container = createContainer("#ef4444", createSection({
                content: `## ${getEmojiTag("action_x")} Mensagem Excluída\nUma mensagem foi apagada em <#${message.channelId}>.`,
                thumbnail: authorAvatar,
            }), Separator.Default, [
                `| ${getEmojiTag("user")} **Autor:** ${author ? `<@${author.id}> (\`${author.tag}\`)` : "*Desconhecido*"}`,
                `| ${getEmojiTag("folder")} **Canal:** <#${message.channelId}>`,
                `| ${getEmojiTag("user_remove")} **Apagada por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : (author ? `<@${author.id}> (O próprio autor)` : "*Desconhecido*")}`,
                `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)${attachmentText}`,
            ].join("\n"), Separator.Default, `**Conteúdo Apagado:**\n\`\`\`\n${content.slice(0, 1000)}\n\`\`\``);
            await sendBotLog(message.guild, container);
        }
        catch (err) {
            console.error("[messageDelete] Erro ao registrar log:", err);
        }
    },
});

import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "emojiCreate",
    event: "emojiCreate",
    async run(emoji) {
        try {
            const executor = await getAuditLogExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
            const emojiDisplay = emoji.animated
                ? `<a:${emoji.name}:${emoji.id}>`
                : `<:${emoji.name}:${emoji.id}>`;
            const container = createContainer("#38bdf8", `## ${getEmojiTag("action_check")} Emoji Adicionado`, [
                `| ${getEmojiTag("apps_figma")} ${emojiDisplay} \`:${emoji.name}:\``,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(emoji.guild, container);
        }
        catch (err) {
            console.error("[emojiCreate] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "emojiDelete",
    event: "emojiDelete",
    async run(emoji) {
        try {
            const executor = await getAuditLogExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
            const container = createContainer("#ef4444", `## ${getEmojiTag("action_x")} Emoji Excluído`, [
                `| ${getEmojiTag("apps_figma")} \`:${emoji.name}:\``,
                executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(emoji.guild, container);
        }
        catch (err) {
            console.error("[emojiDelete] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "emojiUpdate",
    event: "emojiUpdate",
    async run(oldEmoji, newEmoji) {
        if (oldEmoji.name === newEmoji.name)
            return;
        try {
            const executor = await getAuditLogExecutor(newEmoji.guild, AuditLogEvent.EmojiUpdate, newEmoji.id);
            const emojiDisplay = newEmoji.animated
                ? `<a:${newEmoji.name}:${newEmoji.id}>`
                : `<:${newEmoji.name}:${newEmoji.id}>`;
            const container = createContainer("#eab308", `## ${getEmojiTag("action_info")} Emoji Renomeado`, [
                `| ${getEmojiTag("apps_figma")} ${emojiDisplay}`,
                `| \`${oldEmoji.name}\` ➔ \`${newEmoji.name}\``,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(newEmoji.guild, container);
        }
        catch (err) {
            console.error("[emojiUpdate] Erro ao registrar log:", err);
        }
    },
});

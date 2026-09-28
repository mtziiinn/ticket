import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "stickerCreate",
    event: "stickerCreate",
    async run(sticker) {
        if (!sticker.guild)
            return;
        try {
            const executor = await getAuditLogExecutor(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);
            const container = createContainer(constants.colors.primary, `## ${getEmojiTag("file_add")} Figurinha Criada`, [
                `| ${getEmojiTag("file")} \`${sticker.name}\``,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(sticker.guild, container);
        }
        catch (err) {
            console.error("[stickerCreate] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "stickerDelete",
    event: "stickerDelete",
    async run(sticker) {
        if (!sticker.guild)
            return;
        try {
            const executor = await getAuditLogExecutor(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);
            const container = createContainer("#ef4444", `## ${getEmojiTag("file_remove")} Figurinha Excluída`, [
                `| ${getEmojiTag("file")} \`${sticker.name}\``,
                executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(sticker.guild, container);
        }
        catch (err) {
            console.error("[stickerDelete] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "stickerUpdate",
    event: "stickerUpdate",
    async run(oldSticker, newSticker) {
        if (!newSticker.guild)
            return;
        try {
            const changes = [];
            if (oldSticker.name !== newSticker.name) {
                changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldSticker.name}\` ➔ \`${newSticker.name}\``);
            }
            if (oldSticker.description !== newSticker.description) {
                changes.push(`• ${getEmojiTag("clipboard")} Descrição alterada`);
            }
            if (oldSticker.tags !== newSticker.tags) {
                changes.push(`• ${getEmojiTag("action_info")} Emoji relacionado: \`${oldSticker.tags || "nenhum"}\` ➔ \`${newSticker.tags || "nenhum"}\``);
            }
            if (changes.length === 0)
                return;
            const executor = await getAuditLogExecutor(newSticker.guild, AuditLogEvent.StickerUpdate, newSticker.id);
            const container = createContainer("#eab308", `## ${getEmojiTag("action_info")} Figurinha Atualizada`, [
                `| ${getEmojiTag("file")} \`${newSticker.name}\``,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
                changes.join("\n"),
            ].filter(Boolean).join("\n"));
            await sendBotLog(newSticker.guild, container);
        }
        catch (err) {
            console.error("[stickerUpdate] Erro ao registrar log:", err);
        }
    },
});

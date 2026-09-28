import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "threadCreate",
    event: "threadCreate",
    async run(thread, newlyCreated) {
        // Threads recuperadas do cache ao iniciar o bot não contam como "criadas agora".
        if (!newlyCreated)
            return;
        try {
            const executor = await getAuditLogExecutor(thread.guild, AuditLogEvent.ThreadCreate, thread.id);
            const container = createContainer(constants.colors.primary, `## ${getEmojiTag("clipboard_add")} Thread Criada`, [
                `| ${getEmojiTag("folder")} <#${thread.id}> (\`${thread.name}\`)`,
                `| ${getEmojiTag("folder_open")} Canal pai: ${thread.parentId ? `<#${thread.parentId}>` : "Nenhum"}`,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(thread.guild, container);
        }
        catch (err) {
            console.error("[threadCreate] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "threadDelete",
    event: "threadDelete",
    async run(thread) {
        try {
            const executor = await getAuditLogExecutor(thread.guild, AuditLogEvent.ThreadDelete, thread.id);
            const container = createContainer("#ef4444", `## ${getEmojiTag("clipboard_remove")} Thread Excluída`, [
                `| ${getEmojiTag("folder")} \`${thread.name}\``,
                executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(thread.guild, container);
        }
        catch (err) {
            console.error("[threadDelete] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "threadUpdate",
    event: "threadUpdate",
    async run(oldThread, newThread) {
        try {
            const changes = [];
            if (oldThread.name !== newThread.name) {
                changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldThread.name}\` ➔ \`${newThread.name}\``);
            }
            if (oldThread.archived !== newThread.archived) {
                changes.push(`• ${getEmojiTag("action_info")} ${newThread.archived ? "Arquivada" : "Desarquivada"}`);
            }
            if (oldThread.locked !== newThread.locked) {
                changes.push(`• ${getEmojiTag("lock")} ${newThread.locked ? "Trancada" : "Destrancada"}`);
            }
            if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) {
                changes.push(`• ${getEmojiTag("clock")} Slowmode: \`${oldThread.rateLimitPerUser ?? 0}s\` ➔ \`${newThread.rateLimitPerUser ?? 0}s\``);
            }
            if (oldThread.autoArchiveDuration !== newThread.autoArchiveDuration) {
                changes.push(`• ${getEmojiTag("clock")} Arquivamento automático: \`${oldThread.autoArchiveDuration ?? 0}min\` ➔ \`${newThread.autoArchiveDuration ?? 0}min\``);
            }
            if (changes.length === 0)
                return;
            const executor = await getAuditLogExecutor(newThread.guild, AuditLogEvent.ThreadUpdate, newThread.id);
            const container = createContainer("#eab308", `## ${getEmojiTag("action_info")} Thread Atualizada`, [
                `| ${getEmojiTag("folder")} <#${newThread.id}>`,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
                changes.join("\n"),
            ].filter(Boolean).join("\n"));
            await sendBotLog(newThread.guild, container);
        }
        catch (err) {
            console.error("[threadUpdate] Erro ao registrar log:", err);
        }
    },
});

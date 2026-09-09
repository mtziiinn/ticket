import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "guildBanAdd",
    event: "guildBanAdd",
    async run(ban) {
        try {
            const executor = await getAuditLogExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
            const reason = ban.reason || "*sem motivo*";
            const container = createContainer("#ef4444", `## ${getEmojiTag("action_x")} Membro Banido`, [
                `| ${getEmojiTag("user")} <@${ban.user.id}>`,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
                `| ${getEmojiTag("action_info")} Motivo: ${reason}`,
            ].filter(Boolean).join("\n"));
            await sendBotLog(ban.guild, container);
        }
        catch (err) {
            console.error("[guildBanAdd] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "guildBanRemove",
    event: "guildBanRemove",
    async run(ban) {
        try {
            const executor = await getAuditLogExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
            const container = createContainer("#38bdf8", `## ${getEmojiTag("action_check")} Membro Desbanido`, [
                `| ${getEmojiTag("user")} <@${ban.user.id}>`,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(ban.guild, container);
        }
        catch (err) {
            console.error("[guildBanRemove] Erro ao registrar log:", err);
        }
    },
});

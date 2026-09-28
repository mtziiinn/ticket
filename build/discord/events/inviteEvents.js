import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "inviteCreate",
    event: "inviteCreate",
    async run(invite) {
        if (!invite.channel || !("guild" in invite.channel))
            return;
        const guild = invite.channel.guild;
        try {
            const inviter = invite.inviter;
            const container = createContainer(constants.colors.primary, `## ${getEmojiTag("mail_add")} Convite Criado`, [
                `| ${getEmojiTag("folder")} <#${invite.channelId}>`,
                `| \`${invite.code}\``,
                inviter ? `| ${getEmojiTag("user_check")} <@${inviter.id}>` : "",
                `| ${getEmojiTag("clock")} Expira: ${invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : "nunca"}`,
            ].filter(Boolean).join("\n"));
            await sendBotLog(guild, container);
        }
        catch (err) {
            console.error("[inviteCreate] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "inviteDelete",
    event: "inviteDelete",
    async run(invite) {
        if (!invite.channel || !("guild" in invite.channel))
            return;
        const guild = invite.channel.guild;
        try {
            const executor = await getAuditLogExecutor(guild, AuditLogEvent.InviteDelete, invite.code);
            const container = createContainer("#ef4444", `## ${getEmojiTag("mail_remove")} Convite Excluído`, [
                `| \`${invite.code}\``,
                executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(guild, container);
        }
        catch (err) {
            console.error("[inviteDelete] Erro ao registrar log:", err);
        }
    },
});

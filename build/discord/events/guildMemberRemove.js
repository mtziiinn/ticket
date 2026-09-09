import { createEvent } from "#base";
import { db } from "#database";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "guildMemberRemove",
    event: "guildMemberRemove",
    async run(member) {
        try {
            const guildData = await db.guilds.get(member.guild.id);
            const kickExecutor = await getAuditLogExecutor(member.guild, AuditLogEvent.MemberKick, member.id);
            const isKick = !!kickExecutor;
            const logContainer = createContainer("#ef4444", `## ${getEmojiTag("user_remove")} ${isKick ? "Membro Expulso" : "Membro Saiu"}`, [
                `| <@${member.id}>`,
                isKick ? `| Staff: <@${kickExecutor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(member.guild, logContainer);
            // Notificação no Canal de Saída configurado
            const w = guildData.welcome;
            if (w?.channelExit) {
                const exitChan = member.guild.channels.cache.get(w.channelExit);
                if (exitChan && exitChan.isTextBased()) {
                    const exitContainer = createContainer("#ED4245", `## ${getEmojiTag("user_remove")} Um membro saiu`, `<@${member.id}> saiu.\nAgora somos **${member.guild.memberCount}**.`);
                    await exitChan.send({
                        components: [exitContainer],
                        flags: ["IsComponentsV2"],
                    }).catch(() => { });
                }
            }
        }
        catch (err) {
            console.error("[guildMemberRemove] Erro:", err);
        }
    },
});

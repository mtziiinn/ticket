import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "guildMemberUpdate",
    event: "guildMemberUpdate",
    async run(oldMember, newMember) {
        try {
            // Sem o estado antigo confiável não dá para dizer "o que mudou".
            // Membro parcial (não estava em cache) => abortar em vez de logar algo errado.
            if (oldMember.partial)
                return;
            const changes = [];
            let auditEvent = AuditLogEvent.MemberUpdate;
            // Cargos adicionados / removidos (nome, sem menção para não gerar ping)
            const addedRoles = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
            const removedRoles = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));
            if (addedRoles.size > 0) {
                auditEvent = AuditLogEvent.MemberRoleUpdate;
                const roleList = addedRoles.map((r) => `\`${r.name}\``).join(", ");
                changes.push(`• ${getEmojiTag("action_add")} **Cargos adicionados:** ${roleList}`);
            }
            if (removedRoles.size > 0) {
                auditEvent = AuditLogEvent.MemberRoleUpdate;
                const roleList = removedRoles.map((r) => `\`${r.name}\``).join(", ");
                changes.push(`• ${getEmojiTag("action_remove")} **Cargos removidos:** ${roleList}`);
            }
            // Apelido (nickname)
            if (oldMember.nickname !== newMember.nickname) {
                const before = oldMember.nickname
                    ? `\`${oldMember.nickname}\``
                    : "*nenhum*";
                const after = newMember.nickname
                    ? `\`${newMember.nickname}\``
                    : "*nenhum*";
                changes.push(`• ${getEmojiTag("user")} **Apelido:** ${before} ➔ ${after}`);
            }
            // Avatar exclusivo do servidor
            if (oldMember.avatar !== newMember.avatar) {
                changes.push(`• ${getEmojiTag("user")} **Avatar no servidor:** ${newMember.avatar ? "atualizado" : "removido"}`);
            }
            // Boost / impulso do servidor
            if (oldMember.premiumSinceTimestamp !== newMember.premiumSinceTimestamp) {
                changes.push(newMember.premiumSinceTimestamp
                    ? `• ${getEmojiTag("action_add")} **Começou a impulsionar o servidor**`
                    : `• ${getEmojiTag("action_remove")} **Deixou de impulsionar o servidor**`);
            }
            // Triagem de membros (membership screening)
            if (oldMember.pending && !newMember.pending) {
                changes.push(`• ${getEmojiTag("action_check")} **Concluiu a triagem de membros**`);
            }
            // Timeout (silenciar / castigo)
            const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
            const newTimeout = newMember.communicationDisabledUntilTimestamp;
            if (oldTimeout !== newTimeout) {
                if (newTimeout && newTimeout > Date.now()) {
                    const timeoutDate = Math.floor(newTimeout / 1000);
                    changes.push(`• ${getEmojiTag("lock")} **Timeout aplicado:** expira <t:${timeoutDate}:R>`);
                }
                else {
                    changes.push(`• ${getEmojiTag("unlock")} **Timeout removido**`);
                }
            }
            if (changes.length === 0)
                return;
            const executor = await getAuditLogExecutor(newMember.guild, auditEvent, newMember.id);
            const headerLines = [
                `| ${getEmojiTag("user")} <@${newMember.id}> (\`${newMember.user.tag}\`)`,
                executor
                    ? `| ${getEmojiTag("user_check")} **Alterado por:** <@${executor.id}>`
                    : "",
            ].filter(Boolean);
            const container = createContainer("#3b82f6", `## ${getEmojiTag("user_users")} Membro Atualizado`, [...headerLines, "", "### O que mudou:", changes.join("\n")].join("\n"));
            await sendBotLog(newMember.guild, container);
        }
        catch (err) {
            console.error("[guildMemberUpdate] Erro ao registrar log:", err);
        }
    },
});

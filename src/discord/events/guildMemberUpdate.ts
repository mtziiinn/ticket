import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import {
  AuditLogEvent,
  GuildMember,
  PartialGuildMember,
} from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "guildMemberUpdate",
  event: "guildMemberUpdate",
  async run(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ) {
    try {
      const changes: string[] = [];
      let auditEvent: AuditLogEvent = AuditLogEvent.MemberUpdate;

      const addedRoles = newMember.roles.cache.filter(
        (role) => !oldMember.roles.cache.has(role.id),
      );
      const removedRoles = oldMember.roles.cache.filter(
        (role) => !newMember.roles.cache.has(role.id),
      );

      if (addedRoles.size > 0) {
        auditEvent = AuditLogEvent.MemberRoleUpdate;
        const roleList = addedRoles.map((r) => `<@&${r.id}>`).join(", ");
        changes.push(`• ${getEmojiTag("action_add")} + ${roleList}`);
      }

      if (removedRoles.size > 0) {
        auditEvent = AuditLogEvent.MemberRoleUpdate;
        const roleList = removedRoles.map((r) => `<@&${r.id}>`).join(", ");
        changes.push(`• ${getEmojiTag("action_remove")} - ${roleList}`);
      }

      const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
      const newTimeout = newMember.communicationDisabledUntilTimestamp;
      if (oldTimeout !== newTimeout) {
        if (newTimeout && newTimeout > Date.now()) {
          const timeoutDate = Math.floor(newTimeout / 1000);
          changes.push(`• ${getEmojiTag("lock")} Timeout: <t:${timeoutDate}:R>`);
        } else {
          changes.push(`• ${getEmojiTag("unlock")} Timeout removido`);
        }
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newMember.guild,
        auditEvent,
        newMember.id,
      );

      const container = createContainer(
        "#3b82f6",
        `## ${getEmojiTag("user_users")} Membro Atualizado`,
        [
          `| ${getEmojiTag("user")} <@${newMember.id}>`,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(newMember.guild, container);
    } catch (err) {
      console.error("[guildMemberUpdate] Erro ao registrar log:", err);
    }
  },
});

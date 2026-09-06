import { createEvent } from "#base";
import { createContainer, createSection, Separator } from "@magicyan/discord";
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

      // 1. Mudança de Apelido (Nickname)
      const oldNick = oldMember.nickname || oldMember.user?.username || "*Sem apelido*";
      const newNick = newMember.nickname || newMember.user?.username || "*Sem apelido*";
      if (oldMember.nickname !== newMember.nickname) {
        changes.push(
          `• **Apelido no Servidor:**\n  - Antes: \`${oldNick}\`\n  - Depois: \`${newNick}\``,
        );
      }

      // 2. Cargos Adicionados ou Removidos
      const addedRoles = newMember.roles.cache.filter(
        (role) => !oldMember.roles.cache.has(role.id),
      );
      const removedRoles = oldMember.roles.cache.filter(
        (role) => !newMember.roles.cache.has(role.id),
      );

      if (addedRoles.size > 0) {
        auditEvent = AuditLogEvent.MemberRoleUpdate;
        const roleList = addedRoles.map((r) => `<@&${r.id}>`).join(", ");
        changes.push(`• **Cargo(s) Adicionado(s):** ${roleList}`);
      }

      if (removedRoles.size > 0) {
        auditEvent = AuditLogEvent.MemberRoleUpdate;
        const roleList = removedRoles.map((r) => `<@&${r.id}>`).join(", ");
        changes.push(`• **Cargo(s) Removido(s):** ${roleList}`);
      }

      // 3. Timeout / Castigo
      const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
      const newTimeout = newMember.communicationDisabledUntilTimestamp;
      if (oldTimeout !== newTimeout) {
        if (newTimeout && newTimeout > Date.now()) {
          const timeoutDate = Math.floor(newTimeout / 1000);
          changes.push(
            `• **Castigo Aplicado (Timeout):** Até <t:${timeoutDate}:f> (<t:${timeoutDate}:R>)`,
          );
        } else {
          changes.push(`• **Castigo Removido:** O timeout do membro foi retirado.`);
        }
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newMember.guild,
        auditEvent,
        newMember.id,
      );

      const timestamp = Math.floor(Date.now() / 1000);
      const userAvatar =
        newMember.user.displayAvatarURL() ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      const container = createContainer(
        "#3b82f6",
        createSection({
          content: `## ${getEmojiTag("user_users")} Membro Atualizado\nAlterações registradas no perfil de <@${newMember.id}>.`,
          thumbnail: userAvatar as any,
        }),
        Separator.Default,
        [
          `| ${getEmojiTag("user")} **Usuário:** <@${newMember.id}> (\`${newMember.user.tag}\` | \`${newMember.id}\`)`,
          `| ${getEmojiTag("user_check")} **Responsável:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*O próprio usuário ou Discord*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
        Separator.Default,
        `### Modificações:\n${changes.join("\n")}`,
      );

      await sendBotLog(newMember.guild, container);
    } catch (err) {
      console.error("[guildMemberUpdate] Erro ao registrar log:", err);
    }
  },
});

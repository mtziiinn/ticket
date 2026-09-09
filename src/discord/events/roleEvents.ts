import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, Role } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "roleCreate",
  event: "roleCreate",
  async run(role: Role) {
    try {
      const executor = await getAuditLogExecutor(
        role.guild,
        AuditLogEvent.RoleCreate,
        role.id,
      );

      const container = createContainer(
        "#38bdf8",
        `## ${getEmojiTag("action_check")} Cargo Criado`,
        [
          `| <@&${role.id}>`,
          executor ? `| Por: <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(role.guild, container);
    } catch (err) {
      console.error("[roleCreate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "roleDelete",
  event: "roleDelete",
  async run(role: Role) {
    try {
      const executor = await getAuditLogExecutor(
        role.guild,
        AuditLogEvent.RoleDelete,
        role.id,
      );

      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("action_x")} Cargo Excluído`,
        [
          `| \`${role.name}\``,
          executor ? `| Por: <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(role.guild, container);
    } catch (err) {
      console.error("[roleDelete] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "roleUpdate",
  event: "roleUpdate",
  async run(oldRole: Role, newRole: Role) {
    try {
      const changes: string[] = [];

      if (oldRole.name !== newRole.name) {
        changes.push(`• Nome: \`${oldRole.name}\` ➔ \`${newRole.name}\``);
      }

      if (oldRole.hexColor !== newRole.hexColor) {
        changes.push(`• Cor: \`${oldRole.hexColor}\` ➔ \`${newRole.hexColor}\``);
      }

      if (oldRole.hoist !== newRole.hoist) {
        changes.push(`• Exibir: \`${oldRole.hoist ? "Sim" : "Não"}\` ➔ \`${newRole.hoist ? "Sim" : "Não"}\``);
      }

      if (oldRole.mentionable !== newRole.mentionable) {
        changes.push(`• Mencionável: \`${oldRole.mentionable ? "Sim" : "Não"}\` ➔ \`${newRole.mentionable ? "Sim" : "Não"}\``);
      }

      if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        changes.push(`• Permissões modificadas`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newRole.guild,
        AuditLogEvent.RoleUpdate,
        newRole.id,
      );

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Cargo Atualizado`,
        [
          `| <@&${newRole.id}>`,
          executor ? `| Por: <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(newRole.guild, container);
    } catch (err) {
      console.error("[roleUpdate] Erro ao registrar log:", err);
    }
  },
});

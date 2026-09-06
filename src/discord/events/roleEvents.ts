import { createEvent } from "#base";
import { createContainer, Separator } from "@magicyan/discord";
import { AuditLogEvent, Role } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

// 1. Cargo Criado
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

      const timestamp = Math.floor(Date.now() / 1000);

      const container = createContainer(
        "#22c55e",
        `## ${getEmojiTag("action_check")} Cargo Criado`,
        Separator.Default,
        [
          `| ${getEmojiTag("user_users")} **Cargo:** <@&${role.id}> (\`${role.name}\`)`,
          `| ${getEmojiTag("apps_figma")} **Cor:** \`${role.hexColor}\``,
          `| ${getEmojiTag("user_check")} **Criado por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
      );

      await sendBotLog(role.guild, container);
    } catch (err) {
      console.error("[roleCreate] Erro ao registrar log:", err);
    }
  },
});

// 2. Cargo Excluído
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

      const timestamp = Math.floor(Date.now() / 1000);

      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("action_x")} Cargo Excluído`,
        Separator.Default,
        [
          `| ${getEmojiTag("user_users")} **Cargo:** \`${role.name}\` (\`${role.id}\`)`,
          `| ${getEmojiTag("user_remove")} **Excluído por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
      );

      await sendBotLog(role.guild, container);
    } catch (err) {
      console.error("[roleDelete] Erro ao registrar log:", err);
    }
  },
});

// 3. Cargo Atualizado
createEvent({
  name: "roleUpdate",
  event: "roleUpdate",
  async run(oldRole: Role, newRole: Role) {
    try {
      const changes: string[] = [];

      // Nome
      if (oldRole.name !== newRole.name) {
        changes.push(`• **Nome:** \`${oldRole.name}\` ➔ \`${newRole.name}\``);
      }

      // Cor
      if (oldRole.hexColor !== newRole.hexColor) {
        changes.push(`• **Cor:** \`${oldRole.hexColor}\` ➔ \`${newRole.hexColor}\``);
      }

      // Exibir separadamente (hoist)
      if (oldRole.hoist !== newRole.hoist) {
        changes.push(
          `• **Exibir Separadamente:** \`${oldRole.hoist ? "Sim" : "Não"}\` ➔ \`${newRole.hoist ? "Sim" : "Não"}\``,
        );
      }

      // Mencionável
      if (oldRole.mentionable !== newRole.mentionable) {
        changes.push(
          `• **Mencionável por Todos:** \`${oldRole.mentionable ? "Sim" : "Não"}\` ➔ \`${newRole.mentionable ? "Sim" : "Não"}\``,
        );
      }

      // Permissões
      if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        changes.push(`• **Permissões:** As permissões do cargo foram modificadas.`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newRole.guild,
        AuditLogEvent.RoleUpdate,
        newRole.id,
      );

      const timestamp = Math.floor(Date.now() / 1000);

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Cargo Atualizado`,
        Separator.Default,
        [
          `| ${getEmojiTag("user_users")} **Cargo:** <@&${newRole.id}> (\`${newRole.name}\`)`,
          `| ${getEmojiTag("user_check")} **Alterado por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
        Separator.Default,
        `### Alterações:\n${changes.join("\n")}`,
      );

      await sendBotLog(newRole.guild, container);
    } catch (err) {
      console.error("[roleUpdate] Erro ao registrar log:", err);
    }
  },
});

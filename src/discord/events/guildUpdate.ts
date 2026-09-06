import { createEvent } from "#base";
import { createContainer, createSection, Separator } from "@magicyan/discord";
import { AuditLogEvent, Guild } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "guildUpdate",
  event: "guildUpdate",
  async run(oldGuild: Guild, newGuild: Guild) {
    try {
      const changes: string[] = [];

      // Nome
      if (oldGuild.name !== newGuild.name) {
        changes.push(`• **Nome do Servidor:** \`${oldGuild.name}\` ➔ \`${newGuild.name}\``);
      }

      // Ícone
      if (oldGuild.icon !== newGuild.icon) {
        changes.push(`• **Ícone do Servidor:** O ícone do servidor foi atualizado.`);
      }

      // Banner
      if (oldGuild.banner !== newGuild.banner) {
        changes.push(`• **Banner do Servidor:** O banner do servidor foi atualizado.`);
      }

      // Nível de Verificação
      if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
        changes.push(
          `• **Nível de Verificação:** \`${oldGuild.verificationLevel}\` ➔ \`${newGuild.verificationLevel}\``,
        );
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newGuild,
        AuditLogEvent.GuildUpdate,
      );

      const timestamp = Math.floor(Date.now() / 1000);
      const icon =
        newGuild.iconURL() ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      const container = createContainer(
        "#eab308",
        createSection({
          content: `## ${getEmojiTag("action_info")} Servidor Atualizado\nConfigurações de **${newGuild.name}** foram modificadas.`,
          thumbnail: icon as any,
        }),
        Separator.Default,
        [
          `| ${getEmojiTag("user_check")} **Alterado por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
        Separator.Default,
        `### Modificações:\n${changes.join("\n")}`,
      );

      await sendBotLog(newGuild, container);
    } catch (err) {
      console.error("[guildUpdate] Erro ao registrar log:", err);
    }
  },
});

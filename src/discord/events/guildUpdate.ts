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

      if (oldGuild.name !== newGuild.name) {
        changes.push(`• **Nome do Servidor:** \`${oldGuild.name}\` ➔ \`${newGuild.name}\``);
      }
      if (oldGuild.icon !== newGuild.icon) {
        changes.push(`• **Ícone do Servidor:** O ícone do servidor foi atualizado.`);
      }
      if (oldGuild.banner !== newGuild.banner) {
        changes.push(`• **Banner do Servidor:** O banner do servidor foi atualizado.`);
      }
      if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
        changes.push(`• **Nível de Verificação:** \`${oldGuild.verificationLevel}\` ➔ \`${newGuild.verificationLevel}\``);
      }
      if (oldGuild.description !== newGuild.description) {
        changes.push(`• **Descrição:** alterada`);
      }
      if (oldGuild.splash !== newGuild.splash) {
        changes.push(`• **Splash:** atualizado`);
      }
      if (oldGuild.discoverySplash !== newGuild.discoverySplash) {
        changes.push(`• **Discovery Splash:** atualizado`);
      }
      if (oldGuild.ownerId !== newGuild.ownerId) {
        changes.push(`• **Dono do Servidor:** <@${oldGuild.ownerId}> ➔ <@${newGuild.ownerId}>`);
      }
      if (oldGuild.premiumTier !== newGuild.premiumTier) {
        changes.push(`• **Nível de Boost:** \`${oldGuild.premiumTier}\` ➔ \`${newGuild.premiumTier}\``);
      }
      if (oldGuild.premiumProgressBarEnabled !== newGuild.premiumProgressBarEnabled) {
        changes.push(`• **Barra de Progresso de Boost:** \`${newGuild.premiumProgressBarEnabled ? "Ativada" : "Desativada"}\``);
      }
      if (oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId) {
        changes.push(`• **Canal de Updates Públicos:** alterado`);
      }
      if (oldGuild.rulesChannelId !== newGuild.rulesChannelId) {
        changes.push(`• **Canal de Regras:** alterado`);
      }
      if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
        changes.push(`• **Canal do Sistema:** alterado`);
      }
      if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
        changes.push(`• **Canal AFK:** alterado`);
      }
      if (oldGuild.afkTimeout !== newGuild.afkTimeout) {
        changes.push(`• **Timeout AFK:** \`${oldGuild.afkTimeout}s\` ➔ \`${newGuild.afkTimeout}s\``);
      }
      if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
        changes.push(`• **Vanity URL:** \`${oldGuild.vanityURLCode || "nenhuma"}\` ➔ \`${newGuild.vanityURLCode || "nenhuma"}\``);
      }
      if (oldGuild.verified !== newGuild.verified) {
        changes.push(`• **Verificado:** \`${newGuild.verified ? "Sim" : "Não"}\``);
      }
      if (oldGuild.partnered !== newGuild.partnered) {
        changes.push(`• **Parceiro Discord:** \`${newGuild.partnered ? "Sim" : "Não"}\``);
      }
      if (oldGuild.widgetEnabled !== newGuild.widgetEnabled) {
        changes.push(`• **Widget:** \`${newGuild.widgetEnabled ? "Ativado" : "Desativado"}\``);
      }
      if (oldGuild.preferredLocale !== newGuild.preferredLocale) {
        changes.push(`• **Idioma Preferido:** \`${oldGuild.preferredLocale}\` ➔ \`${newGuild.preferredLocale}\``);
      }
      if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
        changes.push(`• **Filtro de Conteúdo Explícito:** \`${oldGuild.explicitContentFilter}\` ➔ \`${newGuild.explicitContentFilter}\``);
      }
      if (oldGuild.mfaLevel !== newGuild.mfaLevel) {
        changes.push(`• **Nível MFA (2FA para staff):** \`${oldGuild.mfaLevel}\` ➔ \`${newGuild.mfaLevel}\``);
      }

      const oldFeatures = [...oldGuild.features].sort().join(",");
      const newFeatures = [...newGuild.features].sort().join(",");
      if (oldFeatures !== newFeatures) {
        changes.push(`• **Recursos do Servidor:** alterados`);
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

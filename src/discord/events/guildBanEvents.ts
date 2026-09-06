import { createEvent } from "#base";
import { createContainer, createSection, Separator } from "@magicyan/discord";
import { AuditLogEvent, GuildBan } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

// 1. Membro Banido
createEvent({
  name: "guildBanAdd",
  event: "guildBanAdd",
  async run(ban: GuildBan) {
    try {
      const executor = await getAuditLogExecutor(
        ban.guild,
        AuditLogEvent.MemberBanAdd,
        ban.user.id,
      );

      const timestamp = Math.floor(Date.now() / 1000);
      const user = ban.user;
      const avatar =
        user.displayAvatarURL() ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      const reason = ban.reason || "*Nenhum motivo informado*";

      const container = createContainer(
        "#ef4444",
        createSection({
          content: `## ${getEmojiTag("action_x")} Membro Banido\nO usuário <@${user.id}> foi banido do servidor.`,
          thumbnail: avatar as any,
        }),
        Separator.Default,
        [
          `| ${getEmojiTag("user")} **Usuário:** <@${user.id}> (\`${user.tag}\` | \`${user.id}\`)`,
          `| ${getEmojiTag("user_check")} **Staff Responsável:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Discord AutoMod ou Desconhecido*"}`,
          `| ${getEmojiTag("action_info")} **Motivo:** \`${reason}\``,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
      );

      await sendBotLog(ban.guild, container);
    } catch (err) {
      console.error("[guildBanAdd] Erro ao registrar log:", err);
    }
  },
});

// 2. Membro Desbanido
createEvent({
  name: "guildBanRemove",
  event: "guildBanRemove",
  async run(ban: GuildBan) {
    try {
      const executor = await getAuditLogExecutor(
        ban.guild,
        AuditLogEvent.MemberBanRemove,
        ban.user.id,
      );

      const timestamp = Math.floor(Date.now() / 1000);
      const user = ban.user;
      const avatar =
        user.displayAvatarURL() ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      const container = createContainer(
        "#22c55e",
        createSection({
          content: `## ${getEmojiTag("action_check")} Membro Desbanido\nO banimento de <@${user.id}> foi revogado.`,
          thumbnail: avatar as any,
        }),
        Separator.Default,
        [
          `| ${getEmojiTag("user")} **Usuário:** <@${user.id}> (\`${user.tag}\` | \`${user.id}\`)`,
          `| ${getEmojiTag("user_check")} **Staff Responsável:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
      );

      await sendBotLog(ban.guild, container);
    } catch (err) {
      console.error("[guildBanRemove] Erro ao registrar log:", err);
    }
  },
});

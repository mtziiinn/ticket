import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, GuildBan } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

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

      const reason = ban.reason || "*sem motivo*";

      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("action_x")} Membro Banido`,
        [
          `| <@${ban.user.id}>`,
          executor ? `| Staff: <@${executor.id}>` : "",
          `| Motivo: ${reason}`,
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(ban.guild, container);
    } catch (err) {
      console.error("[guildBanAdd] Erro ao registrar log:", err);
    }
  },
});

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

      const container = createContainer(
        "#38bdf8",
        `## ${getEmojiTag("action_check")} Membro Desbanido`,
        [
          `| <@${ban.user.id}>`,
          executor ? `| Staff: <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(ban.guild, container);
    } catch (err) {
      console.error("[guildBanRemove] Erro ao registrar log:", err);
    }
  },
});

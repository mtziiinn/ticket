import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, Guild, Invite } from "discord.js";
import { getEmojiTag, sendBotLog } from "#functions";

// getAuditLogExecutor filtra pelo targetId da entrada, mas o Discord não
// preenche o target_id das entradas de InviteDelete com o código do
// convite (o alvo vem em "changes", não em target_id) — o filtro por
// targetId nunca bateria. Busca à parte, comparando pelo código do target
// já resolvido pelo discord.js.
async function getInviteDeleteExecutor(guild: Guild, code: string) {
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.InviteDelete, limit: 5 }).catch(() => null);
    if (!logs) return null;
    const now = Date.now();
    const entry = logs.entries.find((e) => {
      const isCodeMatch = (e.target as any)?.code === code;
      const isRecent = now - e.createdTimestamp < 10_000;
      return isCodeMatch && isRecent;
    });
    return entry?.executor || null;
  } catch {
    return null;
  }
}

createEvent({
  name: "inviteCreate",
  event: "inviteCreate",
  async run(invite: Invite) {
    if (!invite.channel || !("guild" in invite.channel)) return;
    const guild = invite.channel.guild;

    try {
      const inviter = invite.inviter;
      const container = createContainer(
        constants.colors.primary,
        `## ${getEmojiTag("mail_add")} Convite Criado`,
        [
          `| ${getEmojiTag("folder")} <#${invite.channelId}>`,
          `| \`${invite.code}\``,
          inviter ? `| ${getEmojiTag("user_check")} <@${inviter.id}>` : "",
          `| ${getEmojiTag("clock")} Expira: ${invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : "nunca"}`,
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[inviteCreate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "inviteDelete",
  event: "inviteDelete",
  async run(invite: Invite) {
    if (!invite.channel || !("guild" in invite.channel)) return;
    const guild = invite.channel.guild;

    try {
      const executor = await getInviteDeleteExecutor(guild, invite.code);
      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("mail_remove")} Convite Excluído`,
        [
          `| \`${invite.code}\``,
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[inviteDelete] Erro ao registrar log:", err);
    }
  },
});

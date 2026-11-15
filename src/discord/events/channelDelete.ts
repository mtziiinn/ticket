import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import {
  AuditLogEvent,
  ChannelType,
  DMChannel,
  NonThreadGuildBasedChannel,
  PartialUser,
  User,
} from "discord.js";
import { db } from "#database";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

const channelTypeMap: Record<number, string> = {
  [ChannelType.GuildText]: "Texto",
  [ChannelType.GuildVoice]: "Voz",
  [ChannelType.GuildCategory]: "Categoria",
  [ChannelType.GuildAnnouncement]: "Anúncios",
  [ChannelType.GuildStageVoice]: "Palco",
  [ChannelType.GuildForum]: "Fórum",
};

/**
 * Ticket cujo canal foi apagado na mão (staff direto no Discord) não passa
 * pelo fluxo de encerramento — sem isso ele ficaria "aberto" no banco pra
 * sempre, contando no painel e em qualquer listagem.
 *
 * Uma única escrita atômica (findOneAndUpdate), com o índice de `channelId`,
 * e só quando o ticket ainda está aberto: o fechamento normal marca
 * `closed` antes de apagar o canal, então esse handler não mexe em quem já
 * foi encerrado pelo fluxo certo.
 */
async function closeTicketForDeletedChannel(
  channel: NonThreadGuildBasedChannel,
  executor: User | PartialUser | null,
): Promise<void> {
  try {
    const ticket = await db.tickets.findOneAndUpdate(
      { channelId: channel.id, closed: false },
      {
        $set: {
          closed: true,
          closedBy: executor?.id ?? "system",
          closedAt: new Date(),
        },
      },
      { new: true },
    );

    if (ticket) {
      console.log(
        `[Ticket] Canal #${channel.name} apagado manualmente — ticket ${ticket.ticketId} marcado como fechado.`,
      );
    }
  } catch (err) {
    console.error("[channelDelete] Erro ao marcar ticket como fechado:", err);
  }
}

createEvent({
  name: "channelDelete",
  event: "channelDelete",
  async run(channel: DMChannel | NonThreadGuildBasedChannel) {
    if (channel.isDMBased() || !channel.guild) return;

    // Usado tanto pra atribuir quem apagou quanto no log abaixo.
    const executor = await getAuditLogExecutor(
      channel.guild,
      AuditLogEvent.ChannelDelete,
      channel.id,
    );

    // Antes do log: o banco não pode depender do envio da mensagem.
    await closeTicketForDeletedChannel(channel, executor);

    try {
      const typeName = channelTypeMap[channel.type] || `Tipo ${channel.type}`;

      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("action_x")} Canal Excluído`,
        [
          `| ${getEmojiTag("folder")} \`${channel.name}\` (\`${typeName}\`)`,
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(channel.guild, container);
    } catch (err) {
      console.error("[channelDelete] Erro ao registrar log:", err);
    }
  },
});

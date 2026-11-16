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
import { refreshCategoryQueue } from "../responders/ticket/queue.js";

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
  // Só canal de texto pode ser ticket. Categoria, voz, palco e fórum — que
  // são a maioria dos canais apagados — nem chegam ao banco.
  if (channel.type !== ChannelType.GuildText) return;

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
      // lean + projection: sem hidratar documento e trazendo só o que o log
      // usa (o resto do ticket não interessa aqui).
      { new: true, lean: true, projection: { ticketId: 1 } },
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

    // Se o canal apagado estava na fila de uma categoria, os que ficaram
    // precisam descer um número (o canal já saiu do cache, então ele mesmo
    // fica de fora da renumeração).
    refreshCategoryQueue(channel.guild, channel.parentId);

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

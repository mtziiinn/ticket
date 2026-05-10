import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  createContainer,
  createSection,
  modalFieldsToRecord,
  Separator,
  createRow,
} from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "#database";
import { generateTranscript } from "./manage.js";

// Função compartilhada para renomear
async function processRename(interaction: any) {
  const { channel, fields } = interaction;
  if (!channel?.isTextBased()) return;

  try {
    // Acknowledge rápido
    await (
      interaction.isFromMessage()
        ? interaction.deferUpdate()
        : interaction.deferReply({ ephemeral: true })
    ).catch(() => {});

    const data = modalFieldsToRecord(fields);
    const newName = data.new_name as string;

    if (!newName) {
      await interaction
        .editReply({ content: "Nome inválido." })
        .catch(() => {});
      return;
    }

    const toolEmoji = "🔨";
    const formattedName = `${toolEmoji}・${newName.replace(/\s+/g, "-").toLowerCase()}`;

    await (channel as any).setName(formattedName).catch((err: any) => {
      console.error("Erro ao renomear canal:", err);
    });

    await interaction
      .editReply({
        content: `<:action_check:1502789797821939752> Canal renomeado para: \`${formattedName}\``,
      })
      .catch(() => {});
  } catch (error) {
    console.error("[Renomear] Erro ao processar:", error);
  }
}

// Responder Original
createResponder({
  customId: "ticket/manage/rename_submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processRename(interaction);
  },
});

// Backup para Renomear
createResponder({
  customId: "Renomear Ticket",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processRename(interaction);
  },
});

// Função compartilhada para finalização (V5 - LOGS OBRIGATÓRIOS + FIX MODAL)
async function processCloseSubmission(interaction: any) {
  const { channel, user, fields, guild } = interaction;
  if (!channel?.isTextBased()) return;

  console.log(`[Ticket] >>> FINALIZANDO CANAL: ${channel.name}`);

  // 1. Acknowledge IMEDIATO (Fecha o modal instantaneamente)
  try {
    if (interaction.isFromMessage()) {
      await interaction.deferUpdate().catch(() => {});
    } else {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
    console.log("[Ticket] 1. Discord Acknowledged (Modal Closed)");

    // Mensagem de feedback no canal
    await channel
      .send({
        content: `<:action_info:1502789798983766016> O atendimento foi finalizado por ${user}. Gerando transcript e deletando o canal em instantes...`,
      })
      .catch(() => {});
  } catch (e) {
    console.error("[Ticket] Erro no Acknowledge:", e);
  }
  try {
    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) return;

    const data = modalFieldsToRecord(fields);
    const transcriptChoiceRaw = data.transcript_choice;
    const wantTranscriptUser =
      (Array.isArray(transcriptChoiceRaw)
        ? transcriptChoiceRaw[0]
        : transcriptChoiceRaw) === "yes";
    const considerations =
      (data.considerations as string) || "Atendimento concluído.";

    // 2. Atualizar Banco
    ticket.closed = true;
    ticket.closedBy = user.id;
    ticket.closedAt = new Date();
    await (ticket as any).save();
    console.log("[Ticket] 2. Banco Atualizado");

    // 3. Transcript OBRIGATÓRIO (Independente da escolha do Staff)
    console.log("[Ticket] 3. Gerando Transcript (Obrigatório para Staff)...");
    const transcriptUrl = await generateTranscript(
      channel as any,
      ticket,
      user,
    ).catch((err) => {
      console.error("[Ticket] Erro ao gerar transcript:", err);
      return "";
    });

    // 4. LOG PARA STAFF (Sempre envia com o link se gerado)
    const guildData = await db.guilds.get(guild.id);
    const logChannelId = guildData.channels?.tickets;

    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel?.isTextBased()) {
        const owner = await guild.members
          .fetch(ticket.ownerId)
          .catch(() => null);

        const claimer = ticket.claimedBy
          ? await guild.members.fetch(ticket.claimedBy).catch(() => null)
          : null;
        const openedAtTimestamp = Math.floor(ticket.openedAt.getTime() / 1000);
        const closedAtTimestamp = Math.floor(new Date().getTime() / 1000);

        const logContainer = createContainer(
          "#3b82f6",
          createSection({
            content: `## <:folder:1502789880214720533> Atendimento ${ticket.ticketId}\nVenho registrar a log de encerramento do atendimento \`${ticket.ticketId}\`, encerrado por ${user}. Abaixo você pode ver todas as informações seguido do transcript.`,
            thumbnail: owner?.displayAvatarURL() as any,
          }),
          Separator.Default,
          `**Identificação**\n` +
            [
              `<:user:1502789979229913268> **Aberto por:** ${owner || "Desconhecido"} (\`${ticket.ownerId}\`)`,
              `<:shield_check:1502789932727668788> **Encerrado por:** ${user} (\`${user.id}\`)`,
              `<:user_check:1502789974276178121> **Assumido por:** ${claimer || "Ninguém"} (\`${ticket.claimedBy || "0"}\`)`,
            ].join("\n"),
          Separator.Default,
          `**Cronologia**\n` +
            [
              `<:clock:1502789859960422502> **Aberto em:** <t:${openedAtTimestamp}:f> (<t:${openedAtTimestamp}:R>)`,
              `<:clock:1502789859960422502> **Encerrado em:** <t:${closedAtTimestamp}:f> (<t:${closedAtTimestamp}:R>)`,
            ].join("\n"),
          Separator.Default,
          `**Detalhes do Ticket**\n` +
            [
              `<:folder_open:1502789875928400103> **Categoria:** \`${ticket.category}\``,
              `<:action_info:1502789798983766016> **Motivo:** \`${ticket.description || "Não informado."}\``,
            ].join("\n"),
          Separator.Default,
          `**<:action_check:1502789797821939752> Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``,
          transcriptUrl
            ? createRow(
                new ButtonBuilder({
                  label: "Acessar Transcript",
                  style: ButtonStyle.Link,
                  emoji: "1502789882916110407",
                  url: transcriptUrl,
                }),
              )
            : [],
        );

        await (logChannel as any)
          .send({ components: [logContainer], flags: ["IsComponentsV2"] })
          .catch(() => {});
        console.log("[Ticket] 4. Log enviado para Staff");
      }
    }

    // 5. ENVIAR DM PARA O USUÁRIO (Apenas se ele quiser o link)
    const ownerMember = await guild.members
      .fetch(ticket.ownerId)
      .catch(() => null);
    if (ownerMember) {
      const openTime = Math.floor(new Date(ticket.openedAt).getTime() / 1000);
      const closeTime = Math.floor(Date.now() / 1000);

      const dmContainer = createContainer(
        constants.colors.danger,
        createSection({
          content: `### Atendimento Encerrado\nOlá ${ownerMember}, seu atendimento na categoria \`${ticket.category.toUpperCase()}\` foi encerrado por ${user}. Abaixo você pode ver as considerações finais do seu atendimento.`,
          thumbnail: user.displayAvatarURL() as any,
        }),
        Separator.Default,
        `<:calendar:1502789854486986752> **Aberto em:** <t:${openTime}:f>`,
        `<:calendar_check:1502789850649071740> **Encerrado em:** <t:${closeTime}:f>`,
        Separator.Default,
        `<:action_check:1502789797821939752> **Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``,
        wantTranscriptUser && transcriptUrl
          ? createRow(
              new ButtonBuilder({
                label: "Acessar Transcript",
                style: ButtonStyle.Link,
                emoji: "1502789882916110407",
                url: transcriptUrl,
              }),
            )
          : [],
      );

      await ownerMember
        .send({
          components: [dmContainer],
          flags: ["IsComponentsV2"],
        })
        .catch(() => {});
      console.log("[Ticket] 5. DM de encerramento enviada");
    }

    // 6. Deletar canal
    console.log("[Ticket] 6. Deletando canal em 3 segundos...");
    setTimeout(() => {
      channel.delete().catch(() => {});
    }, 3000);
  } catch (err) {
    console.error("[Ticket] Erro no encerramento:", err);
  }
}

// Responder Principal do Submit
createResponder({
  customId: "ticket/manage/close_submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processCloseSubmission(interaction);
  },
});

// Backup para o ID de título
createResponder({
  customId: "Finalizar Atendimento",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    console.log(">>> [Ticket] Finalização capturada pelo backup!");
    await processCloseSubmission(interaction);
  },
});

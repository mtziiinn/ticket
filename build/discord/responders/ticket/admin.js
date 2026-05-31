import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createSection, modalFieldsToRecord, Separator, createRow, } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "#database";
import { env } from "#env";
import { generateTranscript } from "./manage.js";
// Função compartilhada para renomear
async function processRename(interaction) {
    const { channel, fields } = interaction;
    if (!channel?.isTextBased())
        return;
    try {
        // Acknowledge rápido
        await (interaction.isFromMessage()
            ? interaction.deferUpdate()
            : interaction.deferReply({ ephemeral: true })).catch((err) => console.error("[Admin]", err));
        const data = modalFieldsToRecord(fields);
        const newName = data.new_name;
        if (!newName) {
            await interaction
                .followUp({ content: "Nome inválido.", flags: ["Ephemeral"] })
                .catch((err) => console.error("[Admin]", err));
            return;
        }
        // Buscar o emoji atual do nome do canal
        const currentEmoji = channel.name.split("・")[0] || "🎫";
        const formattedName = `${currentEmoji}・${newName.replace(/\s+/g, "-").toLowerCase()}`;
        await channel.setName(formattedName).catch((err) => {
            console.error("Erro ao renomear canal:", err);
        });
        await interaction
            .followUp({
            content: `<:action_check:1502789797821939752> Canal renomeado para: \`${formattedName}\``,
            flags: ["Ephemeral"],
        })
            .catch((err) => console.error("[Admin]", err));
    }
    catch (error) {
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
// Função compartilhada para entrega de mídia (etapa 1: criar pending delivery)
async function processDeliverMedia(interaction) {
    const { channel, user, fields } = interaction;
    if (!channel?.isTextBased())
        return;
    try {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch((err) => console.error("[Admin]", err));
        const data = modalFieldsToRecord(fields);
        const description = data.deliver_description || "Mídia entregue";
        const ticket = await db.tickets.getByChannel(channel.id);
        if (!ticket) {
            await interaction.followUp({ content: "Ticket não encontrado.", flags: ["Ephemeral"] }).catch(() => null);
            return;
        }
        // Gerar token único
        const token = Math.random().toString(36).substring(2, 10).toUpperCase();
        await db.pendingDeliveries.create({
            token,
            channelId: channel.id,
            staffId: user.id,
            description,
            ticketId: ticket.ticketId,
            status: "pending",
        });
        const uploadUrl = `${env.WEB_URL}/upload/${token}`;
        await interaction.followUp({
            content: `<:action_check:1502789797821939752> Link de upload gerado!\n<:file_add:1502789905112105071> Acesse para enviar o arquivo: ${uploadUrl}\n\nApós o upload, a entrega será finalizada automaticamente.`,
            flags: ["Ephemeral"],
        });
    }
    catch (error) {
        console.error("[Entregar Mídia] Erro ao processar:", error);
        await interaction.followUp({ content: "Erro ao processar.", flags: ["Ephemeral"] }).catch(() => null);
    }
}
// Responder Principal do Deliver
createResponder({
    customId: "ticket/manage/deliver_submit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await processDeliverMedia(interaction);
    },
});
// Backup para o ID de título
createResponder({
    customId: "Entregar Mídia",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await processDeliverMedia(interaction);
    },
});
// Função compartilhada para finalização (V5 - LOGS OBRIGATÓRIOS + FIX MODAL)
async function processCloseSubmission(interaction) {
    const { channel, user, fields, guild } = interaction;
    if (!channel?.isTextBased())
        return;
    // 1. Acknowledge IMEDIATO (Fecha o modal instantaneamente)
    try {
        if (interaction.isFromMessage()) {
            await interaction.deferUpdate().catch((err) => console.error("[Admin]", err));
        }
        else {
            await interaction.deferReply({ ephemeral: true }).catch((err) => console.error("[Admin]", err));
        }
        // Mensagem de feedback no canal
        await channel
            .send({
            content: `<:action_info:1502789798983766016> O atendimento foi finalizado por ${user}. Gerando transcript e deletando o canal em instantes...`,
        })
            .catch((err) => console.error("[Admin]", err));
    }
    catch (e) {
        console.error("[Ticket] Erro no Acknowledge:", e);
    }
    try {
        const ticket = await db.tickets.getByChannel(channel.id);
        if (!ticket)
            return;
        const data = modalFieldsToRecord(fields);
        const transcriptChoiceRaw = data.transcript_choice;
        const wantTranscriptUser = (Array.isArray(transcriptChoiceRaw)
            ? transcriptChoiceRaw[0]
            : transcriptChoiceRaw) === "yes";
        const considerations = data.considerations || "Atendimento concluído.";
        // 2. Atualizar Banco
        ticket.closed = true;
        ticket.closedBy = user.id;
        ticket.closedAt = new Date();
        await ticket.save();
        // 3. Transcript OBRIGATÓRIO (Independente da escolha do Staff)
        const transcriptUrl = await generateTranscript(channel, ticket, user).catch((err) => {
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
                const logContainer = createContainer(constants.colors.primary, createSection({
                    content: `## <:folder:1502789880214720533> Atendimento ${ticket.ticketId}\nVenho registrar a log de encerramento do atendimento \`${ticket.ticketId}\`, encerrado por ${user}. Abaixo você pode ver todas as informações seguido do transcript.`,
                    thumbnail: owner?.displayAvatarURL(),
                }), Separator.Default, `**Identificação**\n` +
                    [
                        `<:user:1502789979229913268> **Aberto por:** ${owner || "Desconhecido"} (\`${ticket.ownerId}\`)`,
                        `<:shield_check:1502789932727668788> **Encerrado por:** ${user} (\`${user.id}\`)`,
                        `<:user_check:1502789974276178121> **Assumido por:** ${claimer || "Ninguém"} (\`${ticket.claimedBy || "0"}\`)`,
                    ].join("\n"), Separator.Default, `**Cronologia**\n` +
                    [
                        `<:clock:1502789859960422502> **Aberto em:** <t:${openedAtTimestamp}:f> (<t:${openedAtTimestamp}:R>)`,
                        `<:clock:1502789859960422502> **Encerrado em:** <t:${closedAtTimestamp}:f> (<t:${closedAtTimestamp}:R>)`,
                    ].join("\n"), Separator.Default, `**Detalhes do Ticket**\n` +
                    [
                        `<:folder_open:1502789875928400103> **Categoria:** \`${ticket.category}\``,
                        `<:action_info:1502789798983766016> **Motivo:** \`${ticket.description || "Não informado."}\``,
                    ].join("\n"), Separator.Default, `**<:action_check:1502789797821939752> Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``, transcriptUrl
                    ? createRow(new ButtonBuilder({
                        label: "Acessar Transcript",
                        style: ButtonStyle.Link,
                        emoji: "1502789882916110407",
                        url: transcriptUrl,
                    }))
                    : []);
                await logChannel
                    .send({ components: [logContainer], flags: ["IsComponentsV2"] })
                    .catch((err) => console.error("[Admin]", err));
            }
        }
        // 5. ENVIAR DM PARA O USUÁRIO (Apenas se ele quiser o link)
        const ownerMember = await guild.members
            .fetch(ticket.ownerId)
            .catch(() => null);
        if (ownerMember) {
            const openTime = Math.floor(new Date(ticket.openedAt).getTime() / 1000);
            const closeTime = Math.floor(Date.now() / 1000);
            const dmContainer = createContainer(constants.colors.danger, createSection({
                content: `### Atendimento Encerrado\nOlá ${ownerMember}, seu atendimento na categoria \`${ticket.category.toUpperCase()}\` foi encerrado por ${user}. Abaixo você pode ver as considerações finais do seu atendimento.`,
                thumbnail: user.displayAvatarURL(),
            }), Separator.Default, `<:calendar:1502789854486986752> **Aberto em:** <t:${openTime}:f>`, `<:calendar_check:1502789850649071740> **Encerrado em:** <t:${closeTime}:f>`, Separator.Default, `<:action_check:1502789797821939752> **Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``, wantTranscriptUser && transcriptUrl
                ? createRow(new ButtonBuilder({
                    label: "Acessar Transcript",
                    style: ButtonStyle.Link,
                    emoji: "1502789882916110407",
                    url: transcriptUrl,
                }))
                : []);
            await ownerMember
                .send({
                components: [dmContainer],
                flags: ["IsComponentsV2"],
            })
                .catch((err) => console.error("[Admin]", err));
        }
        // 6. Deletar canal
        setTimeout(() => {
            channel.delete().catch((err) => console.error("[Admin]", err));
        }, 3000);
    }
    catch (err) {
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
        await processCloseSubmission(interaction);
    },
});

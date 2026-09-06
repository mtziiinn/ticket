import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createSection, modalFieldsToRecord, Separator, createRow, createMediaGallery, } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "#database";
import { env } from "#env";
import { generateTranscript } from "./manage.js";
import { sendActionLog } from "./logger.js";
import { createMercadoPagoCharge, generatePixPayload, getCleanAvatarURL, safeSendDM, } from "#functions";
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
        const ticket = await db.tickets.getByChannel(channel.id);
        if (ticket) {
            await sendActionLog(interaction.guild, ticket, interaction.user, "Renomear Ticket", `Alterou o nome do canal do ticket para \`${formattedName}\`.`);
        }
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
        // Enviar Log de Ação
        await sendActionLog(interaction.guild, ticket, user, "Entregar Mídia (Link)", `Gerou um link de entrega pendente para o arquivo com a descrição: "${description}".`);
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
// Função compartilhada para cobrança (Mercado Pago PIX & Cartão)
async function processChargeSubmission(interaction) {
    const { channel, user, fields, guild } = interaction;
    if (!channel?.isTextBased())
        return;
    try {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch((err) => console.error("[Admin]", err));
        const data = modalFieldsToRecord(fields);
        const amountRaw = String(data.charge_amount || "")
            .replace("R$", "")
            .replace(/\s/g, "")
            .replace(",", ".");
        const amount = parseFloat(amountRaw);
        const description = data.charge_description || "Serviço / Atendimento";
        const customerEmail = data.charge_email || undefined;
        if (isNaN(amount) || amount < 1) {
            await interaction.followUp({
                content: "<:action_x:1502789802918150206> Valor inválido! O valor mínimo para cobrança é de R$ 1,00.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const ticket = await db.tickets.getByChannel(channel.id);
        if (!ticket) {
            await interaction.followUp({ content: "Ticket não encontrado.", flags: ["Ephemeral"] });
            return;
        }
        const formattedAmount = amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        // 1. Gerar via Mercado Pago (PIX dinâmico + Cartão de Crédito)
        const mpResult = await createMercadoPagoCharge({
            amount,
            description,
            ticketId: String(ticket.ticketId || "TICKET"),
            channelId: channel.id,
            customerEmail,
        });
        if (mpResult.success && mpResult.pix) {
            ticket.payment = {
                id: String(mpResult.pix.paymentId),
                amount,
                status: "pending",
                description,
                preferenceId: mpResult.cardCheckout?.preferenceId,
                initPoint: mpResult.cardCheckout?.initPoint,
                qrCode: mpResult.pix.qrCode,
                qrCodeBase64: mpResult.pix.qrCodeBase64,
                ticketUrl: mpResult.pix.ticketUrl,
            };
            await ticket.save();
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(mpResult.pix.qrCode)}`;
            const actionButtons = [];
            if (mpResult.cardCheckout?.initPoint) {
                actionButtons.push(new ButtonBuilder({
                    label: "Pagar com Cartão de Crédito",
                    style: ButtonStyle.Link,
                    url: mpResult.cardCheckout.initPoint,
                    emoji: "1502789952365396040",
                }));
            }
            if (mpResult.pix.ticketUrl) {
                actionButtons.push(new ButtonBuilder({
                    label: "Comprovante Mercado Pago",
                    style: ButtonStyle.Link,
                    url: mpResult.pix.ticketUrl,
                    emoji: "1502789953334280345",
                }));
            }
            const chargeContainer = createContainer(constants.colors.success, createSection({
                content: `## <:other_dollar:1502789953334280345> Cobrança Gerada\nOlá, as informações para o pagamento da sua encomenda já estão disponíveis abaixo. Escolha sua forma preferida de pagamento.`,
                thumbnail: emojis.static.other_dollar,
            }), Separator.Default, `**Informações do Pedido**\n` +
                `> <:action_info:1502789798983766016> **Descrição:** \`${description}\`\n` +
                `> <:other_wallet:1502789960355283055> **Valor Total:** \`${formattedAmount}\`\n` +
                `> <:clock_check:1502789856881938502> **Status:** \`Aguardando Pagamento\``, Separator.Default, `### <:device_mobile:1502789873034199060> Pagar via PIX (Aprovação Imediata)\nEscaneie o QR Code abaixo com o app do seu banco ou utilize o código Copia e Cola:`, createMediaGallery(qrImageUrl), `\`\`\`\n${mpResult.pix.qrCode}\n\`\`\``, Separator.Default, actionButtons.length > 0
                ? [
                    `### <:other_card:1502789952365396040> Pagar com Cartão de Crédito\nClique no botão abaixo para pagar com cartão em até 12x no checkout seguro do Mercado Pago:`,
                    createRow(...actionButtons),
                    Separator.Default,
                ]
                : [], `<:action_check:1502789797821939752> **Baixa Automática:** O status do seu atendimento será atualizado para **EM PRODUÇÃO** automaticamente assim que o pagamento for confirmado!`);
            const chargeMsg = await channel.send({
                components: [chargeContainer],
                flags: ["IsComponentsV2"],
            });
            if (chargeMsg) {
                await chargeMsg.pin().catch(() => null);
            }
            await interaction.followUp({
                content: `<:action_check:1502789797821939752> Cobrança oficial de **${formattedAmount}** enviada no canal com sucesso!`,
                flags: ["Ephemeral"],
            });
            await sendActionLog(guild, ticket, user, "Gerar Cobrança", `Gerou cobrança no valor de **${formattedAmount}** via Mercado Pago (PIX e Cartão).`);
        }
        else {
            // Fallback para PIX Estático se MP_ACCESS_TOKEN não estiver configurado
            const guildData = await db.guilds.get(guild.id);
            const pixKey = guildData.channels?.pixKey;
            if (!pixKey) {
                await interaction.followUp({
                    content: `<:action_x:1502789802918150206> Falha ao gerar cobrança pelo Mercado Pago: \`${mpResult.error}\`\nE nenhuma chave PIX estática está configurada no \`/painel\`.`,
                    flags: ["Ephemeral"],
                });
                return;
            }
            const pixPayload = generatePixPayload(pixKey);
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(pixPayload)}`;
            const fallbackContainer = createContainer(constants.colors.success, createSection({
                content: `## <:other_dollar:1502789953334280345> Informações de Pagamento (PIX Manual)\nOlá, utilize a chave Copia e Cola ou escaneie o QR Code abaixo para efetuar o pagamento.`,
                thumbnail: emojis.static.other_dollar,
            }), Separator.Default, `**Informações do Pedido**\n` +
                `> <:action_info:1502789798983766016> **Descrição:** \`${description}\`\n` +
                `> <:other_wallet:1502789960355283055> **Valor Combinado:** \`${formattedAmount}\``, Separator.Default, createMediaGallery(qrCodeUrl), `**Código PIX Copia e Cola:**\n\`\`\`\n${pixPayload}\n\`\`\``, Separator.Default, `<:action_warning:1502789801949265990> **Aviso:** Após realizar o pagamento, envie o comprovante aqui no canal para que a equipe confirme o recebimento. *(Para baixa automática, configure o \`MP_ACCESS_TOKEN\` no .env)*`);
            await channel.send({
                components: [fallbackContainer],
                flags: ["IsComponentsV2"],
            });
            await interaction.followUp({
                content: `<:action_check:1502789797821939752> Informações de pagamento enviadas no canal (Modo PIX Manual - configure \`MP_ACCESS_TOKEN\` no .env para baixa automática).`,
                flags: ["Ephemeral"],
            });
        }
    }
    catch (err) {
        console.error("[Charge Submit] Erro:", err);
        await interaction.followUp({
            content: `Erro ao processar cobrança: ${err.message}`,
            flags: ["Ephemeral"],
        }).catch(() => null);
    }
}
// Responder Principal de Cobrança
createResponder({
    customId: "ticket/manage/charge_submit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await processChargeSubmission(interaction);
    },
});
// Backup para o ID de título
createResponder({
    customId: "Gerar Cobrança",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await processChargeSubmission(interaction);
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
        const wantTranscript = (Array.isArray(transcriptChoiceRaw)
            ? transcriptChoiceRaw[0]
            : transcriptChoiceRaw) !== "no";
        const considerations = data.considerations || "Atendimento concluído.";
        // 2. Atualizar Banco
        ticket.closed = true;
        ticket.closedBy = user.id;
        ticket.closedAt = new Date();
        await ticket.save();
        // 3. Transcript (Gerado apenas se o staff permitiu salvar)
        let transcriptUrl = "";
        if (wantTranscript) {
            transcriptUrl = await generateTranscript(channel, ticket, user).catch((err) => {
                console.error("[Ticket] Erro ao gerar transcript:", err);
                return "";
            });
        }
        // 4. LOG PARA STAFF
        const guildData = await db.guilds.get(guild.id);
        const logChannelId = guildData.channels?.tickets;
        if (logChannelId) {
            const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
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
                    thumbnail: getCleanAvatarURL(owner?.user || user),
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
                    ].join("\n"), Separator.Default, `**<:action_check:1502789797821939752> Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``, wantTranscript && transcriptUrl
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
        // 5. ENVIAR DM PARA O USUÁRIO
        const targetUser = (await interaction.client.users.fetch(ticket.ownerId).catch(() => null)) ||
            (await guild.members.fetch(ticket.ownerId).catch(() => null))?.user;
        if (targetUser) {
            const openTime = Math.floor(new Date(ticket.openedAt).getTime() / 1000);
            const closeTime = Math.floor(Date.now() / 1000);
            const dmContainer = createContainer(constants.colors.danger, createSection({
                content: `### Atendimento Encerrado\nOlá ${targetUser}, seu atendimento na categoria \`${ticket.category.toUpperCase()}\` foi encerrado por ${user}. Abaixo você pode ver as considerações finais do seu atendimento.`,
                thumbnail: getCleanAvatarURL(user),
            }), Separator.Default, `<:calendar:1502789854486986752> **Aberto em:** <t:${openTime}:f>`, `<:calendar_check:1502789850649071740> **Encerrado em:** <t:${closeTime}:f>`, Separator.Default, `<:action_check:1502789797821939752> **Considerações Finais:**\n\`\`\`\n${considerations}\n\`\`\``, wantTranscript && transcriptUrl
                ? createRow(new ButtonBuilder({
                    label: "Acessar Transcript",
                    style: ButtonStyle.Link,
                    emoji: "1502789882916110407",
                    url: transcriptUrl,
                }))
                : []);
            await safeSendDM(targetUser, {
                components: [dmContainer],
                flags: ["IsComponentsV2"],
            }, "Ticket Close");
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

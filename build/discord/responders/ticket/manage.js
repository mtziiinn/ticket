import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createSection, createEmbed, Separator, createRow, } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, ModalBuilder, LabelBuilder, PermissionFlagsBits, RadioGroupBuilder, StringSelectMenuBuilder, MessageType, } from "discord.js";
import { db } from "#database";
import { env } from "#env";
import { formatEmoji, generatePixPayload } from "#functions";
import { sendActionLog } from "./logger.js";
import { renderMembersPanel } from "./members.js";
// Mapeamento de Status de Encomenda
const statusMap = {
    open: {
        emoji: "🔴",
        label: "Alinhando Detalhes",
        description: "Estamos conversando sobre sua encomenda e alinhando todos os pontos do projeto.",
    },
    payment: {
        emoji: "🟡",
        label: "Pagamento Iniciado",
        description: "A primeira parte do pagamento foi realizada e o prazo de entrega já está contando.",
    },
    production: {
        emoji: "🟠",
        label: "Em produção",
        description: "Sua encomenda começou a ser feita e o processo será compartilhado para aprovação.",
    },
    completed: {
        emoji: "🟢",
        label: "Concluída",
        description: "Encomenda finalizada e entregue.",
    },
    queue: {
        emoji: "🟣",
        label: "Fila",
        description: "Atualmente se encontra em fila de espera.",
    },
};
// Função para gerar o painel principal (Assumir ou Painel Admin)
function createMainPanel(ticket, owner) {
    const isClaimed = !!ticket.claimedBy;
    const currentStatus = statusMap[ticket.status || "open"] || statusMap.open;
    return createContainer(constants.colors.azoxo, createSection({
        content: `## <:other_ticket:1502789959378145300> Ticket ${ticket.ticketId}\n${owner || "Usuário"} Seja bem-vindo(a) ao seu ticket! Através deste canal, a equipe irá realizar seu atendimento e esclarecer suas dúvidas.` +
            (isClaimed
                ? `\n\n> <:user_check:1502789974276178121> **Assumido por:** <@${ticket.claimedBy}>`
                : ""),
        thumbnail: (owner?.displayAvatarURL?.() ||
            "https://cdn.discordapp.com/embed/avatars/0.png"),
    }), Separator.Default, `### ${currentStatus.emoji} Status do Pedido: \`${currentStatus.label.toUpperCase()}\` \n> ${currentStatus.description}`, Separator.Default, `<:folder_open:1502789875928400103> **Categoria do atendimento:**\n\`\`\`\n${ticket.category.toUpperCase()}\n\`\`\``, `<:action_info:1502789798983766016> **Motivo do contato:**\n\`\`\`\n${ticket.description}\n\`\`\``, Separator.Default, isClaimed
        ? createRow(new ButtonBuilder({
            customId: "ticket/manage/admin",
            label: "Painel Admin",
            style: ButtonStyle.Secondary,
            emoji: "1502789931808981012",
        }), new ButtonBuilder({
            customId: "ticket/manage/close_modal", // Abre o modal diretamente
            label: "Finalizar Ticket",
            style: ButtonStyle.Secondary,
            emoji: "1502789802918150206",
        }))
        : createRow(new ButtonBuilder({
            customId: "ticket/manage/claim",
            label: "Assumir Ticket",
            style: ButtonStyle.Secondary,
            emoji: "1502789940612698192",
        }), new ButtonBuilder({
            customId: "ticket/manage/admin",
            label: "Painel Admin",
            style: ButtonStyle.Secondary,
            emoji: "1502789931808981012",
        })), !isClaimed
        ? createRow(new ButtonBuilder({
            customId: "ticket/manage/close_modal", // Abre o modal diretamente
            label: "Finalizar Ticket",
            style: ButtonStyle.Secondary,
            emoji: "1502789802918150206",
        }))
        : []);
}
createResponder({
    customId: "ticket/manage/:action",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction, { action }) {
        const { channel, user, guild } = interaction;
        if (!channel?.isTextBased())
            return;
        const ticket = await db.tickets.getByChannel(channel.id);
        if (!ticket) {
            await interaction.reply({
                content: "Este canal não é um ticket válido ou não está no banco de dados.",
                flags: ["Ephemeral"],
            });
            return;
        }
        switch (action) {
            case "claim": {
                if (ticket.claimedBy) {
                    await interaction.reply({
                        content: `Este ticket já foi assumido por <@${ticket.claimedBy}>!`,
                        flags: ["Ephemeral"],
                    });
                    return;
                }
                ticket.claimedBy = user.id;
                await ticket.save();
                const owner = await guild.members
                    .fetch(ticket.ownerId)
                    .catch(() => null);
                const container = createMainPanel(ticket, owner);
                await interaction.update({
                    components: [container],
                });
                // Enviar Log de Ação
                await sendActionLog(guild, ticket, user, "Assumir Ticket", "O staff assumiu a responsabilidade pelo atendimento deste ticket.");
                // Notificação Automática por DM
                if (owner) {
                    const dmContainer = createContainer(constants.colors.azoxo, createSection({
                        content: `### Notificação de Atendimento\nOlá ${owner}, seu ticket na categoria \`${ticket.category.toUpperCase()}\` foi assumido por ${user}. Ele agora é o responsável pelo seu atendimento. Vá até o ticket para dar continuidade ao seu atendimento.`,
                        thumbnail: user.displayAvatarURL(),
                    }), createRow(new ButtonBuilder({
                        label: "Ir para o atendimento",
                        style: ButtonStyle.Link,
                        url: `https://discord.com/channels/${guild.id}/${channel.id}`,
                    })));
                    await owner
                        .send({
                        components: [dmContainer],
                        flags: ["IsComponentsV2"],
                    })
                        .catch((err) => console.error("[Manage]", err));
                }
                break;
            }
            case "admin": {
                const isTheClaimer = ticket.claimedBy === user.id;
                const container = createContainer(constants.colors.primary, createSection({
                    content: `## <:shield:1502789938532450304> Painel Administrativo ${ticket.ticketId}\nSeja muito bem-vindo(a) ao Painel Administrativo! Este é o seu ambiente de controle, onde você pode gerenciar o atendimento atual. Caso tenha alguma dúvida sobre o funcionamento, entre em contato com a equipe responsável.`,
                    thumbnail: user.displayAvatarURL(),
                }), Separator.Default, createSection({
                    content: `● **Gerenciar usuário**\nNesta opção você pode adicionar/remover usuários do atendimento.`,
                    button: new ButtonBuilder({
                        customId: "ticket/manage/members_modal",
                        label: "Gerenciar",
                        style: ButtonStyle.Secondary,
                        emoji: "1502789976327327801",
                    }),
                }), Separator.Default, createSection({
                    content: `● **Renomar**\nNesta opção você pode alterar o nome do atendimento para ter melhor controle.`,
                    button: new ButtonBuilder({
                        customId: "ticket/manage/rename_modal",
                        label: "Renomear",
                        style: ButtonStyle.Secondary,
                        emoji: "1502789881250709675",
                    }),
                }), Separator.Default, createSection({
                    content: `● **Notificar**\nNesta opção será enviada uma mensagem no privado do autor do atendimento.`,
                    button: new ButtonBuilder({
                        customId: "ticket/manage/notify",
                        label: "Notificar",
                        style: ButtonStyle.Secondary,
                        emoji: "1502789798983766016",
                    }),
                }), Separator.Default, createSection({
                    content: `● **Transferir Atendimento**\nNesta opção você pode alterar a categoria do atendimento.`,
                    button: new ButtonBuilder({
                        customId: "ticket/manage/transfer",
                        label: "Transferir",
                        style: ButtonStyle.Secondary,
                        emoji: "1502789875928400103",
                    }),
                }), Separator.Default, createSection({
                    content: `● **Status do Pedido**\nNesta opção você pode atualizar o progresso da encomenda atual.`,
                    button: new ButtonBuilder({
                        customId: "ticket/manage/status_menu",
                        label: "Mudar Status",
                        style: ButtonStyle.Secondary,
                        emoji: "1502789856881938502",
                    }),
                }), Separator.Default, createSection({
                    content: `● **Enviar Pagamento (PIX)**\nNesta opção o bot enviará as informações de pagamento para o cliente.`,
                    button: new ButtonBuilder({
                        customId: "ticket/manage/send_pix",
                        label: "Enviar PIX",
                        style: ButtonStyle.Secondary,
                        emoji: "1502789953334280345",
                    }),
                }), Separator.Default, createSection({
                    content: `● **Largar Atendimento**\nNesta opção você pode deixar de ser o responsável pelo atendimento.`,
                    button: isTheClaimer
                        ? new ButtonBuilder({
                            customId: "ticket/manage/unclaim",
                            label: "Largar",
                            style: ButtonStyle.Secondary,
                            emoji: "1502789878339862660",
                        })
                        : new ButtonBuilder({
                            customId: "disabled",
                            label: "Largar",
                            style: ButtonStyle.Secondary,
                            emoji: "1502789878339862660",
                            disabled: true,
                        }),
                }), Separator.Default, createSection({
                    content: `● **Entregar Mídia**\nNesta opção você pode enviar o arquivo final com qualidade original para o cliente.`,
                    button: new ButtonBuilder({
                        customId: "ticket/manage/deliver_modal",
                        label: "Entregar Mídia",
                        style: ButtonStyle.Secondary,
                        emoji: "1502789905112105071",
                    }),
                }), Separator.Default, createRow(new ButtonBuilder({
                    customId: "ticket/manage/transcript",
                    label: "Gerar Transcript",
                    style: ButtonStyle.Secondary,
                    emoji: "1502789907511247010",
                })));
                await interaction.reply({
                    components: [container],
                    flags: ["Ephemeral", "IsComponentsV2"],
                });
                break;
            }
            case "transfer": {
                const guildData = await db.guilds.get(guild.id);
                const dynamicCategories = guildData.channels?.ticketCategories || [];
                if (dynamicCategories.length === 0) {
                    await interaction.reply({
                        content: "❌ Nenhuma categoria configurada para transferência.",
                        flags: ["Ephemeral"],
                    });
                    return;
                }
                const container = createContainer(constants.colors.primary, createSection({
                    content: "### <:arrow_right:1502789809142239243> Transferir Ticket\nSelecione a nova categoria para este atendimento abaixo.",
                    thumbnail: user.displayAvatarURL(),
                }), createRow(new StringSelectMenuBuilder({
                    customId: "ticket/manage/transfer_select",
                    placeholder: "Escolha uma categoria...",
                    options: dynamicCategories.map((cat) => ({
                        label: cat.name,
                        value: cat.value,
                        emoji: formatEmoji(cat.emoji),
                    })),
                })));
                await interaction.reply({
                    components: [container],
                    flags: ["Ephemeral", "IsComponentsV2"],
                });
                break;
            }
            case "unclaim": {
                if (ticket.claimedBy !== user.id) {
                    await interaction.reply({
                        content: "Apenas quem assumiu o ticket pode largá-lo.",
                        flags: ["Ephemeral"],
                    });
                    return;
                }
                ticket.claimedBy = undefined;
                await ticket.save();
                const owner = await guild.members
                    .fetch(ticket.ownerId)
                    .catch(() => null);
                const container = createMainPanel(ticket, owner);
                if (ticket.messageId) {
                    const mainMessage = await channel.messages
                        .fetch(ticket.messageId)
                        .catch(() => null);
                    if (mainMessage) {
                        await mainMessage
                            .edit({ components: [container] })
                            .catch((err) => console.error("[Manage]", err));
                    }
                }
                await interaction.reply({
                    content: `<:action_check:1502789974276178121> Você largou o atendimento deste ticket.`,
                    flags: ["Ephemeral"],
                });
                // Enviar Log de Ação
                await sendActionLog(guild, ticket, user, "Largar Ticket", "O staff deixou de ser o responsável pelo atendimento deste ticket.");
                break;
            }
            case "status_menu": {
                const options = Object.entries(statusMap).map(([value, { emoji, label }]) => ({
                    label,
                    value,
                    emoji,
                }));
                const container = createContainer(constants.colors.primary, createSection({
                    content: "### <:clock_check:1502789856881938502> Atualizar Status do Pedido\nSelecione o novo status para esta encomenda abaixo. O usuário e o painel principal serão atualizados.",
                    thumbnail: user.displayAvatarURL(),
                }), createRow(new StringSelectMenuBuilder({
                    customId: "ticket/manage/status_select",
                    placeholder: "Escolha o novo status...",
                    options,
                })));
                await interaction.reply({
                    components: [container],
                    flags: ["Ephemeral", "IsComponentsV2"],
                });
                break;
            }
            case "send_pix": {
                await interaction.deferReply({ flags: ["Ephemeral"] });
                const guildData = await db.guilds.get(guild.id);
                const pixKey = guildData.channels?.pixKey;
                if (!pixKey) {
                    await interaction.editReply({
                        content: "❌ Nenhuma chave PIX configurada no Dashboard (`/ticket configurar`).",
                    });
                    return;
                }
                // Gerar o Payload Real do PIX (BRCode)
                const pixPayload = generatePixPayload(pixKey);
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(pixPayload)}`;
                // 1. Enviar o texto premium
                const textContainer = createContainer(constants.colors.success, `## <:other_dollar:1502789953334280345> Informações de Pagamento\nOlá, as informações para o pagamento da sua encomenda já estão disponíveis abaixo. Utilize o QR Code ou o código "Copia e Cola" para realizar o pagamento.`, Separator.Default, `**Código PIX Copia e Cola:**\n\`\`\`\n${pixPayload}\n\`\`\``, Separator.Default, `<:action_warning:1502789801949265990> **Aviso:** Após realizar o pagamento, envie o comprovante aqui no ticket para que possamos atualizar o status da sua encomenda.`);
                const pixMessage = await channel
                    .send({
                    components: [textContainer],
                    flags: ["IsComponentsV2"],
                })
                    .catch((err) => console.error("[Manage]", err));
                if (pixMessage) {
                    // Fixar a mensagem do PIX
                    await pixMessage.pin().catch(() => null);
                    // Apagar a notificação de pin com um pequeno delay para garantir que o Discord a criou
                    setTimeout(async () => {
                        try {
                            const messages = await channel.messages.fetch({ limit: 10 });
                            const pinSystemMessage = messages.find((m) => m.type === MessageType.ChannelPinnedMessage &&
                                m.reference?.messageId === pixMessage.id);
                            if (pinSystemMessage) {
                                await pinSystemMessage.delete().catch(() => null);
                            }
                        }
                        catch (e) {
                            console.error("[Manage] Erro ao apagar aviso de pin do PIX:", e);
                        }
                    }, 2000);
                }
                // 2. Enviar o QR Code GRANDE em uma mensagem separada
                const qrEmbed = createEmbed({
                    title: `<:device_mobile:1502789873034199060> QR Code para Pagamento`,
                    description: "Escaneie a imagem abaixo com o app do seu banco:",
                    image: qrCodeUrl,
                    color: constants.colors.success,
                });
                await channel
                    .send({
                    embeds: [qrEmbed],
                })
                    .catch((err) => console.error("[Manage]", err));
                await interaction.editReply({
                    content: "<:action_check:1502789797821939752> Informações de pagamento enviadas com sucesso!",
                });
                // Enviar Log de Ação
                await sendActionLog(guild, ticket, user, "Enviar Pagamento (PIX)", `Enviou a chave PIX e o QR Code de pagamento no canal para o cliente.`);
                break;
            }
            case "notify": {
                await interaction.deferReply({ flags: ["Ephemeral"] });
                const owner = await guild.members
                    .fetch(ticket.ownerId)
                    .catch(() => null);
                if (!owner) {
                    await interaction.editReply({
                        content: "Não foi possível encontrar o dono do ticket.",
                    });
                    return;
                }
                const embed = createEmbed({
                    title: `<:bell:1502789830155702333> Notificação de Ticket`,
                    description: `Olá ${owner}, um membro da nossa equipe está chamando você em seu ticket!`,
                    fields: [
                        { name: "Ticket", value: `${channel}`, inline: true },
                        { name: "Servidor", value: `${guild.name}`, inline: true },
                    ],
                    color: constants.colors.azoxo,
                    timestamp: new Date(),
                    footer: { text: "Por favor, responda assim que possível." },
                });
                const success = await owner.send({ embeds: [embed] }).catch(() => null);
                if (success) {
                    await interaction.editReply({
                        content: `<:action_check:1502789797821939752> O dono do ticket foi notificado com sucesso via DM!`,
                    });
                    // Enviar Log de Ação
                    await sendActionLog(guild, ticket, user, "Notificar Dono", `Enviou uma notificação via DM para o cliente informando que a equipe o aguarda no ticket.`);
                }
                else {
                    await interaction.editReply({
                        content: `❌ Não foi possível enviar a DM (Usuário com DMs fechadas). Mencione-o aqui no canal: ${owner}`,
                    });
                }
                break;
            }
            case "close_confirm":
            case "close_modal": {
                const modal = new ModalBuilder()
                    .setCustomId("ticket/manage/close_submit")
                    .setTitle("Finalizar Atendimento");
                const transcriptLabel = new LabelBuilder()
                    .setLabel("Transcript:")
                    .setDescription("Deseja salvar o histórico deste atendimento?")
                    .setRadioGroupComponent(new RadioGroupBuilder().setCustomId("transcript_choice").setOptions({
                    label: "Salvar Transcript",
                    value: "yes",
                    description: "O log será gerado e enviado para a Staff.",
                }, {
                    label: "Não Salvar Transcript",
                    value: "no",
                    description: "O ticket será fechado sem gerar log público.",
                }));
                const considerationsLabel = new LabelBuilder()
                    .setLabel("Considerações Finais:")
                    .setTextInputComponent(new TextInputBuilder()
                    .setCustomId("considerations")
                    .setPlaceholder("Escreva aqui as considerações finais...")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true));
                modal.addComponents(transcriptLabel, considerationsLabel);
                await interaction.showModal(modal);
                break;
            }
            case "members":
            case "members_modal": {
                await renderMembersPanel(interaction, channel, ticket, guild);
                break;
            }
            case "rename_modal": {
                const modal = new ModalBuilder()
                    .setCustomId("ticket/manage/rename_submit")
                    .setTitle("Renomear Ticket");
                const label = new LabelBuilder()
                    .setLabel("Novo Nome")
                    .setTextInputComponent(new TextInputBuilder()
                    .setCustomId("new_name")
                    .setPlaceholder("ex: suporte-urgente")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true));
                modal.addComponents(label);
                await interaction.showModal(modal).catch((e) => console.error(e));
                break;
            }
            case "deliver_modal": {
                // Verificar se já existe um pending delivery para este canal
                const existing = await db.pendingDeliveries.findOne({
                    channelId: channel.id,
                });
                if (existing) {
                    if (existing.status === "completed") {
                        // Finalizar entrega
                        const ticket = await db.tickets.getByChannel(channel.id);
                        if (ticket) {
                            ticket.deliveries.push({
                                url: existing.url,
                                filename: existing.filename,
                                description: existing.description,
                                deliveredBy: user.id,
                                deliveredAt: new Date(),
                            });
                            await ticket.save();
                        }
                        const deliveryMessage = await channel.send({
                            content: `<:action_check:1502789797821939752> **Mídia Entregue!**\n<:file_add:1502789905112105071> **Arquivo:** \`${existing.filename}\`\n<:clipboard:1502789887907205293> **Descrição:** ${existing.description}\n<:cloud_check:1502789867355115690> **Link:** ${existing.url}`,
                        });
                        if (deliveryMessage) {
                            // Fixar a mensagem de entrega
                            await deliveryMessage.pin().catch(() => null);
                            // Apagar a notificação de pin
                            try {
                                const messages = await channel.messages.fetch({ limit: 5 });
                                const pinSystemMessage = messages.find((m) => m.type === MessageType.ChannelPinnedMessage);
                                if (pinSystemMessage) {
                                    await pinSystemMessage.delete().catch(() => null);
                                }
                            }
                            catch (e) {
                                console.error("[Manage] Erro ao apagar aviso de pin da entrega:", e);
                            }
                        }
                        const owner = ticket
                            ? await guild.members.fetch(ticket.ownerId).catch(() => null)
                            : null;
                        if (owner) {
                            const dmContainer = createContainer(constants.colors.primary, createSection({
                                content: `### <:file_check:1502789906122936431> Mídia Entregue!\nOlá ${owner}, o arquivo final do seu pedido foi entregue!`,
                                thumbnail: user.displayAvatarURL(),
                            }), Separator.Default, `<:file_add:1502789905112105071> **Arquivo:** \`${existing.filename}\``, `<:clipboard:1502789887907205293> **Descrição:** ${existing.description}`, `<:cloud_check:1502789867355115690> **Link:** ${existing.url}`);
                            await owner
                                .send({ components: [dmContainer], flags: ["IsComponentsV2"] })
                                .catch((err) => console.error("[Admin] Erro ao enviar DM:", err));
                        }
                        await db.pendingDeliveries.deleteOne({ _id: existing._id });
                        await interaction.reply({
                            content: `<:action_check:1502789797821939752> Entrega concluída! O link foi enviado no canal e na DM do cliente.`,
                            flags: ["Ephemeral"],
                        });
                    }
                    else {
                        // Ainda pendente, mostrar link
                        await interaction.reply({
                            content: `<:action_info:1502789798983766016> Você já tem um upload pendente!\n<:file_add:1502789905112105071> Faça o upload do arquivo final através do link abaixo:\n${env.WEB_URL}/upload/${existing.token}\n\nApós enviar o arquivo, a entrega será finalizada automaticamente.`,
                            flags: ["Ephemeral"],
                        });
                    }
                    break;
                }
                // Sem pending delivery, abrir modal
                const deliverModal = new ModalBuilder()
                    .setCustomId("ticket/manage/deliver_submit")
                    .setTitle("Entregar Mídia");
                const descriptionLabel = new LabelBuilder()
                    .setLabel("Descrição da Entrega")
                    .setDescription("Descreva o que está sendo entregue")
                    .setTextInputComponent(new TextInputBuilder()
                    .setCustomId("deliver_description")
                    .setPlaceholder("Ex: Arte final do banner em PNG")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true));
                deliverModal.addComponents(descriptionLabel);
                await interaction
                    .showModal(deliverModal)
                    .catch((e) => console.error(e));
                break;
            }
            case "close": {
                if (ticket.closed) {
                    await interaction.reply({
                        content: "Este ticket já está fechado!",
                        flags: ["Ephemeral"],
                    });
                    return;
                }
                await interaction.reply({
                    content: "Por favor, use o botão de finalizar para abrir o formulário.",
                    flags: ["Ephemeral"],
                });
                break;
            }
            case "delete": {
                await interaction.reply({
                    content: "Gerando transcript e deletando o canal...",
                    flags: ["Ephemeral"],
                });
                ticket.closed = true;
                await ticket.save();
                const guildData = await db.guilds.get(guild.id);
                const logChannelId = guildData.channels?.tickets;
                const transcriptUrl = await generateTranscript(channel, ticket, user);
                if (logChannelId) {
                    const logChannel = await guild.channels
                        .fetch(logChannelId)
                        .catch(() => null);
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
                            content: `## <:folder:1502789880214720533> Atendimento Deletado: ${ticket.ticketId}\nO atendimento \`${ticket.ticketId}\` foi deletado por ${user}. O histórico de mensagens foi salvo e pode ser acessado abaixo.`,
                            thumbnail: owner?.displayAvatarURL(),
                        }), Separator.Default, `**Identificação**\n` +
                            [
                                `<:user:1502789979229913268> **Aberto por:** ${owner || "Desconhecido"} (\`${ticket.ownerId}\`)`,
                                `<:action_remove:1502789800967536741> **Deletado por:** ${user} (\`${user.id}\`)`,
                                `<:user_check:1502789974276178121> **Assumido por:** ${claimer || "Ninguém"} (\`${ticket.claimedBy || "0"}\`)`,
                            ].join("\n"), Separator.Default, `**Cronologia**\n` +
                            [
                                `<:clock:1502789859960422502> **Aberto em:** <t:${openedAtTimestamp}:f> (<t:${openedAtTimestamp}:R>)`,
                                `<:clock:1502789859960422502> **Encerrado em:** <t:${closedAtTimestamp}:f> (<t:${closedAtTimestamp}:R>)`,
                            ].join("\n"), Separator.Default, `**Detalhes do Ticket**\n` +
                            [
                                `<:folder_open:1502789875928400103> **Categoria:** \`${ticket.category}\``,
                                `<:action_info:1502789798983766016> **Motivo:** \`${ticket.description || "Não informado."}\``,
                            ].join("\n"), createRow(new ButtonBuilder({
                            label: "Acessar Transcript",
                            style: ButtonStyle.Link,
                            emoji: "1502789882916110407",
                            url: transcriptUrl,
                        })));
                        await logChannel.send({
                            components: [logContainer],
                            flags: ["IsComponentsV2"],
                        });
                    }
                }
                setTimeout(() => channel.delete().catch((err) => console.error("[Manage]", err)), 5000);
                break;
            }
            case "reopen": {
                await interaction.deferReply();
                const owner = await guild.members
                    .fetch(ticket.ownerId)
                    .catch(() => null);
                if (owner) {
                    await channel.permissionOverwrites.edit(owner.id, {
                        SendMessages: true,
                        ViewChannel: true,
                    });
                }
                ticket.closed = false;
                ticket.closedBy = undefined;
                ticket.closedAt = undefined;
                await ticket.save();
                await interaction.editReply({
                    content: "🔓 Ticket reaberto com sucesso!",
                });
                break;
            }
            case "transcript": {
                await interaction.deferReply({ flags: ["Ephemeral"] });
                const transcriptUrl = await generateTranscript(channel, ticket, user);
                const container = createContainer(constants.colors.secondary, createSection({
                    content: `### Transcript Gerado\nO histórico de mensagens deste ticket foi processado com sucesso e está disponível online.`,
                    thumbnail: emojis.static.file_files,
                }), createRow(new ButtonBuilder({
                    label: "Abrir Transcript Online",
                    style: ButtonStyle.Link,
                    url: transcriptUrl,
                })));
                await interaction.editReply({
                    components: [container],
                    flags: ["IsComponentsV2"],
                });
                // Enviar Log de Ação
                await sendActionLog(guild, ticket, user, "Gerar Transcript", `Gerou o histórico de mensagens online do atendimento.`);
                break;
            }
            default: {
                await interaction.reply({
                    content: `Ação "${action}" ainda não implementada.`,
                    flags: ["Ephemeral"],
                });
            }
        }
    },
});
createResponder({
    customId: "ticket/manage/transfer_select",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        const { guild, channel, values, user } = interaction;
        if (!channel?.isTextBased())
            return;
        await interaction.deferReply({ flags: ["Ephemeral"] });
        const ticket = await db.tickets.getByChannel(channel.id);
        if (!ticket) {
            await interaction.editReply({ content: "Ticket não encontrado." });
            return;
        }
        const newCategory = values[0];
        const guildData = await db.guilds.get(guild.id);
        const dynamicCategories = guildData.channels?.ticketCategories || [];
        const selectedCategory = dynamicCategories.find((c) => c.value === newCategory);
        const parentId = selectedCategory?.parentId;
        if (!parentId) {
            await interaction.editReply({
                content: `A categoria "${newCategory.toUpperCase()}" não está configurada corretamente.`,
            });
            return;
        }
        try {
            // 1. Atualizar categoria (parent) no Discord
            await channel
                .edit({
                parent: parentId,
                lockPermissions: false,
            })
                .catch((err) => {
                console.error("[Transfer] Erro ao mover categoria:", err);
            });
            // 2. Atualizar banco de dados
            ticket.category = newCategory;
            await ticket.save();
            // Atualizar Painel Principal no canal do ticket
            const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
            const container = createMainPanel(ticket, owner);
            if (ticket.messageId) {
                const mainMessage = await channel.messages
                    .fetch(ticket.messageId)
                    .catch(() => null);
                if (mainMessage) {
                    await mainMessage
                        .edit({ components: [container] })
                        .catch((err) => console.error("[Transfer]", err));
                }
            }
            // 3. Feedback
            await interaction.editReply({
                content: `<:action_check:1502789974276178121> Ticket transferido para a categoria **${newCategory.toUpperCase()}** com sucesso!`,
            });
            // Notificação Automática por DM ao Cliente
            if (owner) {
                const dmContainer = createContainer(constants.colors.azoxo, createSection({
                    content: `### <:arrow_right:1502789809142239243> Transferência de Categoria\nOlá ${owner}, seu ticket foi transferido para a nova categoria: **${newCategory.toUpperCase()}**.\n\nA equipe responsável por esta categoria dará continuidade ao seu atendimento.`,
                    thumbnail: guild.iconURL(),
                }), createRow(new ButtonBuilder({
                    label: "Ir para o atendimento",
                    style: ButtonStyle.Link,
                    url: `https://discord.com/channels/${guild.id}/${channel.id}`,
                })));
                await owner
                    .send({
                    components: [dmContainer],
                    flags: ["IsComponentsV2"],
                })
                    .catch((err) => console.error("[Transfer DM]", err));
            }
            // Enviar Log de Ação
            await sendActionLog(guild, ticket, user, "Transferir Categoria", `Transferiu o ticket para a categoria **${newCategory.toUpperCase()}**.`);
        }
        catch (error) {
            console.error("[Ticket] Erro ao transferir ticket:", error);
            await interaction.editReply({
                content: "Ocorreu um erro ao tentar mover o canal para a nova categoria.",
            });
        }
    },
});
export async function generateTranscript(channel, ticket, closer) {
    try {
        const allMessages = [];
        let lastId = undefined;
        while (true) {
            const options = { limit: 100 };
            if (lastId)
                options.before = lastId;
            const fetched = (await channel.messages.fetch(options));
            if (fetched.size === 0)
                break;
            allMessages.push(...fetched.values());
            lastId = fetched.lastKey();
            // Limite de segurança de 2000 mensagens para evitar gargalo
            if (allMessages.length >= 2000)
                break;
        }
        const sortedMessages = allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        const guildData = await db.guilds.get(channel.guild.id);
        const vaultChannelId = guildData.channels?.vault;
        const vaultChannel = vaultChannelId
            ? await channel.guild.channels.fetch(vaultChannelId).catch(() => null)
            : null;
        const ownerMember = await channel.guild.members
            .fetch(ticket.ownerId)
            .catch(() => null);
        const claimerMember = ticket.claimedBy
            ? await channel.guild.members.fetch(ticket.claimedBy).catch(() => null)
            : null;
        const transcriptId = ticket.ticketId ||
            Math.random().toString(36).substring(2, 9).toUpperCase();
        const messagesData = [];
        for (const msg of sortedMessages) {
            const attachments = [];
            if (msg.attachments.size > 0 && vaultChannel?.isTextBased()) {
                for (const att of msg.attachments.values()) {
                    try {
                        const backup = await vaultChannel.send({
                            content: `📦 **Backup de Mídia**\nTicket: \`${transcriptId}\` | Autor: \`${msg.author.tag}\``,
                            files: [att.url],
                        });
                        const permanentUrl = backup.attachments.first()?.url;
                        attachments.push({
                            url: permanentUrl || att.url,
                            filename: att.name,
                            contentType: att.contentType,
                        });
                    }
                    catch (err) {
                        console.error(`[Vault] Erro ao fazer backup de ${att.name}:`, err);
                        attachments.push({
                            url: att.url,
                            filename: att.name,
                            contentType: att.contentType,
                        });
                    }
                }
            }
            else {
                attachments.push(...msg.attachments.map((att) => ({
                    url: att.url,
                    filename: att.name,
                    contentType: att.contentType,
                })));
            }
            messagesData.push({
                id: `${transcriptId}-${messagesData.length}`,
                messageId: msg.id,
                authorId: msg.author.id,
                authorUsername: msg.author.username,
                authorAvatar: msg.author.displayAvatarURL(),
                authorBot: msg.author.bot,
                isStaff: msg.member?.permissions.has(PermissionFlagsBits.ManageChannels) ||
                    false,
                content: msg.content,
                timestamp: msg.createdAt.toISOString(),
                attachments,
                embeds: msg.embeds.map((emb) => ({
                    title: emb.title || undefined,
                    description: emb.description || undefined,
                    color: emb.color || undefined,
                })),
            });
        }
        const transcriptData = {
            id: transcriptId,
            guildId: channel.guild.id,
            guildName: channel.guild.name,
            channelId: channel.id,
            channelName: channel.name,
            category: ticket.category || "Suporte",
            description: ticket.description || "Não informado.",
            createdAt: ticket.openedAt
                ? new Date(ticket.openedAt).toISOString()
                : new Date().toISOString(),
            closedAt: new Date().toISOString(),
            openedBy: {
                id: ticket.ownerId,
                username: ownerMember?.user.username || "Desconhecido",
                avatar: ownerMember?.displayAvatarURL() ||
                    "https://cdn.discordapp.com/embed/avatars/0.png",
            },
            closedBy: {
                id: closer.id,
                username: closer.username,
                avatar: closer.displayAvatarURL(),
            },
            claimedBy: claimerMember
                ? {
                    id: claimerMember.id,
                    username: claimerMember.user.username,
                    avatar: claimerMember.displayAvatarURL(),
                }
                : undefined,
            deliveries: ticket.deliveries?.map((d) => ({
                url: d.url,
                filename: d.filename,
                description: d.description,
                deliveredBy: d.deliveredBy,
                deliveredAt: d.deliveredAt.toISOString(),
            })),
            messageCount: sortedMessages.length,
            messages: messagesData,
        };
        // Salvar no Banco de Dados (Sincronizado com o Web App)
        await db.transcripts.updateOne({ id: transcriptId }, { $set: transcriptData }, { upsert: true });
        return `${env.WEB_URL}/transcripts/${transcriptId}`;
    }
    catch (error) {
        console.error("[Transcript] Erro ao gerar transcript:", error);
        throw error;
    }
}
// Ordem de prioridade dos status (menor = mais acima na lista)
const priorityOrder = {
    payment: 0,
    production: 1,
    open: 2,
    queue: 3,
    completed: 4,
};
async function repositionTicketByStatus(channel, newStatus) {
    try {
        const category = channel.parent;
        if (!category)
            return;
        const allChannelIds = [...category.children.cache.keys()];
        const tickets = await db.tickets
            .find({ channelId: { $in: allChannelIds } })
            .select("channelId status")
            .lean()
            .catch(() => []);
        const currentPriority = priorityOrder[newStatus] ?? 99;
        let higherCount = 0;
        for (const t of tickets) {
            if (t.channelId === channel.id)
                continue;
            const p = priorityOrder[t.status] ?? 99;
            if (p < currentPriority)
                higherCount++;
        }
        await channel.setPosition(higherCount).catch((err) => {
            console.error("[Status] Erro ao reposicionar canal:", err);
        });
    }
    catch (error) {
        console.error("[Status] Erro ao reposicionar:", error);
    }
}
// Responder para seleção de status
createResponder({
    customId: "ticket/manage/status_select",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        const { values, channel, guild, user } = interaction;
        if (!channel?.isTextBased())
            return;
        await interaction.deferUpdate();
        const ticket = await db.tickets.getByChannel(channel.id);
        if (!ticket)
            return;
        const newStatus = values[0];
        const statusData = statusMap[newStatus];
        ticket.status = newStatus;
        await ticket.save();
        // Atualizar Nome do Canal com o novo Emoji (mantendo o slug)
        const nameParts = channel.name.split("・");
        const slug = nameParts[1] || "";
        const newName = `${statusData.emoji}・${slug}`;
        await channel.setName(newName).catch((err) => {
            console.error("[Status] Erro ao renomear canal:", err);
        });
        // Reposicionar o canal na categoria conforme prioridade (não bloqueia a resposta)
        repositionTicketByStatus(channel, newStatus).catch((err) => {
            console.error("[Status] Erro assíncrono ao reposicionar:", err);
        });
        // Atualizar Painel Principal
        const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
        const container = createMainPanel(ticket, owner);
        if (ticket.messageId) {
            const mainMessage = await channel.messages
                .fetch(ticket.messageId)
                .catch(() => null);
            if (mainMessage) {
                await mainMessage
                    .edit({ components: [container] })
                    .catch((err) => console.error("[Manage]", err));
            }
        }
        // Notificar no Canal
        await channel.send({
            content: `### ${statusData.emoji} Status Atualizado\nO status deste pedido foi alterado para: **${statusData.label.toUpperCase()}** por ${user}.\n> ${statusData.description}`,
        });
        // Notificação Automática por DM ao Cliente
        if (owner) {
            const dmContainer = createContainer(constants.colors.azoxo, createSection({
                content: `### <:bell:1502789830155702333> Atualização no Pedido\nOlá ${owner}, o status do seu pedido na categoria \`${ticket.category.toUpperCase()}\` foi atualizado para **${statusData.label.toUpperCase()}**.\n\n> ${statusData.description}`,
                thumbnail: guild.iconURL(),
            }), createRow(new ButtonBuilder({
                label: "Ir para o atendimento",
                style: ButtonStyle.Link,
                url: `https://discord.com/channels/${guild.id}/${channel.id}`,
            })));
            await owner
                .send({
                components: [dmContainer],
                flags: ["IsComponentsV2"],
            })
                .catch((err) => console.error("[Status DM]", err));
        }
        // Enviar Log de Ação
        await sendActionLog(guild, ticket, user, "Alterar Status", `Alterou o status do pedido para **${statusData.label.toUpperCase()}**.`);
        await interaction
            .deleteReply()
            .catch((err) => console.error("[Manage]", err));
    },
});

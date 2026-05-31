import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createSection, modalFieldsToRecord, Separator, createRow, } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, TextInputStyle, ModalBuilder, LabelBuilder, TextInputBuilder, } from "discord.js";
import { db } from "#database";
// Função compartilhada para criar o ticket
async function processTicketSubmission(interaction) {
    const { guild, user, fields } = interaction;
    // 1. Verificar se o sistema está fechado (Loja Fechada)
    const guildData = await db.guilds.get(guild.id);
    if (guildData.channels?.closed) {
        await interaction
            .reply({
            content: `<:action_x:1502789802918150206> Desculpe, o setor de atendimentos está temporariamente **fechado**. Tente novamente mais tarde!`,
            flags: ["Ephemeral"],
        })
            .catch((err) => console.error("[Submit]", err));
        return;
    }
    await interaction.deferReply({ flags: ["Ephemeral"] }).catch((err) => console.error("[Submit]", err));
    try {
        // 0. Verificar se o usuário já possui um ticket aberto
        const existingTicket = await db.tickets.findOne({
            guildId: guild.id,
            ownerId: user.id,
            closed: false,
        });
        if (existingTicket) {
            await interaction.editReply({
                content: `<:action_x:1502789802918150206> Você já possui um ticket aberto em <#${existingTicket.channelId}>! Finalize-o antes de abrir um novo.`,
            });
            return;
        }
        const data = modalFieldsToRecord(fields);
        const categoryRaw = data.category;
        const category = (Array.isArray(categoryRaw) ? categoryRaw[0] : categoryRaw) ||
            "suporte";
        const description = data.description || "Nenhuma descrição.";
        const ticketId = Math.random().toString(36).substring(2, 9).toUpperCase();
        const openedAt = new Date().toLocaleString("pt-BR");
        // 1. Buscar as configurações de categorias no banco
        const guildData = await db.guilds.get(guild.id);
        const dynamicCategories = guildData.channels?.ticketCategories || [];
        const selectedCategory = dynamicCategories.find((c) => c.value === category);
        // Pega o ID da categoria baseado no assunto escolhido
        let parentId = selectedCategory?.parentId;
        // Emojis customizados para o tópico
        const eTicket = "<:other_ticket:1502789959378145300>";
        const eUser = "<:user:1502789979229913268>";
        const eCalendar = "<:calendar:1502789854486986752>";
        const eFolder = "<:folder:1502789880214720533>";
        // 2. Criar o canal na categoria correta
        // Usa o channelEmoji configurado (unicode) ou fallback 🎫
        const channelEmoji = selectedCategory?.channelEmoji || "🎫";
        const channel = await guild.channels.create({
            name: `${channelEmoji}・${category}-${ticketId}`,
            type: ChannelType.GuildText,
            parent: parentId || undefined,
            topic: `${eTicket}・${ticketId} | ${eUser} Aberto Por: ${user.tag} | ${eCalendar} Aberto em: ${openedAt} | ${eFolder} Categoria: ${category.toUpperCase()}`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                },
            ],
        });
        // 3. Preparar Interface
        const container = createContainer(constants.colors.azoxo, createSection({
            content: `## <:other_ticket:1502789959378145300> Ticket ${ticketId}\n${user} Seja bem-vindo(a) ao seu ticket! Através deste canal, a equipe irá realizar seu atendimento e esclarecer suas dúvidas. Envie abaixo sua solicitação e aguarde.`,
            thumbnail: user.displayAvatarURL(),
        }), Separator.Default, `<:folder_open:1502789875928400103> **Categoria do atendimento:**\n\`\`\`\n${category.toUpperCase()}\n\`\`\``, `<:action_info:1502789798983766016> **Motivo do contato:**\n\`\`\`\n${description}\n\`\`\``, Separator.Default, createRow(new ButtonBuilder({
            customId: "ticket/manage/claim",
            label: "Assumir Ticket",
            style: ButtonStyle.Secondary,
            emoji: "1502789940612698192",
        }), new ButtonBuilder({
            customId: "ticket/manage/admin",
            label: "Painel Admin",
            style: ButtonStyle.Secondary,
            emoji: "1502789931808981012",
        })), createRow(new ButtonBuilder({
            customId: "ticket/manage/close_confirm",
            label: "Finalizar Ticket",
            style: ButtonStyle.Secondary,
            emoji: "1502789802918150206",
        })));
        const mainMessage = await channel.send({
            components: [container],
            flags: ["IsComponentsV2"],
        });
        // 4. Salvar no banco
        await db.tickets.create({
            guildId: guild.id,
            ownerId: user.id,
            channelId: channel.id,
            messageId: mainMessage.id,
            ticketId,
            category,
            description,
        });
        // 5. Enviar Log de Abertura
        const logChannelId = guildData.channels?.tickets;
        if (logChannelId) {
            const logChannel = guild.channels.cache.get(logChannelId);
            if (logChannel?.isTextBased()) {
                const openedAtTimestamp = Math.floor(Date.now() / 1000);
                const categoryName = selectedCategory?.name || category.toUpperCase();
                const logContainer = createContainer(constants.colors.primary, createSection({
                    content: `## <:folder:1502789880214720533> Novo Atendimento ${ticketId}\nVenho registrar a log de abertura do atendimento \`${ticketId}\`, iniciado por ${user}. Abaixo você pode ver todas as informações do ticket.`,
                    thumbnail: user.displayAvatarURL(),
                }), Separator.Default, `**Identificação**\n` +
                    [
                        `<:user:1502789979229913268> **Aberto por:** ${user} (\`${user.id}\`)`,
                        `<:folder_open:1502789875928400103> **Categoria:** \`${categoryName}\``,
                    ].join("\n"), Separator.Default, `**Cronologia**\n` +
                    [
                        `<:clock:1502789859960422502> **Aberto em:** <t:${openedAtTimestamp}:f> (<t:${openedAtTimestamp}:R>)`,
                    ].join("\n"), Separator.Default, `**<:action_info:1502789798983766016> Motivo da Abertura:**\n\`\`\`\n${description}\n\`\`\``, createRow(new ButtonBuilder({
                    label: "Ir para o Canal",
                    style: ButtonStyle.Link,
                    emoji: "1502789882916110407",
                    url: channel.url,
                })));
                await logChannel
                    .send({ components: [logContainer], flags: ["IsComponentsV2"] })
                    .catch((err) => console.error("[Submit]", err));
            }
        }
        await interaction.editReply({
            content: `Seu ticket foi aberto com sucesso em ${channel}!`,
        });
    }
    catch (error) {
        console.error("[Ticket] ERRO NA CRIAÇÃO:", error);
        await interaction
            .editReply({
            content: `❌ Erro ao criar ticket: \`${error.message}\``,
        })
            .catch((err) => console.error("[Submit]", err));
    }
}
// 1. Responder que abre o Modal
createResponder({
    customId: "ticket/form/open",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const { guild } = interaction;
        const guildData = await db.guilds.get(guild.id);
        const dynamicCategories = guildData.channels?.ticketCategories || [];
        if (guildData.channels?.closed) {
            await interaction.reply({
                content: `<:action_x:1502789802918150206> Desculpe, o setor de atendimentos está temporariamente **fechado**. Tente novamente mais tarde!`,
                flags: ["Ephemeral"],
            });
            return;
        }
        if (dynamicCategories.length === 0) {
            await interaction.reply({
                content: "❌ Nenhuma categoria de atendimento foi configurada pela Staff ainda.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId("ticket/form/submit")
            .setTitle("Abertura de Ticket");
        const categoryLabel = new LabelBuilder()
            .setLabel("Selecione a categoria")
            .setDescription("Escolha o assunto que melhor descreve seu problema")
            .setStringSelectMenuComponent(new StringSelectMenuBuilder()
            .setCustomId("category")
            .setPlaceholder("Selecione uma categoria...")
            .setOptions(...dynamicCategories.map((cat) => {
            const emojiRaw = cat.emoji || undefined;
            let emojiOption = undefined;
            if (emojiRaw) {
                // Se for um ID numérico (emoji customizado), formatar como objeto
                if (/^\d+$/.test(emojiRaw)) {
                    emojiOption = { id: emojiRaw };
                }
                else {
                    emojiOption = emojiRaw;
                }
            }
            return {
                label: cat.name,
                value: cat.value,
                description: cat.description || undefined,
                emoji: emojiOption,
            };
        })));
        const descriptionLabel = new LabelBuilder()
            .setLabel("Descrição do Problema")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("description")
            .setPlaceholder("Descreva detalhadamente o motivo do seu contato...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true));
        modal.addComponents(categoryLabel, descriptionLabel);
        await interaction.showModal(modal).catch((e) => {
            console.error("[Ticket] Erro ao abrir modal:", e);
        });
    },
});
// 2. Responder que recebe a submissão
createResponder({
    customId: "ticket/form/submit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await processTicketSubmission(interaction);
    },
});
// 3. Responder de backup
createResponder({
    customId: "Abertura de Ticket",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        await processTicketSubmission(interaction);
    },
});

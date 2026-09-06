import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, LabelBuilder, ModalBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, } from "discord.js";
import { db } from "#database";
import { env } from "#env";
import { renderTab, formatHexColor, BANNER_URL, getTicketEmbedColor } from "./panelView.js";
import { getEmojiId, getEmojiTag } from "#functions";
import { createContainer, createRow, createSection, Separator, createEmbed, } from "@magicyan/discord";
async function updatePanelResponse(interaction, container) {
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                components: [container],
                flags: ["IsComponentsV2"],
            });
        }
        else if (interaction.isFromMessage && interaction.isFromMessage()) {
            await interaction.update({
                components: [container],
                flags: ["IsComponentsV2"],
            });
        }
        else {
            await interaction.reply({
                components: [container],
                flags: ["Ephemeral", "IsComponentsV2"],
            });
        }
    }
    catch (err) {
        if (err?.code === 10062) {
            console.warn("[Panel] Interação expirou antes da resposta (Discord 10062 Unknown Interaction).");
            return;
        }
        console.error("[Panel] Erro ao atualizar painel:", err);
    }
}
// 1. Alternador de Abas do Painel
createResponder({
    customId: "panel/tab_select",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        const tab = interaction.values[0];
        const container = await renderTab(tab, interaction.guild, interaction.client);
        await interaction.update({
            components: [container],
            flags: ["IsComponentsV2"],
        });
    },
});
// ==========================================
// 2. Módulo de Tickets - Modais e Ações
// ==========================================
// 2.1 Enviar Painel do Ticket
createResponder({
    customId: "panel/ticket/send_panel",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const targetChannelId = guildData.channels?.general || guildData.channels?.tickets;
        if (!targetChannelId) {
            await interaction.reply({
                content: `${getEmojiTag("action_warning")} Você precisa configurar o **Canal de Abertura** antes de enviar o painel!`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const channel = interaction.guild.channels.cache.get(targetChannelId);
        if (!channel || !channel.isTextBased()) {
            await interaction.reply({
                content: `${getEmojiTag("action_warning")} O canal de abertura configurado não foi encontrado ou não é de texto.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildIcon = interaction.guild.iconURL({ size: 128 }) ||
            interaction.client.user?.displayAvatarURL() ||
            emojis.static.other_ticket;
        const ticketColor = getTicketEmbedColor(guildData);
        const container = createContainer(ticketColor, createSection({
            content: `## ${getEmojiTag("other_ticket")} Central de Atendimento\nSeja bem-vindo(a) ao nosso sistema de suporte oficial. Através do atendimento, você pode falar diretamente com nossa equipe.`,
            thumbnail: guildIcon,
        }), Separator.Default, [
            `● Forneça o motivo e o máximo de informações possível para agilizar seu atendimento.`,
            `● Não chame membros da equipe no privado.`,
            `● Iniciar um atendimento sem um motivo coerente poderá resultar em punições.`,
        ].join("\n"), Separator.Default, "Clique no botão abaixo para iniciar o seu atendimento.", createRow(new ButtonBuilder({
            customId: "ticket/form/open",
            label: "Abrir Ticket",
            style: ButtonStyle.Success,
            emoji: getEmojiId("other_ticket") || "🎫",
        })));
        await channel.send({
            components: [container],
            flags: ["IsComponentsV2"],
        });
        await interaction.reply({
            content: `${getEmojiTag("action_check")} Painel de tickets enviado com sucesso em <#${targetChannelId}>!`,
            flags: ["Ephemeral"],
        });
    },
});
// 2.2 Modal Editar Canal de Abertura
createResponder({
    customId: "panel/ticket/edit_open_channel",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/ticket/modal/open_channel")
            .setTitle("Editar Canal de Abertura");
        const label = new LabelBuilder()
            .setLabel("Selecione o canal de abertura:")
            .setDescription("Canal onde o painel de tickets será exibido.")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("channel")
            .setPlaceholder("Selecione um canal")
            .setChannelTypes(ChannelType.GuildText));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/ticket/modal/open_channel",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selectedChannel = interaction.fields
            .getSelectedChannels("channel")
            ?.first();
        if (!selectedChannel) {
            await interaction.reply({
                content: "Nenhum canal foi selecionado.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.channels)
            guildData.channels = {};
        guildData.channels.general = selectedChannel.id;
        guildData.markModified("channels");
        await guildData.save();
        const container = await renderTab("ticket", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 2.3 Modal Editar Canal de Transcript
createResponder({
    customId: "panel/ticket/edit_transcript_channel",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/ticket/modal/transcript_channel")
            .setTitle("Editar Canal de Transcript");
        const label = new LabelBuilder()
            .setLabel("Selecione o canal de transcript:")
            .setDescription("Canal onde os registros de tickets serão enviados.")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("channel")
            .setPlaceholder("Selecione um canal")
            .setChannelTypes(ChannelType.GuildText));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/ticket/modal/transcript_channel",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selectedChannel = interaction.fields
            .getSelectedChannels("channel")
            ?.first();
        if (!selectedChannel) {
            await interaction.reply({
                content: "Nenhum canal foi selecionado.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.channels)
            guildData.channels = {};
        guildData.channels.tickets = selectedChannel.id;
        guildData.markModified("channels");
        await guildData.save();
        const container = await renderTab("ticket", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 2.4 Modal Adicionar Opção de Abertura (5 campos)
createResponder({
    customId: "panel/ticket/add_category",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/ticket/modal/add_category")
            .setTitle("Adicionar Opção de Abertura");
        const nameLabel = new LabelBuilder()
            .setLabel("Nome da Opção:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("name")
            .setPlaceholder("Ex: Suporte Geral")
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        const descLabel = new LabelBuilder()
            .setLabel("Descrição da Opção:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("description")
            .setPlaceholder("Ex: Dúvidas gerais e suporte técnico")
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        const emojiLabel = new LabelBuilder()
            .setLabel("Emoji do Menu:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("emoji")
            .setPlaceholder("Ex: 📦 ou ID do emoji")
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        const chEmojiLabel = new LabelBuilder()
            .setLabel("Emoji Padrão Windows (para o canal):")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("channelEmoji")
            .setPlaceholder("Ex: 📦")
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        const parentLabel = new LabelBuilder()
            .setLabel("Categoria do Discord:")
            .setDescription("Categoria onde os canais serão criados.")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("parent")
            .setPlaceholder("Selecione a categoria de destino")
            .setChannelTypes(ChannelType.GuildCategory));
        modal.addComponents(nameLabel, descLabel, emojiLabel, chEmojiLabel, parentLabel);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/ticket/modal/add_category",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const name = interaction.fields.getTextInputValue("name");
        const description = interaction.fields.getTextInputValue("description");
        const emoji = interaction.fields.getTextInputValue("emoji");
        const channelEmoji = interaction.fields.getTextInputValue("channelEmoji");
        const parentChannel = interaction.fields
            .getSelectedChannels("parent")
            ?.first();
        const parentId = parentChannel?.id;
        const value = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.channels)
            guildData.channels = {};
        if (!guildData.channels.ticketCategories) {
            guildData.channels.ticketCategories = [];
        }
        guildData.channels.ticketCategories.push({
            name,
            description,
            emoji,
            channelEmoji,
            value,
            parentId,
        });
        guildData.markModified("channels");
        await guildData.save();
        const container = await renderTab("ticket", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 2.5 Modal Remover Opção de Abertura
createResponder({
    customId: "panel/ticket/remove_category",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const categories = guildData.channels?.ticketCategories || [];
        if (categories.length === 0) {
            await interaction.reply({
                content: `${getEmojiTag("action_warning")} Nenhuma opção de categoria cadastrada para remover.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId("panel/ticket/modal/remove_category")
            .setTitle("Remover Opção de Abertura");
        const select = new StringSelectMenuBuilder()
            .setCustomId("category_to_remove")
            .setPlaceholder("Selecione a opção que deseja remover")
            .addOptions(categories.map((c) => new StringSelectMenuOptionBuilder()
            .setLabel(c.name || "Opção")
            .setValue(c.value || c.name)
            .setDescription(c.description?.slice(0, 100) || "Sem descrição")));
        const label = new LabelBuilder()
            .setLabel("Selecione a categoria para excluir:")
            .setStringSelectMenuComponent(select);
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/ticket/modal/remove_category",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selected = interaction.fields.getStringSelectValues("category_to_remove")?.[0];
        if (!selected) {
            await interaction.reply({
                content: "Nenhuma opção foi selecionada.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (guildData.channels?.ticketCategories) {
            guildData.channels.ticketCategories =
                guildData.channels.ticketCategories.filter((c) => c.value !== selected && c.name !== selected);
            guildData.markModified("channels");
            await guildData.save();
        }
        const container = await renderTab("ticket", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// ==========================================
// 3. Módulo de Pagamentos - Modais e Ações
// ==========================================
// 3.1 Editar PIX
createResponder({
    customId: "panel/payments/edit_pix",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const p = guildData.payments || {};
        const modal = new ModalBuilder()
            .setCustomId("panel/payments/modal/edit_pix")
            .setTitle("Configurar Chave PIX");
        const keyLabel = new LabelBuilder()
            .setLabel("Chave PIX:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("pixKey")
            .setPlaceholder("Ex: seuemail@dominio.com ou CPF/CNPJ/Telefone/EVP")
            .setValue(p.pixKey || guildData.channels?.pixKey || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        const typeLabel = new LabelBuilder()
            .setLabel("Tipo da Chave PIX:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("pixType")
            .setPlaceholder("Ex: E-mail, CPF, CNPJ, Telefone ou Aleatória")
            .setValue(p.pixType || "Aleatória")
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        modal.addComponents(keyLabel, typeLabel);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/payments/modal/edit_pix",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const pixKey = interaction.fields.getTextInputValue("pixKey");
        const pixType = interaction.fields.getTextInputValue("pixType");
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.payments)
            guildData.payments = {};
        guildData.payments.pixKey = pixKey;
        guildData.payments.pixType = pixType;
        if (!guildData.channels)
            guildData.channels = {};
        guildData.channels.pixKey = pixKey;
        guildData.markModified("payments");
        guildData.markModified("channels");
        await guildData.save();
        const container = await renderTab("payments", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 3.2 Editar Mercado Pago
createResponder({
    customId: "panel/payments/edit_mp",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const p = guildData.payments || {};
        const modal = new ModalBuilder()
            .setCustomId("panel/payments/modal/edit_mp")
            .setTitle("Configurar Mercado Pago");
        const tokenLabel = new LabelBuilder()
            .setLabel("Access Token (Produção):")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("mpAccessToken")
            .setPlaceholder("APP_USR-...")
            .setValue(p.mpAccessToken || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        const pkLabel = new LabelBuilder()
            .setLabel("Public Key:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("mpPublicKey")
            .setPlaceholder("APP_USR-...")
            .setValue(p.mpPublicKey || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(false));
        modal.addComponents(tokenLabel, pkLabel);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/payments/modal/edit_mp",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const mpAccessToken = interaction.fields.getTextInputValue("mpAccessToken");
        const mpPublicKey = interaction.fields.getTextInputValue("mpPublicKey") || "";
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.payments)
            guildData.payments = {};
        guildData.payments.mpAccessToken = mpAccessToken;
        guildData.payments.mpPublicKey = mpPublicKey;
        guildData.markModified("payments");
        await guildData.save();
        const container = await renderTab("payments", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 3.3 Editar Stripe
createResponder({
    customId: "panel/payments/edit_stripe",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const p = guildData.payments || {};
        const modal = new ModalBuilder()
            .setCustomId("panel/payments/modal/edit_stripe")
            .setTitle("Configurar Stripe");
        const skLabel = new LabelBuilder()
            .setLabel("Stripe Secret Key:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("stripeSecretKey")
            .setPlaceholder("sk_live_...")
            .setValue(p.stripeSecretKey || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        const whLabel = new LabelBuilder()
            .setLabel("Stripe Webhook Secret:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("stripeWebhookSecret")
            .setPlaceholder("whsec_...")
            .setValue(p.stripeWebhookSecret || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(false));
        modal.addComponents(skLabel, whLabel);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/payments/modal/edit_stripe",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const stripeSecretKey = interaction.fields.getTextInputValue("stripeSecretKey");
        const stripeWebhookSecret = interaction.fields.getTextInputValue("stripeWebhookSecret") || "";
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.payments)
            guildData.payments = {};
        guildData.payments.stripeSecretKey = stripeSecretKey;
        guildData.payments.stripeWebhookSecret = stripeWebhookSecret;
        guildData.markModified("payments");
        await guildData.save();
        const container = await renderTab("payments", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 3.4 Tutoriais de Pagamento
createResponder({
    customId: "panel/payments/tutorial_mp",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const webhookUrl = `${env.WEB_URL}/api/mercadopago/webhook`;
        const embed = createEmbed({
            title: `${getEmojiTag("book") || "📖"} Tutorial de Configuração: Mercado Pago`,
            description: [
                `**1. Gerando o Access Token:**`,
                ``,
                `• Acesse o [Painel do Desenvolvedor Mercado Pago](https://www.mercadopago.com.br/developers/panel).`,
                `• Entre na sua aplicação (ou crie uma nova).`,
                `• No menu lateral, acesse **Credenciais de produção**.`,
                `• Copie o **Access Token** (começa com \`APP_USR-\`) e insira no botão de editar acima.`,
                ``,
                `**2. Configurando o Webhook de Retorno:**`,
                ``,
                `• Ainda no menu lateral da sua aplicação, clique em **Notificações** e depois em **Webhooks**.`,
                `• No campo **URL de produção**, cole o link exato abaixo:`,
                ``,
                `\`\`\``,
                `${webhookUrl}`,
                `\`\`\``,
                ``,
                `• Na seção **Eventos**, é obrigatório marcar a opção \`Pagamentos\`.`,
                `• Clique em **Salvar** no final da página para finalizar a integração.`,
            ].join("\n"),
            color: "#22c55e",
        });
        const row = createRow(new ButtonBuilder({
            label: "Painel do Desenvolvedor",
            style: ButtonStyle.Link,
            url: "https://www.mercadopago.com.br/developers/panel",
            emoji: getEmojiId("other_card") || "💳",
        }));
        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: ["Ephemeral"],
        });
    },
});
createResponder({
    customId: "panel/payments/tutorial_stripe",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const webhookUrl = `${env.WEB_URL}/api/stripe/webhook`;
        const embed = createEmbed({
            title: `${getEmojiTag("book") || "📖"} Tutorial de Configuração: Stripe`,
            description: [
                `**1. Obtendo as Chaves de API:**`,
                ``,
                `• Acesse o [Dashboard da Stripe](https://dashboard.stripe.com/).`,
                `• No menu lateral ou superior, acesse **Desenvolvedores** e depois **Chaves de API**.`,
                `• Copie a **Chave Secreta** (começa com \`sk_live_\` ou \`sk_test_\`) e insira no botão de editar acima.`,
                ``,
                `**2. Configurando o Webhook de Retorno:**`,
                ``,
                `• No menu **Desenvolvedores**, clique em **Webhooks**.`,
                `• Clique em **Adicionar endpoint** e no campo **URL do endpoint**, cole:`,
                ``,
                `\`\`\``,
                `${webhookUrl}`,
                `\`\`\``,
                ``,
                `• Na seção **Eventos para enviar**, selecione \`checkout.session.completed\`.`,
                `• Copie o **Segredo de assinatura** (começa com \`whsec_\`) e salve nas configurações.`,
            ].join("\n"),
            color: "#22c55e",
        });
        const row = createRow(new ButtonBuilder({
            label: "Dashboard Stripe",
            style: ButtonStyle.Link,
            url: "https://dashboard.stripe.com/",
            emoji: getEmojiId("other_card") || "💳",
        }));
        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: ["Ephemeral"],
        });
    },
});
// ==========================================
// 4. Módulo de Autorole / Boas-vindas
// ==========================================
// 4.1 Canal de Entrada
createResponder({
    customId: "panel/welcome/edit_entry",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/welcome/modal/entry")
            .setTitle("Editar Canal de Entrada");
        const label = new LabelBuilder()
            .setLabel("Selecione o canal de entrada:")
            .setDescription("Canal onde as mensagens de boas-vindas serão enviadas.")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("channel")
            .setPlaceholder("Selecione um canal")
            .setChannelTypes(ChannelType.GuildText));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/welcome/modal/entry",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selected = interaction.fields.getSelectedChannels("channel")?.first();
        if (!selected) {
            await interaction.reply({
                content: "Nenhum canal selecionado.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.welcome)
            guildData.welcome = {};
        guildData.welcome.channelEntry = selected.id;
        guildData.markModified("welcome");
        await guildData.save();
        const container = await renderTab("autorole", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 4.2 Canal de Saída
createResponder({
    customId: "panel/welcome/edit_exit",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/welcome/modal/exit")
            .setTitle("Editar Canal de Saída");
        const label = new LabelBuilder()
            .setLabel("Selecione o canal de saída:")
            .setDescription("Canal onde as mensagens de despedida serão enviadas.")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("channel")
            .setPlaceholder("Selecione um canal")
            .setChannelTypes(ChannelType.GuildText));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/welcome/modal/exit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selected = interaction.fields.getSelectedChannels("channel")?.first();
        if (!selected) {
            await interaction.reply({
                content: "Nenhum canal selecionado.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.welcome)
            guildData.welcome = {};
        guildData.welcome.channelExit = selected.id;
        guildData.markModified("welcome");
        await guildData.save();
        const container = await renderTab("autorole", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 4.3 Cargo Adicionado (Autorole)
createResponder({
    customId: "panel/welcome/edit_role",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/welcome/modal/role")
            .setTitle("Editar Cargo de Autorole");
        const label = new LabelBuilder()
            .setLabel("Selecione o cargo de entrada:")
            .setDescription("Cargo entregue automaticamente ao entrar no servidor.")
            .setRoleSelectMenuComponent(new RoleSelectMenuBuilder()
            .setCustomId("role")
            .setPlaceholder("Selecione um cargo"));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/welcome/modal/role",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selected = interaction.fields.getSelectedRoles("role")?.first();
        if (!selected) {
            await interaction.reply({
                content: "Nenhum cargo selecionado.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.welcome)
            guildData.welcome = {};
        guildData.welcome.autoRole = selected.id;
        guildData.markModified("welcome");
        await guildData.save();
        const container = await renderTab("autorole", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 4.4 Tempo Mínimo de Conta (dias)
createResponder({
    customId: "panel/welcome/edit_min_age",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const minAge = guildData.welcome?.minAccountAgeDays ?? 0;
        const modal = new ModalBuilder()
            .setCustomId("panel/welcome/modal/min_age")
            .setTitle("Tempo Mínimo de Conta");
        const label = new LabelBuilder()
            .setLabel("Tempo mínimo em dias:")
            .setDescription("Ex: 3 (contas criadas há menos de 3 dias serão barradas)")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("days")
            .setPlaceholder("Ex: 0 para desativar, ou 3, 7...")
            .setValue(minAge.toString())
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/welcome/modal/min_age",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const daysStr = interaction.fields.getTextInputValue("days");
        const days = parseInt(daysStr, 10);
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.welcome)
            guildData.welcome = {};
        guildData.welcome.minAccountAgeDays = isNaN(days) || days < 0 ? 0 : days;
        guildData.markModified("welcome");
        await guildData.save();
        const container = await renderTab("autorole", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// ==========================================
// 5. Módulo de Verificação (Captcha)
// ==========================================
// 5.1 Enviar Painel de Verificação
createResponder({
    customId: "panel/verification/send_panel",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const targetChannelId = guildData.verification?.channel;
        if (!targetChannelId) {
            await interaction.reply({
                content: `${getEmojiTag("action_warning")} Você precisa configurar o **Canal de Verificação** antes de enviar o painel!`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const channel = interaction.guild.channels.cache.get(targetChannelId);
        if (!channel || !channel.isTextBased()) {
            await interaction.reply({
                content: `${getEmojiTag("action_warning")} O canal de verificação configurado não foi encontrado ou não é de texto.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const container = createContainer("#22c55e", `## ${getEmojiTag("shield_check")} VERIFICAÇÃO`, `Para ter acesso completo aos canais do servidor, realize a sua verificação de segurança abaixo.`, Separator.Default, `> Este sistema protege a nossa comunidade contra bots maliciosos, raids e invasões automáticas.`, Separator.Default, createRow(new ButtonBuilder()
            .setCustomId("verify/captcha/start")
            .setLabel("Verificar-se")
            .setStyle(ButtonStyle.Success)
            .setEmoji(getEmojiId("action_check") || "✅"), new ButtonBuilder()
            .setCustomId("verify/captcha/info")
            .setLabel("Por que a verificação é necessária?")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_info") || "❓")));
        await channel.send({
            components: [container],
            flags: ["IsComponentsV2"],
        });
        await interaction.reply({
            content: `${getEmojiTag("action_check")} Painel de verificação enviado com sucesso em <#${targetChannelId}>!`,
            flags: ["Ephemeral"],
        });
    },
});
// 5.2 Editar Canal de Verificação
createResponder({
    customId: "panel/verification/edit_channel",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/verification/modal/channel")
            .setTitle("Canal de Verificação");
        const label = new LabelBuilder()
            .setLabel("Selecione o canal de verificação:")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("channel")
            .setPlaceholder("Selecione um canal")
            .setChannelTypes(ChannelType.GuildText));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/verification/modal/channel",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selected = interaction.fields.getSelectedChannels("channel")?.first();
        if (!selected) {
            await interaction.reply({
                content: "Nenhum canal selecionado.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.verification)
            guildData.verification = {};
        guildData.verification.channel = selected.id;
        guildData.markModified("verification");
        await guildData.save();
        const container = await renderTab("verification", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 5.3 Editar Canal de Logs de Verificação
createResponder({
    customId: "panel/verification/edit_logs",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/verification/modal/logs")
            .setTitle("Canal de Logs de Verificação");
        const label = new LabelBuilder()
            .setLabel("Selecione o canal de logs:")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("channel")
            .setPlaceholder("Selecione um canal")
            .setChannelTypes(ChannelType.GuildText));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/verification/modal/logs",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selected = interaction.fields.getSelectedChannels("channel")?.first();
        if (!selected) {
            await interaction.reply({
                content: "Nenhum canal selecionado.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.verification)
            guildData.verification = {};
        guildData.verification.logsChannel = selected.id;
        guildData.markModified("verification");
        await guildData.save();
        const container = await renderTab("verification", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 5.4 Editar Cargo Verificado
createResponder({
    customId: "panel/verification/edit_verified_role",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/verification/modal/verified_role")
            .setTitle("Cargo Adicionado (Verificado)");
        const label = new LabelBuilder()
            .setLabel("Selecione o cargo de verificado:")
            .setRoleSelectMenuComponent(new RoleSelectMenuBuilder()
            .setCustomId("role")
            .setPlaceholder("Selecione um cargo"));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/verification/modal/verified_role",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selected = interaction.fields.getSelectedRoles("role")?.first();
        if (!selected) {
            await interaction.reply({
                content: "Nenhum cargo selecionado.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.verification)
            guildData.verification = {};
        guildData.verification.verifiedRole = selected.id;
        guildData.markModified("verification");
        await guildData.save();
        const container = await renderTab("verification", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 5.5 Editar Cargo Não-Verificado (Remover)
createResponder({
    customId: "panel/verification/edit_unverified_role",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/verification/modal/unverified_role")
            .setTitle("Cargo Removido (Não-Verificado)");
        const label = new LabelBuilder()
            .setLabel("Selecione o cargo a remover:")
            .setRoleSelectMenuComponent(new RoleSelectMenuBuilder()
            .setCustomId("role")
            .setPlaceholder("Selecione um cargo"));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/verification/modal/unverified_role",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selected = interaction.fields.getSelectedRoles("role")?.first();
        if (!selected) {
            await interaction.reply({
                content: "Nenhum cargo selecionado.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.verification)
            guildData.verification = {};
        guildData.verification.unverifiedRole = selected.id;
        guildData.markModified("verification");
        await guildData.save();
        const container = await renderTab("verification", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// ==========================================
// 6. Módulo de Logs do Discord
// ==========================================
createResponder({
    customId: "panel/logs/edit_channel",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("panel/logs/modal/channel")
            .setTitle("Editar Canal de Logs");
        const label = new LabelBuilder()
            .setLabel("Selecione o canal de logs:")
            .setDescription("Você pode filtrar os canais digitando o nome do canal.")
            .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
            .setCustomId("channel")
            .setPlaceholder("Selecione um canal")
            .setChannelTypes(ChannelType.GuildText));
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/logs/modal/channel",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const selected = interaction.fields.getSelectedChannels("channel")?.first();
        if (!selected) {
            await interaction.reply({
                content: "Nenhum canal selecionado.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        guildData.botLogsChannel = selected.id;
        guildData.markModified("botLogsChannel");
        await guildData.save();
        const container = await renderTab("logs", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// ==========================================
// 7. Módulo de Identidade Visual do BOT
// ==========================================
// 7.1 Alterar Nome do Bot
createResponder({
    customId: "panel/identity/edit_name",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const currentName = guildData.identity?.botName ||
            interaction.guild.members.me?.displayName ||
            interaction.client.user?.username ||
            "";
        const modal = new ModalBuilder()
            .setCustomId("panel/identity/modal/name")
            .setTitle("Editar Nome do Bot");
        const input = new TextInputBuilder()
            .setCustomId("bot_name")
            .setPlaceholder("Ex: One Tickets")
            .setValue(currentName)
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(32)
            .setRequired(true);
        const label = new LabelBuilder()
            .setLabel("Nome do Bot no Servidor:")
            .setTextInputComponent(input);
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/identity/modal/name",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const newName = interaction.fields.getTextInputValue("bot_name").trim();
        if (!newName) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} O nome não pode ser vazio.`,
                flags: ["Ephemeral"],
            }).catch(() => { });
            return;
        }
        if (interaction.isFromMessage?.()) {
            await interaction.deferUpdate().catch(() => { });
        }
        else {
            await interaction.deferReply({ ephemeral: true }).catch(() => { });
        }
        try {
            await interaction.guild.members.me?.setNickname(newName);
        }
        catch (err) {
            console.error("[Identity] Erro ao alterar apelido no servidor:", err);
        }
        try {
            await interaction.client.user?.setUsername(newName);
        }
        catch {
            // Username global pode atingir rate limit do Discord
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        guildData.identity = guildData.identity || {};
        guildData.identity.botName = newName;
        guildData.markModified("identity");
        await guildData.save();
        const container = await renderTab("identity", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 7.2 Alterar Foto de Perfil (Avatar)
createResponder({
    customId: "panel/identity/edit_avatar",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const currentAvatar = guildData.identity?.avatarUrl || "";
        const modal = new ModalBuilder()
            .setCustomId("panel/identity/modal/avatar")
            .setTitle("Editar Perfil (Avatar)");
        const input = new TextInputBuilder()
            .setCustomId("avatar_url")
            .setPlaceholder("https://exemplo.com/avatar.png")
            .setValue(currentAvatar)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        const label = new LabelBuilder()
            .setLabel("URL da Imagem de Perfil (PNG/JPG/WebP):")
            .setTextInputComponent(input);
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/identity/modal/avatar",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const avatarUrl = interaction.fields.getTextInputValue("avatar_url").trim();
        if (!avatarUrl.startsWith("http://") && !avatarUrl.startsWith("https://")) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} URL inválida! O link deve começar com \`http://\` ou \`https://\`.`,
                flags: ["Ephemeral"],
            }).catch(() => { });
            return;
        }
        // Acknowledge imediato para evitar timeout de 3 segundos do Discord enquanto faz download/upload do avatar
        if (interaction.isFromMessage?.()) {
            await interaction.deferUpdate().catch(() => { });
        }
        else {
            await interaction.deferReply({ ephemeral: true }).catch(() => { });
        }
        let discordAvatarError = false;
        try {
            await interaction.client.user?.setAvatar(avatarUrl);
        }
        catch (err) {
            console.error("[Identity] Erro ao alterar avatar global no Discord:", err);
            discordAvatarError = true;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        guildData.identity = guildData.identity || {};
        guildData.identity.avatarUrl = avatarUrl;
        guildData.markModified("identity");
        await guildData.save();
        const container = await renderTab("identity", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
        if (discordAvatarError) {
            await interaction.followUp({
                content: `${getEmojiTag("action_warning")} O avatar foi salvo nas configurações, mas o Discord bloqueou a alteração imediata da foto global por limite de taxa (máximo 2 trocas por hora). Tente novamente em alguns minutos.`,
                flags: ["Ephemeral"],
            }).catch(() => { });
        }
    },
});
// 7.3 Alterar Cor Principal (Embeds)
createResponder({
    customId: "panel/identity/edit_color",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const currentColor = guildData.identity?.primaryColor || "#1900ff";
        const modal = new ModalBuilder()
            .setCustomId("panel/identity/modal/color")
            .setTitle("Editar Cor das Embeds");
        const input = new TextInputBuilder()
            .setCustomId("color_hex")
            .setPlaceholder("#1900ff")
            .setValue(currentColor)
            .setStyle(TextInputStyle.Short)
            .setMinLength(4)
            .setMaxLength(9)
            .setRequired(true);
        const label = new LabelBuilder()
            .setLabel("Código Hex da Cor (Ex: #1900ff, #22c55e):")
            .setTextInputComponent(input);
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/identity/modal/color",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const colorHex = interaction.fields.getTextInputValue("color_hex").trim();
        if (!/^#?([0-9a-fA-F]{3,8})$/.test(colorHex)) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Cor inválida! Forneça um código hexadecimal válido, ex: \`#1900ff\` ou \`#22c55e\`.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const formattedColor = formatHexColor(colorHex);
        const guildData = await db.guilds.get(interaction.guild.id);
        guildData.identity = guildData.identity || {};
        guildData.identity.primaryColor = formattedColor;
        guildData.markModified("identity");
        await guildData.save();
        const container = await renderTab("identity", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 7.3.1 Alterar Cor da Central de Atendimento
createResponder({
    customId: "panel/identity/edit_ticket_color",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const currentTicketColor = getTicketEmbedColor(guildData);
        const modal = new ModalBuilder()
            .setCustomId("panel/identity/modal/ticket_color")
            .setTitle("Cor da Central de Atendimento");
        const input = new TextInputBuilder()
            .setCustomId("ticket_color_hex")
            .setPlaceholder("#22c55e")
            .setValue(currentTicketColor)
            .setStyle(TextInputStyle.Short)
            .setMinLength(4)
            .setMaxLength(9)
            .setRequired(true);
        const label = new LabelBuilder()
            .setLabel("Código Hex da Cor (Ex: #22c55e, #1900ff):")
            .setTextInputComponent(input);
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/identity/modal/ticket_color",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const colorHex = interaction.fields
            .getTextInputValue("ticket_color_hex")
            .trim();
        if (!/^#?([0-9a-fA-F]{3,8})$/.test(colorHex)) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Cor inválida! Forneça um código hexadecimal válido, ex: \`#22c55e\` ou \`#1900ff\`.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const formattedColor = formatHexColor(colorHex);
        const guildData = await db.guilds.get(interaction.guild.id);
        guildData.identity = guildData.identity || {};
        guildData.identity.ticketEmbedColor = formattedColor;
        guildData.markModified("identity");
        await guildData.save();
        const container = await renderTab("identity", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 7.4 Alterar Banner do Painel
createResponder({
    customId: "panel/identity/edit_banner",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const currentBanner = guildData.identity?.bannerUrl || BANNER_URL;
        const modal = new ModalBuilder()
            .setCustomId("panel/identity/modal/banner")
            .setTitle("Editar Banner do Sistema");
        const input = new TextInputBuilder()
            .setCustomId("banner_url")
            .setPlaceholder("https://exemplo.com/banner.png")
            .setValue(currentBanner)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        const label = new LabelBuilder()
            .setLabel("URL da Imagem do Banner (PNG, JPG, GIF):")
            .setTextInputComponent(input);
        modal.addComponents(label);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/identity/modal/banner",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        const bannerUrl = interaction.fields.getTextInputValue("banner_url").trim();
        if (!bannerUrl.startsWith("http://") && !bannerUrl.startsWith("https://")) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} URL inválida! O link do banner deve começar com \`http://\` ou \`https://\`.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        guildData.identity = guildData.identity || {};
        guildData.identity.bannerUrl = bannerUrl;
        guildData.markModified("identity");
        await guildData.save();
        const container = await renderTab("identity", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});
// 7.5 Restaurar Padrões de Identidade
createResponder({
    customId: "panel/identity/reset",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        guildData.identity = {
            botName: undefined,
            avatarUrl: undefined,
            primaryColor: undefined,
            ticketEmbedColor: undefined,
            bannerUrl: undefined,
        };
        guildData.markModified("identity");
        await guildData.save();
        try {
            await interaction.guild.members.me?.setNickname(null);
        }
        catch {
            // Ignorar caso sem permissão
        }
        const container = await renderTab("identity", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
    },
});

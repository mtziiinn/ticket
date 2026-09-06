import { createCommand, createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { ApplicationCommandOptionType, ApplicationCommandType, ButtonBuilder, ButtonStyle, LabelBuilder, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, } from "discord.js";
import { createContainer, createRow, Separator, } from "@magicyan/discord";
import { db } from "#database";
import { createMercadoPagoCharge } from "#functions";
createCommand({
    name: "gerar-pagamento",
    description: "💳 Gera uma cobrança automática para um cliente no chat atual.",
    type: ApplicationCommandType.ChatInput,
    defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
    options: [
        {
            name: "cliente",
            description: "Cliente que irá realizar o pagamento (opcional).",
            type: ApplicationCommandOptionType.User,
            required: false,
        },
    ],
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        const targetUser = interaction.options.getUser("cliente");
        const targetUserId = targetUser?.id || "";
        const modal = new ModalBuilder()
            .setCustomId(`payment/create_modal/${targetUserId}`)
            .setTitle("Gerar Pagamento");
        const gatewaySelect = new StringSelectMenuBuilder()
            .setCustomId("gateway")
            .setPlaceholder("Selecione um método")
            .addOptions(new StringSelectMenuOptionBuilder()
            .setLabel("PIX (Manual)")
            .setValue("pix_manual")
            .setEmoji("🟢")
            .setDescription("Chave PIX manual para transferência direta"), new StringSelectMenuOptionBuilder()
            .setLabel("PIX (Mercado Pago)")
            .setValue("pix_mp")
            .setEmoji("🟢")
            .setDescription("PIX dinâmico com aprovação automática"), new StringSelectMenuOptionBuilder()
            .setLabel("Cartão/Boleto (Mercado Pago)")
            .setValue("card_mp")
            .setEmoji("🟢")
            .setDescription("Checkout transparente via Mercado Pago"), new StringSelectMenuOptionBuilder()
            .setLabel("Stripe (Cartão Internacional)")
            .setValue("stripe")
            .setEmoji("💳")
            .setDescription("Pagamento internacional em USD/BRL via cartão"));
        const currencySelect = new StringSelectMenuBuilder()
            .setCustomId("currency")
            .setPlaceholder("Selecione a moeda")
            .addOptions(new StringSelectMenuOptionBuilder()
            .setLabel("Real Brasileiro (BRL)")
            .setValue("BRL")
            .setEmoji("🇧🇷")
            .setDefault(true), new StringSelectMenuOptionBuilder()
            .setLabel("Dólar Americano (USD)")
            .setValue("USD")
            .setEmoji("🇺🇸"));
        const gatewayLabel = new LabelBuilder()
            .setLabel("Selecione o Gateway de Pagamento:")
            .setStringSelectMenuComponent(gatewaySelect);
        const currencyLabel = new LabelBuilder()
            .setLabel("Selecione a Moeda:")
            .setStringSelectMenuComponent(currencySelect);
        const amountLabel = new LabelBuilder()
            .setLabel("Valor da Cobrança:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("amount")
            .setPlaceholder("Ex: 15.00 ou 50")
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        const descLabel = new LabelBuilder()
            .setLabel("Descrição do Produto / Serviço:")
            .setTextInputComponent(new TextInputBuilder()
            .setCustomId("description")
            .setPlaceholder("Ex: Cargo VIP Mensal / Produto Digital")
            .setStyle(TextInputStyle.Short)
            .setRequired(true));
        modal.addComponents(gatewayLabel, currencyLabel, amountLabel, descLabel);
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "payment/create_modal/:targetUserId",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction, { targetUserId }) {
        const gateway = interaction.fields.getStringSelectValues("gateway")?.[0] || "pix_mp";
        const currency = interaction.fields.getStringSelectValues("currency")?.[0] || "BRL";
        const amountStr = interaction.fields.getTextInputValue("amount");
        const description = interaction.fields.getTextInputValue("description");
        const amount = parseFloat(amountStr.replace(",", "."));
        if (isNaN(amount) || amount <= 0) {
            await interaction.reply({
                content: "⚠️ Valor de cobrança inválido!",
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction.deferReply();
        const guildData = await db.guilds.get(interaction.guild.id);
        const p = guildData.payments || {};
        const currencySymbol = currency === "USD" ? "$" : "R$";
        const formattedAmount = `${currencySymbol} ${amount.toFixed(2)}`;
        const clientMention = targetUserId ? `<@${targetUserId}>` : "Qualquer membro";
        if (gateway === "pix_manual") {
            const pixKey = p.pixKey || guildData.channels?.pixKey || "Não configurada";
            const pixType = p.pixType || "Chave PIX";
            const container = createContainer("#22c55e", "## 💳 Cobrança Gerada", Separator.Default, [
                `| **Cliente:** ${clientMention}`,
                `| **Valor:** \`${formattedAmount}\``,
                `| **Método:** PIX (Manual)`,
                `| **Descrição:** ${description}`,
            ].join("\n"), Separator.Default, `| **Chave PIX (${pixType}):**\n\`\`\`text\n${pixKey}\n\`\`\``, Separator.Default, `*Após realizar o pagamento, envie o comprovante neste chat para que a equipe confirme o recebimento.*`);
            await interaction.editReply({
                components: [container],
                flags: ["IsComponentsV2"],
            });
            return;
        }
        if (gateway === "pix_mp" || gateway === "card_mp") {
            const chargeResult = await createMercadoPagoCharge({
                amount,
                description,
                ticketId: `charge_${Date.now()}`,
                channelId: interaction.channelId || "",
            });
            if (!chargeResult.success) {
                await interaction.editReply({
                    content: `❌ Erro ao gerar cobrança no Mercado Pago:\n${chargeResult.error}`,
                });
                return;
            }
            const rows = [];
            const sections = [
                `| **Cliente:** ${clientMention}`,
                `| **Valor:** \`${formattedAmount}\``,
                `| **Método:** ${gateway === "pix_mp" ? "PIX (Mercado Pago)" : "Cartão / Boleto (Mercado Pago)"}`,
                `| **Descrição:** ${description}`,
            ];
            if (chargeResult.pix?.qrCode) {
                sections.push(`| **Código PIX Copia e Cola:**\n\`\`\`text\n${chargeResult.pix.qrCode}\n\`\`\``);
            }
            if (chargeResult.cardCheckout?.initPoint) {
                rows.push(createRow(new ButtonBuilder()
                    .setLabel("Pagar com Cartão / Boleto")
                    .setStyle(ButtonStyle.Link)
                    .setURL(chargeResult.cardCheckout.initPoint)
                    .setEmoji("💳")));
            }
            const container = createContainer("#22c55e", "## 💳 Cobrança Gerada (Mercado Pago)", Separator.Default, sections.join("\n"), Separator.Default, `*O pagamento é verificado automaticamente pelo sistema assim que for aprovado.*`, ...rows);
            await interaction.editReply({
                components: [container],
                flags: ["IsComponentsV2"],
            });
            return;
        }
        // Stripe
        const container = createContainer("#22c55e", "## 💳 Cobrança Gerada (Stripe)", Separator.Default, [
            `| **Cliente:** ${clientMention}`,
            `| **Valor:** \`${formattedAmount}\``,
            `| **Método:** Stripe (Internacional)`,
            `| **Descrição:** ${description}`,
        ].join("\n"), Separator.Default, `*Acesse a fatura pelo link de checkout seguro da Stripe.*`);
        await interaction.editReply({
            components: [container],
            flags: ["IsComponentsV2"],
        });
    },
});

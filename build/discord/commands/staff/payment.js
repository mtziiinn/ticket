import { createCommand, createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { ApplicationCommandOptionType, ApplicationCommandType, ButtonBuilder, ButtonStyle, LabelBuilder, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, } from "discord.js";
import { createContainer, createMediaGallery, createRow, Separator, } from "@magicyan/discord";
import { db } from "#database";
import { env } from "#env";
import { createMercadoPagoCharge, generatePixPayload, getEmojiId, getEmojiTag, } from "#functions";
import { sendActionLog } from "../../responders/ticket/logger.js";
export function createPaymentModal(targetUserId = "") {
    const modal = new ModalBuilder()
        .setCustomId(`payment/create_modal/${targetUserId}`)
        .setTitle("Gerar Pagamento");
    const gatewaySelect = new StringSelectMenuBuilder()
        .setCustomId("gateway")
        .setPlaceholder("Selecione um método de pagamento")
        .addOptions(new StringSelectMenuOptionBuilder()
        .setLabel("PIX (Manual)")
        .setValue("pix_manual")
        .setEmoji(getEmojiId("other_dollar") || "🟢")
        .setDescription("Chave PIX manual para transferência direta"), new StringSelectMenuOptionBuilder()
        .setLabel("PIX (Mercado Pago)")
        .setValue("pix_mp")
        .setEmoji(getEmojiId("other_dollar") || "🟢")
        .setDescription("PIX dinâmico com aprovação automática"), new StringSelectMenuOptionBuilder()
        .setLabel("Cartão/Boleto (Mercado Pago)")
        .setValue("card_mp")
        .setEmoji(getEmojiId("other_card") || "🟢")
        .setDescription("Checkout transparente via Mercado Pago"), new StringSelectMenuOptionBuilder()
        .setLabel("Stripe (Cartão Internacional)")
        .setValue("stripe")
        .setEmoji(getEmojiId("other_card") || "💳")
        .setDescription("Pagamento internacional em USD/BRL via cartão"));
    const currencySelect = new StringSelectMenuBuilder()
        .setCustomId("currency")
        .setPlaceholder("Selecione a moeda")
        .addOptions(new StringSelectMenuOptionBuilder()
        .setLabel("Real Brasileiro (BRL)")
        .setValue("BRL")
        .setEmoji(getEmojiId("other_dollar"))
        .setDefault(true), new StringSelectMenuOptionBuilder()
        .setLabel("Dólar Americano (USD)")
        .setValue("USD")
        .setEmoji(getEmojiId("other_card")));
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
    return modal;
}
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
        const modal = createPaymentModal(targetUserId);
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
                content: `${getEmojiTag("action_warning")} Valor de cobrança inválido!`,
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction.deferReply();
        const guildData = await db.guilds.get(interaction.guild.id);
        const p = guildData.payments || {};
        const currencySymbol = currency === "USD" ? "$" : "R$";
        const formattedAmount = `${currencySymbol} ${amount.toFixed(2)}`;
        // Identificar cliente e ticket
        const ticket = await db.tickets.getByChannel(interaction.channelId || "");
        const finalTargetUserId = targetUserId || ticket?.ownerId || "";
        const clientMention = finalTargetUserId
            ? `<@${finalTargetUserId}>`
            : "Qualquer membro";
        if (gateway === "pix_manual") {
            const pixKey = p.pixKey || guildData.channels?.pixKey || "Não configurada";
            const pixType = p.pixType || "Chave PIX";
            const qrSections = [];
            if (pixKey && pixKey !== "Não configurada") {
                const pixPayload = generatePixPayload(pixKey);
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(pixPayload)}`;
                qrSections.push(createMediaGallery(qrCodeUrl), `| **Código PIX Copia e Cola:**\n\`\`\`text\n${pixPayload}\n\`\`\``, Separator.Default);
            }
            const container = createContainer("#22c55e", `## ${getEmojiTag("other_dollar")} Cobrança Gerada`, Separator.Default, [
                `| **Cliente:** ${clientMention}`,
                `| **Valor:** \`${formattedAmount}\``,
                `| **Método:** PIX (Manual)`,
                `| **Descrição:** ${description}`,
            ].join("\n"), Separator.Default, `| **Chave PIX (${pixType}):**\n\`\`\`text\n${pixKey}\n\`\`\``, Separator.Default, ...qrSections, `*Após realizar o pagamento, envie o comprovante neste chat para que a equipe confirme o recebimento.*`);
            const msg = await interaction.editReply({
                components: [container],
                flags: ["IsComponentsV2"],
            });
            if (ticket) {
                ticket.payment = {
                    method: "pix_manual",
                    amount,
                    currency,
                    description,
                    status: "pending",
                };
                await ticket.save();
                await sendActionLog(interaction.guild, ticket, interaction.user, "Gerar Cobrança", `Gerou cobrança no valor de **${formattedAmount}** via PIX Manual.`);
                if (msg && "pin" in msg) {
                    await msg.pin().catch(() => null);
                }
            }
            return;
        }
        if (gateway === "pix_mp" || gateway === "card_mp") {
            const ticketId = ticket?.ticketId || `charge_${Date.now()}`;
            const token = p.mpAccessToken || env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
            const chargeResult = await createMercadoPagoCharge({
                amount,
                description,
                ticketId,
                channelId: interaction.channelId || "",
                token,
            });
            if (!chargeResult.success) {
                await interaction.editReply({
                    content: `${getEmojiTag("action_x")} Erro ao gerar cobrança no Mercado Pago:\n${chargeResult.error}`,
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
            const mediaItems = [];
            if (chargeResult.pix?.qrCode) {
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(chargeResult.pix.qrCode)}`;
                mediaItems.push(createMediaGallery(qrImageUrl));
                sections.push(`| **Código PIX Copia e Cola:**\n\`\`\`text\n${chargeResult.pix.qrCode}\n\`\`\``);
            }
            const actionButtons = [];
            if (chargeResult.cardCheckout?.initPoint) {
                actionButtons.push(new ButtonBuilder()
                    .setLabel("Pagar com Cartão / Boleto")
                    .setStyle(ButtonStyle.Link)
                    .setURL(chargeResult.cardCheckout.initPoint)
                    .setEmoji(getEmojiId("other_card") || "💳"));
            }
            if (chargeResult.pix?.ticketUrl) {
                actionButtons.push(new ButtonBuilder()
                    .setLabel("Comprovante Mercado Pago")
                    .setStyle(ButtonStyle.Link)
                    .setURL(chargeResult.pix.ticketUrl)
                    .setEmoji(getEmojiId("other_dollar") || "📄"));
            }
            if (actionButtons.length > 0) {
                rows.push(createRow(...actionButtons));
            }
            const container = createContainer("#22c55e", `## ${getEmojiTag("other_dollar")} Cobrança Gerada (Mercado Pago)`, Separator.Default, sections.join("\n"), Separator.Default, ...mediaItems, mediaItems.length > 0 ? Separator.Default : [], ...rows, rows.length > 0 ? Separator.Default : [], `*O pagamento é verificado automaticamente pelo sistema assim que for aprovado.*`);
            const msg = await interaction.editReply({
                components: [container],
                flags: ["IsComponentsV2"],
            });
            if (ticket) {
                ticket.payment = {
                    id: chargeResult.pix?.paymentId
                        ? String(chargeResult.pix.paymentId)
                        : "",
                    method: gateway === "pix_mp" ? "pix" : "card",
                    amount,
                    currency,
                    description,
                    status: "pending",
                    qrCode: chargeResult.pix?.qrCode,
                    qrCodeBase64: chargeResult.pix?.qrCodeBase64,
                    ticketUrl: chargeResult.pix?.ticketUrl,
                };
                await ticket.save();
                await sendActionLog(interaction.guild, ticket, interaction.user, "Gerar Cobrança", `Gerou cobrança no valor de **${formattedAmount}** via Mercado Pago (${gateway === "pix_mp" ? "PIX" : "Cartão"}).`);
                if (msg && "pin" in msg) {
                    await msg.pin().catch(() => null);
                }
            }
            return;
        }
        // Stripe
        const rows = [];
        if (p.stripeSecretKey) {
            try {
                const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${p.stripeSecretKey}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        "line_items[0][price_data][currency]": currency.toLowerCase(),
                        "line_items[0][price_data][product_data][name]": description,
                        "line_items[0][price_data][unit_amount]": Math.round(amount * 100).toString(),
                        "line_items[0][quantity]": "1",
                        mode: "payment",
                        success_url: `${env.WEB_URL}?success=true`,
                        cancel_url: `${env.WEB_URL}?canceled=true`,
                        client_reference_id: ticket?.ticketId || `stripe_${Date.now()}`,
                    }).toString(),
                });
                if (stripeRes.ok) {
                    const session = (await stripeRes.json());
                    if (session.url) {
                        rows.push(createRow(new ButtonBuilder()
                            .setLabel("Pagar com Stripe (Cartão)")
                            .setStyle(ButtonStyle.Link)
                            .setURL(session.url)
                            .setEmoji(getEmojiId("other_card") || "💳")));
                    }
                }
            }
            catch (err) {
                console.warn("[Stripe Checkout] Falha ao criar sessão:", err);
            }
        }
        const container = createContainer("#22c55e", `## ${getEmojiTag("other_card")} Cobrança Gerada (Stripe)`, Separator.Default, [
            `| **Cliente:** ${clientMention}`,
            `| **Valor:** \`${formattedAmount}\``,
            `| **Método:** Stripe (Internacional)`,
            `| **Descrição:** ${description}`,
        ].join("\n"), Separator.Default, ...rows, rows.length > 0 ? Separator.Default : [], `*Acesse a fatura pelo link de checkout seguro da Stripe.*`);
        const msg = await interaction.editReply({
            components: [container],
            flags: ["IsComponentsV2"],
        });
        if (ticket) {
            ticket.payment = {
                method: "stripe",
                amount,
                currency,
                description,
                status: "pending",
            };
            await ticket.save();
            await sendActionLog(interaction.guild, ticket, interaction.user, "Gerar Cobrança", `Gerou cobrança no valor de **${formattedAmount}** via Stripe.`);
            if (msg && "pin" in msg) {
                await msg.pin().catch(() => null);
            }
        }
    },
});

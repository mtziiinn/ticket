import { createContainer, createSection, Separator, createRow, createMediaGallery, } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, } from "discord.js";
import { db } from "#database";
import { getEmojiId, getEmojiTag } from "#functions";
export function formatHexColor(color) {
    const cleaned = color.trim().replace(/^#/, "");
    if (cleaned.length === 8) {
        return `#${cleaned.slice(0, 6)}`;
    }
    return `#${cleaned}`;
}
export const PANEL_COLOR = formatHexColor("#1900ff");
export const BANNER_URL = "https://media.r2rp.com/v1/files/1780269148770-zwwjg93n.png";
export function buildPanelDropdown(currentTab = "home") {
    const options = [
        new StringSelectMenuOptionBuilder()
            .setValue("home")
            .setLabel("Início")
            .setDescription("Visão geral e métricas do bot")
            .setEmoji(getEmojiId("other_home") || "🏠")
            .setDefault(currentTab === "home"),
        new StringSelectMenuOptionBuilder()
            .setValue("identity")
            .setLabel("Identidade")
            .setDescription("Configurações visuais e identidade")
            .setEmoji(getEmojiId("apps_figma") || "🎨")
            .setDefault(currentTab === "identity"),
        new StringSelectMenuOptionBuilder()
            .setValue("ticket")
            .setLabel("Ticket")
            .setDescription("Canais e opções de abertura do suporte")
            .setEmoji(getEmojiId("other_ticket") || "📁")
            .setDefault(currentTab === "ticket"),
        new StringSelectMenuOptionBuilder()
            .setValue("payments")
            .setLabel("Pagamentos")
            .setDescription("Gateways PIX, Mercado Pago e Stripe")
            .setEmoji(getEmojiId("other_dollar") || "💳")
            .setDefault(currentTab === "payments"),
        new StringSelectMenuOptionBuilder()
            .setValue("sales")
            .setLabel("Vendas")
            .setDescription("Gerenciamento de vendas e entregas")
            .setEmoji(getEmojiId("other_card") || "🛒")
            .setDefault(currentTab === "sales"),
        new StringSelectMenuOptionBuilder()
            .setValue("autorole")
            .setLabel("Autorole")
            .setDescription("Boas-vindas, saída e cargo inicial")
            .setEmoji(getEmojiId("user_users") || "👥")
            .setDefault(currentTab === "autorole"),
        new StringSelectMenuOptionBuilder()
            .setValue("verification")
            .setLabel("Verificação")
            .setDescription("Sistema de captcha interativo")
            .setEmoji(getEmojiId("shield_check") || "🛡️")
            .setDefault(currentTab === "verification"),
        new StringSelectMenuOptionBuilder()
            .setValue("logs")
            .setLabel("Logs do Discord")
            .setDescription("Canal de registros e logs do bot")
            .setEmoji(getEmojiId("folder") || "📁")
            .setDefault(currentTab === "logs"),
        new StringSelectMenuOptionBuilder()
            .setValue("commands")
            .setLabel("Comandos")
            .setDescription("Lista de comandos e instruções do bot")
            .setEmoji(getEmojiId("other_terminal") || "⌨️")
            .setDefault(currentTab === "commands"),
    ];
    return createRow(new StringSelectMenuBuilder()
        .setCustomId("panel/tab_select")
        .setPlaceholder("📄 Selecione uma opção...")
        .addOptions(options));
}
export async function renderHomeTab(guild, client) {
    const rawPing = Math.round(client.ws.ping);
    const ping = isNaN(rawPing) || rawPing <= 0 ? 24 : rawPing;
    const openTicketsCount = await db.tickets.countDocuments({
        guildId: guild.id,
        closed: false,
    });
    const memberCount = guild.memberCount;
    return createContainer(PANEL_COLOR, "## PAINEL DE CONFIGURAÇÕES", buildPanelDropdown("home"), Separator.Default, `| ${getEmojiTag("other_bot")} **Status do BOT:** \`${getEmojiTag("action_check")} Online - ${ping}ms\``, Separator.Default, `| ${getEmojiTag("other_ticket")} **Tickets em Aberto:** \`${openTicketsCount}\``, Separator.Default, `| ${getEmojiTag("user_users")} **Membros no Servidor:** \`${memberCount}\``, Separator.Default, [
        `### ${getEmojiTag("bell")} Avisos Importantes`,
        `• **Emojis da Aplicação:** O bot gerencia e sincroniza os emojis personalizados diretamente pelo Discord Developer Portal.`,
        `• **Não Remova os Emojis:** Evite excluir ou alterar manualmente os emojis cadastrados no portal do desenvolvedor, pois isso pode causar erros visuais e mau funcionamento dos botões e menus do bot.`,
    ].join("\n"), Separator.Default, createMediaGallery(BANNER_URL));
}
export async function renderTicketTab(guildData) {
    const channels = guildData.channels || {};
    const openChannelDisplay = channels.general
        ? `<#${channels.general}>`
        : "*Não configurado*";
    const transcriptChannelDisplay = channels.tickets
        ? `<#${channels.tickets}>`
        : "*Não configurado*";
    const categories = channels.ticketCategories || [];
    const catLines = categories.length > 0
        ? categories
            .map((cat, idx) => {
            const emoji = cat.emoji || "🎫";
            const parent = cat.parentId ? `<#${cat.parentId}>` : "Nenhuma";
            return `\`${idx + 1}.\` ${emoji} **${cat.name}** (Categoria: ${parent})`;
        })
            .join("\n")
        : "*Nenhuma opção de categoria cadastrada.*";
    return createContainer(PANEL_COLOR, `## ${getEmojiTag("other_ticket")} Sistema de Ticket`, buildPanelDropdown("ticket"), Separator.Default, createRow(new ButtonBuilder()
        .setCustomId("panel/ticket/send_panel")
        .setLabel("Enviar Painel do Ticket")
        .setStyle(ButtonStyle.Success)
        .setEmoji(getEmojiId("mail") || "📨")), Separator.Default, createSection({
        content: `| **Canal de Abertura:**\n${openChannelDisplay}`,
        button: new ButtonBuilder()
            .setCustomId("panel/ticket/edit_open_channel")
            .setLabel("Editar Canal")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, createSection({
        content: `| **Canal de Transcript:**\n${transcriptChannelDisplay}`,
        button: new ButtonBuilder()
            .setCustomId("panel/ticket/edit_transcript_channel")
            .setLabel("Editar Canal")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, `| **Opções de Abertura:**\n${catLines}`, Separator.Default, createRow(new ButtonBuilder()
        .setCustomId("panel/ticket/add_category")
        .setLabel("Adicionar Opção")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "➕"), new ButtonBuilder()
        .setCustomId("panel/ticket/remove_category")
        .setLabel("Remover Opção")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_remove") || "➖")
        .setDisabled(categories.length === 0)));
}
export async function renderPaymentsTab(guildData) {
    const p = guildData.payments || {};
    const pixKey = p.pixKey || guildData.channels?.pixKey;
    const pixType = p.pixType || "Chave PIX";
    const mpToken = p.mpAccessToken;
    const stripeKey = p.stripeSecretKey;
    return createContainer(PANEL_COLOR, `## ${getEmojiTag("other_dollar")} Sistema de Pagamentos`, buildPanelDropdown("payments"), Separator.Default, createSection({
        content: `| **PIX (Manual):**\nChave: \`${pixKey || "Não configurada"}\` (${pixType})`,
        button: new ButtonBuilder()
            .setCustomId("panel/payments/edit_pix")
            .setLabel("Editar PIX")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, createSection({
        content: `| **Mercado Pago (Nacional):**\nStatus: \`${mpToken ? `Configurado ${getEmojiTag("action_check")}` : `Pendente ${getEmojiTag("action_x")}`}\``,
        button: new ButtonBuilder()
            .setCustomId("panel/payments/edit_mp")
            .setLabel("Editar Mercado Pago")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, createSection({
        content: `| **Stripe (Internacional):**\nStatus: \`${stripeKey ? `Configurado ${getEmojiTag("action_check")}` : `Pendente ${getEmojiTag("action_x")}`}\``,
        button: new ButtonBuilder()
            .setCustomId("panel/payments/edit_stripe")
            .setLabel("Editar Stripe")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, createRow(new ButtonBuilder()
        .setCustomId("panel/payments/tutorial_mp")
        .setLabel("Tutorial Mercado Pago")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("book") || "📖"), new ButtonBuilder()
        .setCustomId("panel/payments/tutorial_stripe")
        .setLabel("Tutorial Stripe")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("book") || "📖")));
}
export async function renderAutoroleTab(guildData) {
    const w = guildData.welcome || {};
    const entryChannel = w.channelEntry ? `<#${w.channelEntry}>` : "*Não configurado*";
    const exitChannel = w.channelExit ? `<#${w.channelExit}>` : "*Não configurado*";
    const roleDisplay = w.autoRole ? `<@&${w.autoRole}>` : "*Não configurado*";
    const minAge = w.minAccountAgeDays ?? 0;
    return createContainer(PANEL_COLOR, `## ${getEmojiTag("user_users")} Sistema de Boas-vindas & Autorole`, buildPanelDropdown("autorole"), Separator.Default, createSection({
        content: `| **Canal de Entrada:**\n${entryChannel}`,
        button: new ButtonBuilder()
            .setCustomId("panel/welcome/edit_entry")
            .setLabel("Editar Canal")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, createSection({
        content: `| **Canal de Saída:**\n${exitChannel}`,
        button: new ButtonBuilder()
            .setCustomId("panel/welcome/edit_exit")
            .setLabel("Editar Canal")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, createSection({
        content: `| **Cargo Adicionado (Autorole):**\n${roleDisplay}`,
        button: new ButtonBuilder()
            .setCustomId("panel/welcome/edit_role")
            .setLabel("Editar Cargo")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, createSection({
        content: `| **Tempo Mínimo de Conta:**\n\`${minAge} dias\` *(Proteção Anti-Fake/Raid)*`,
        button: new ButtonBuilder()
            .setCustomId("panel/welcome/edit_min_age")
            .setLabel("Editar Tempo")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }));
}
export async function renderVerificationTab(guildData) {
    const v = guildData.verification || {};
    const vChannel = v.channel ? `<#${v.channel}>` : "*Não configurado*";
    const logsChannel = v.logsChannel ? `<#${v.logsChannel}>` : "*Não configurado*";
    const vRole = v.verifiedRole ? `<@&${v.verifiedRole}>` : "*Não configurado*";
    const unvRole = v.unverifiedRole ? `<@&${v.unverifiedRole}>` : "*Não configurado*";
    return createContainer(PANEL_COLOR, `## ${getEmojiTag("shield_check")} Sistema de Verificação (Captcha)`, buildPanelDropdown("verification"), Separator.Default, createRow(new ButtonBuilder()
        .setCustomId("panel/verification/send_panel")
        .setLabel("Enviar Painel de Verificação")
        .setStyle(ButtonStyle.Success)
        .setEmoji(getEmojiId("mail") || "📨")), Separator.Default, createSection({
        content: `| **Canal de Verificação:**\n${vChannel}`,
        button: new ButtonBuilder()
            .setCustomId("panel/verification/edit_channel")
            .setLabel("Editar Canal")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, createSection({
        content: `| **Canal de Logs de Verificação:**\n${logsChannel}`,
        button: new ButtonBuilder()
            .setCustomId("panel/verification/edit_logs")
            .setLabel("Editar Canal")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, createSection({
        content: `| **Cargo Adicionado (Verificado):**\n${vRole}`,
        button: new ButtonBuilder()
            .setCustomId("panel/verification/edit_verified_role")
            .setLabel("Editar Cargo")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, createSection({
        content: `| **Cargo Removido (Não-Verificado):**\n${unvRole}`,
        button: new ButtonBuilder()
            .setCustomId("panel/verification/edit_unverified_role")
            .setLabel("Editar Cargo")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }));
}
export async function renderLogsTab(guildData) {
    const logsChannel = guildData.botLogsChannel
        ? `<#${guildData.botLogsChannel}>`
        : "*Não configurado*";
    return createContainer(PANEL_COLOR, `## ${getEmojiTag("folder")} Sistema de Logs do Discord`, buildPanelDropdown("logs"), Separator.Default, createSection({
        content: `| **Canal de Logs:**\n${logsChannel}`,
        button: new ButtonBuilder()
            .setCustomId("panel/logs/edit_channel")
            .setLabel("Editar Canal")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(getEmojiId("action_add") || "✏️"),
    }), Separator.Default, `*Neste canal, o bot registrará ações administrativas, eventos de moderação e movimentações do sistema.*`);
}
export async function renderIdentityTab(guild) {
    return createContainer(PANEL_COLOR, `## ${getEmojiTag("apps_figma")} Identidade Visual do BOT`, buildPanelDropdown("identity"), Separator.Default, `| **Servidor:** ${guild.name}\n| **Cor Principal:** \`${PANEL_COLOR}\` (Azul / Neon)\n| **Banner Atual:** Visual padrão configurado`, Separator.Default, createMediaGallery(BANNER_URL));
}
export async function renderSalesTab() {
    return createContainer(PANEL_COLOR, `## ${getEmojiTag("other_card")} Sistema de Vendas`, buildPanelDropdown("sales"), Separator.Default, `| **Status das Vendas:** Sistema integrado e pronto para cobranças via \`/gerar-pagamento\`.\n| **Gateways:** Suporte a PIX com QR Code, Mercado Pago e Stripe.`, Separator.Default, `*Para emitir cobranças diretas para clientes em um canal de ticket ou chat, use o comando \`/gerar-pagamento\`.*`);
}
export async function renderCommandsTab() {
    return createContainer(PANEL_COLOR, `## ${getEmojiTag("other_terminal")} Comandos do BOT`, buildPanelDropdown("commands"), Separator.Default, [
        `### ${getEmojiTag("other_bot")} Comandos de Configuração e Gestão`,
        `• \`/painel\` - Exibe o painel completo e interativo de configuração do BOT (envio de painéis, categorias, gateways).`,
        `• \`/ticket stats\` - Exibe estatísticas de atendimentos por período e categoria.`,
        `• \`/ticket limpar-cache\` - Limpa o cache de mensagens e otimiza o uso de memória RAM.`,
        ``,
        `### ${getEmojiTag("lock")} Moderação e Gestão de Chat`,
        `• \`/bloquear-chat\` - Bloqueia o canal atual para que apenas administradores enviem mensagens.`,
        `• \`/desbloquear-chat\` - Desbloqueia o canal atual para que todos os membros possam digitar.`,
        `• \`/limpar-chat [quantidade]\` - Limpa de 1 a 100 mensagens do chat atual em massa.`,
        ``,
        `### ${getEmojiTag("other_dollar")} Pagamentos e Cobranças`,
        `• \`/gerar-pagamento\` - Gera uma cobrança interativa (PIX/Mercado Pago/Stripe) em BRL ou USD para um cliente.`,
        ``,
        `### ${getEmojiTag("other_ticket")} Sorteios e Eventos`,
        `• \`/criar-sorteio [item] [ganhadores] [tempo]\` - Inicia um sorteio interativo com botões de participação e painel de gerenciamento (reroll, finalizar, ver inscritos).`,
    ].join("\n"));
}
export async function renderTab(tab, guild, client, guildData) {
    if (!guildData) {
        guildData = await db.guilds.get(guild.id);
    }
    switch (tab) {
        case "identity":
            return await renderIdentityTab(guild);
        case "ticket":
            return await renderTicketTab(guildData);
        case "payments":
            return await renderPaymentsTab(guildData);
        case "sales":
            return await renderSalesTab();
        case "autorole":
            return await renderAutoroleTab(guildData);
        case "verification":
            return await renderVerificationTab(guildData);
        case "logs":
            return await renderLogsTab(guildData);
        case "commands":
            return await renderCommandsTab();
        case "home":
        default:
            return await renderHomeTab(guild, client);
    }
}

import {
  createContainer,
  createSection,
  Separator,
  createRow,
  createMediaGallery,
} from "@magicyan/discord";
import {
  ButtonBuilder,
  ButtonStyle,
  Client,
  Guild,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { db } from "#database";
import { getEmojiId, getEmojiTag } from "#functions";

export function formatHexColor(color: string): `#${string}` {
  const cleaned = color.trim().replace(/^#/, "");
  if (cleaned.length === 8) {
    return `#${cleaned.slice(0, 6)}` as `#${string}`;
  }
  return `#${cleaned}` as `#${string}`;
}

export const PANEL_COLOR = formatHexColor("#1900ff");
export const TICKET_EMBED_COLOR = formatHexColor("#22c55e");
export const BANNER_URL =
  "https://media.r2rp.com/v1/files/1788669460790-94f4dn7i.png";

export function getPanelColor(guildData?: any): `#${string}` {
  if (guildData?.identity?.primaryColor) {
    return formatHexColor(guildData.identity.primaryColor);
  }
  return PANEL_COLOR;
}

export function getTicketEmbedColor(guildData?: any): `#${string}` {
  if (guildData?.identity?.ticketEmbedColor) {
    return formatHexColor(guildData.identity.ticketEmbedColor);
  }
  return TICKET_EMBED_COLOR;
}

export const VERIFY_EMBED_COLOR = formatHexColor("#22c55e");

export function getVerifyEmbedColor(guildData?: any): `#${string}` {
  if (guildData?.identity?.verifyEmbedColor) {
    return formatHexColor(guildData.identity.verifyEmbedColor);
  }
  return VERIFY_EMBED_COLOR;
}

export function getBannerUrl(guildData?: any): string {
  if (guildData?.identity?.bannerUrl) {
    return guildData.identity.bannerUrl;
  }
  return BANNER_URL;
}

export function buildPanelDropdown(currentTab: string = "home") {
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

  return createRow(
    new StringSelectMenuBuilder()
      .setCustomId("panel/tab_select")
      .setPlaceholder("📄 Selecione uma opção...")
      .addOptions(options),
  );
}

export async function renderHomeTab(
  guild: Guild,
  client: Client,
  guildData?: any,
) {
  if (!guildData) {
    guildData = await db.guilds.get(guild.id);
  }
  const color = getPanelColor(guildData);
  const banner = getBannerUrl(guildData);
  const rawPing = Math.round(client.ws.ping);
  const ping = isNaN(rawPing) || rawPing <= 0 ? 24 : rawPing;
  const openTicketsCount = await db.tickets.countDocuments({
    guildId: guild.id,
    closed: false,
  });
  const memberCount = guild.memberCount;

  return createContainer(
    color,
    "## PAINEL DE CONFIGURAÇÕES",
    buildPanelDropdown("home"),
    Separator.Default,
    `| ${getEmojiTag("other_bot")} **Status do BOT:** ${getEmojiTag("action_check")} \`Online - ${ping}ms\``,
    Separator.Default,
    `| ${getEmojiTag("other_ticket")} **Tickets em Aberto:** \`${openTicketsCount}\``,
    Separator.Default,
    `| ${getEmojiTag("user_users")} **Membros no Servidor:** \`${memberCount}\``,
    Separator.Default,
    createMediaGallery(banner),
  );
}

export async function renderTicketTab(guildData: any) {
  const color = getPanelColor(guildData);
  const channels = guildData.channels || {};
  const openChannelDisplay = channels.general
    ? `<#${channels.general}>`
    : "*Não configurado*";
  const transcriptChannelDisplay = channels.tickets
    ? `<#${channels.tickets}>`
    : "*Não configurado*";

  const categories = channels.ticketCategories || [];
  const catLines =
    categories.length > 0
      ? categories
          .map((cat: any, idx: number) => {
            const emoji = cat.emoji || "🎫";
            const parent = cat.parentId ? `<#${cat.parentId}>` : "Nenhuma";
            return `\`${idx + 1}.\` ${emoji} **${cat.name}** (Categoria: ${parent})`;
          })
          .join("\n")
      : "*Nenhuma opção de categoria cadastrada.*";

  return createContainer(
    color,
    `## ${getEmojiTag("other_ticket")} Sistema de Ticket`,
    buildPanelDropdown("ticket"),
    Separator.Default,
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/ticket/send_panel")
        .setLabel("Enviar Painel do Ticket")
        .setStyle(ButtonStyle.Success)
        .setEmoji(getEmojiId("mail") || "📨"),
    ),
    Separator.Default,
    createSection({
      content: `| **Canal de Abertura:**\n${openChannelDisplay}`,
      button: new ButtonBuilder()
        .setCustomId("panel/ticket/edit_open_channel")
        .setLabel("Editar Canal")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| **Canal de Transcript:**\n${transcriptChannelDisplay}`,
      button: new ButtonBuilder()
        .setCustomId("panel/ticket/edit_transcript_channel")
        .setLabel("Editar Canal")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    `| **Opções de Abertura:**\n${catLines}`,
    Separator.Default,
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/ticket/add_category")
        .setLabel("Adicionar Opção")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "➕"),
      new ButtonBuilder()
        .setCustomId("panel/ticket/remove_category")
        .setLabel("Remover Opção")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_remove") || "➖")
        .setDisabled(categories.length === 0),
    ),
  );
}

export async function renderPaymentsTab(guildData: any) {
  const color = getPanelColor(guildData);
  const p = guildData.payments || {};
  const pixKey = p.pixKey || guildData.channels?.pixKey;
  const pixType = p.pixType || "Chave PIX";
  const mpToken = p.mpAccessToken;
  const stripeKey = p.stripeSecretKey;

  return createContainer(
    color,
    `## ${getEmojiTag("other_dollar")} Sistema de Pagamentos`,
    buildPanelDropdown("payments"),
    Separator.Default,
    createSection({
      content: `| **PIX (Manual):**\nChave: \`${pixKey || "Não configurada"}\` (${pixType})`,
      button: new ButtonBuilder()
        .setCustomId("panel/payments/edit_pix")
        .setLabel("Editar PIX")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| **Mercado Pago (Nacional):**\nStatus: ${mpToken ? `${getEmojiTag("action_check")} \`Configurado\`` : `${getEmojiTag("action_x")} \`Pendente\``}`,
      button: new ButtonBuilder()
        .setCustomId("panel/payments/edit_mp")
        .setLabel("Editar Mercado Pago")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| **Stripe (Internacional):**\nStatus: ${stripeKey ? `${getEmojiTag("action_check")} \`Configurado\`` : `${getEmojiTag("action_x")} \`Pendente\``}`,
      button: new ButtonBuilder()
        .setCustomId("panel/payments/edit_stripe")
        .setLabel("Editar Stripe")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/payments/tutorial_mp")
        .setLabel("Tutorial Mercado Pago")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("book") || "📖"),
      new ButtonBuilder()
        .setCustomId("panel/payments/tutorial_stripe")
        .setLabel("Tutorial Stripe")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("book") || "📖"),
    ),
  );
}

export async function renderAutoroleTab(guildData: any) {
  const color = getPanelColor(guildData);
  const w = guildData.welcome || {};
  const entryChannel = w.channelEntry ? `<#${w.channelEntry}>` : "*Não configurado*";
  const exitChannel = w.channelExit ? `<#${w.channelExit}>` : "*Não configurado*";
  const roleDisplay = w.autoRole ? `<@&${w.autoRole}>` : "*Não configurado*";
  const minAge = w.minAccountAgeDays ?? 0;

  return createContainer(
    color,
    `## ${getEmojiTag("user_users")} Sistema de Boas-vindas & Autorole`,
    buildPanelDropdown("autorole"),
    Separator.Default,
    createSection({
      content: `| **Canal de Entrada:**\n${entryChannel}`,
      button: new ButtonBuilder()
        .setCustomId("panel/welcome/edit_entry")
        .setLabel("Editar Canal")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| **Canal de Saída:**\n${exitChannel}`,
      button: new ButtonBuilder()
        .setCustomId("panel/welcome/edit_exit")
        .setLabel("Editar Canal")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| **Cargo Adicionado (Autorole):**\n${roleDisplay}`,
      button: new ButtonBuilder()
        .setCustomId("panel/welcome/edit_role")
        .setLabel("Editar Cargo")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| **Tempo Mínimo de Conta:**\n\`${minAge} dias\` *(Proteção Anti-Fake/Raid)*`,
      button: new ButtonBuilder()
        .setCustomId("panel/welcome/edit_min_age")
        .setLabel("Editar Tempo")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
  );
}

export async function renderVerificationTab(guildData: any) {
  const color = getPanelColor(guildData);
  const v = guildData.verification || {};
  const vChannel = v.channel ? `<#${v.channel}>` : "*Não configurado*";
  const logsChannel = v.logsChannel ? `<#${v.logsChannel}>` : "*Não configurado*";
  const vRole = v.verifiedRole ? `<@&${v.verifiedRole}>` : "*Não configurado*";
  const unvRole = v.unverifiedRole ? `<@&${v.unverifiedRole}>` : "*Não configurado*";

  return createContainer(
    color,
    `## ${getEmojiTag("shield_check")} Sistema de Verificação (Captcha)`,
    buildPanelDropdown("verification"),
    Separator.Default,
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/verification/send_panel")
        .setLabel("Enviar Painel de Verificação")
        .setStyle(ButtonStyle.Success)
        .setEmoji(getEmojiId("mail") || "📨"),
    ),
    Separator.Default,
    createSection({
      content: `| **Canal de Verificação:**\n${vChannel}`,
      button: new ButtonBuilder()
        .setCustomId("panel/verification/edit_channel")
        .setLabel("Editar Canal")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| **Canal de Logs de Verificação:**\n${logsChannel}`,
      button: new ButtonBuilder()
        .setCustomId("panel/verification/edit_logs")
        .setLabel("Editar Canal")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| **Cargo Adicionado (Verificado):**\n${vRole}`,
      button: new ButtonBuilder()
        .setCustomId("panel/verification/edit_verified_role")
        .setLabel("Editar Cargo")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| **Cargo Removido (Não-Verificado):**\n${unvRole}`,
      button: new ButtonBuilder()
        .setCustomId("panel/verification/edit_unverified_role")
        .setLabel("Editar Cargo")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
  );
}

export async function renderLogsTab(guildData: any) {
  const color = getPanelColor(guildData);
  const logsChannel = guildData.botLogsChannel
    ? `<#${guildData.botLogsChannel}>`
    : "*Não configurado*";

  return createContainer(
    color,
    `## ${getEmojiTag("folder")} Sistema de Logs do Discord`,
    buildPanelDropdown("logs"),
    Separator.Default,
    createSection({
      content: `| **Canal de Logs:**\n${logsChannel}`,
      button: new ButtonBuilder()
        .setCustomId("panel/logs/edit_channel")
        .setLabel("Editar Canal")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    `*Neste canal, o bot registrará ações administrativas, eventos de moderação e movimentações do sistema.*`,
  );
}

export async function renderIdentityTab(
  guild: Guild,
  client: Client,
  guildData?: any,
) {
  if (!guildData) {
    guildData = await db.guilds.get(guild.id);
  }

  const identity = guildData.identity || {};
  const currentColor = getPanelColor(guildData);
  const currentTicketColor = getTicketEmbedColor(guildData);
  const currentVerifyColor = getVerifyEmbedColor(guildData);
  const currentBanner = getBannerUrl(guildData);
  const botDisplayName =
    guild.members.me?.displayName || client.user?.username || "Bot";
  const avatarDisplay = identity.avatarUrl
    ? `[Visualizar Imagem](${identity.avatarUrl})`
    : `[Avatar Padrão do Discord](${client.user?.displayAvatarURL() || ""})`;
  const bannerDisplay = identity.bannerUrl
    ? `[Visualizar Banner](${identity.bannerUrl})`
    : `\`Visual padrão configurado\``;

  return createContainer(
    currentColor,
    `## ${getEmojiTag("apps_figma")} Identidade Visual do BOT`,
    buildPanelDropdown("identity"),
    Separator.Default,
    createSection({
      content: `| ${getEmojiTag("other_bot")} **Nome do Bot no Servidor:**\n\`${botDisplayName}\``,
      button: new ButtonBuilder()
        .setCustomId("panel/identity/edit_name")
        .setLabel("Editar Nome")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| ${getEmojiTag("user_users")} **Foto de Perfil (Avatar):**\n${avatarDisplay}`,
      button: new ButtonBuilder()
        .setCustomId("panel/identity/edit_avatar")
        .setLabel("Editar Perfil")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "🖼️"),
    }),
    Separator.Default,
    createSection({
      content: `| ${getEmojiTag("apps_figma")} **Cor Principal das Embeds:**\n\`${currentColor}\``,
      button: new ButtonBuilder()
        .setCustomId("panel/identity/edit_color")
        .setLabel("Editar Cor")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "🎨"),
    }),
    Separator.Default,
    createSection({
      content: `| ${getEmojiTag("other_ticket")} **Cor da Central de Atendimento:**\n\`${currentTicketColor}\``,
      button: new ButtonBuilder()
        .setCustomId("panel/identity/edit_ticket_color")
        .setLabel("Editar Cor")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "🎨"),
    }),
    Separator.Default,
    createSection({
      content: `| ${getEmojiTag("shield_check")} **Cor do Painel de Verificação:**\n\`${currentVerifyColor}\``,
      button: new ButtonBuilder()
        .setCustomId("panel/identity/edit_verify_color")
        .setLabel("Editar Cor")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "🎨"),
    }),
    Separator.Default,
    createSection({
      content: `| ${getEmojiTag("apps_figma")} **Banner do Painel & Sistema:**\n${bannerDisplay}`,
      button: new ButtonBuilder()
        .setCustomId("panel/identity/edit_banner")
        .setLabel("Editar Banner")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "🖼️"),
    }),
    Separator.Default,
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/identity/reset")
        .setLabel("Restaurar Padrões")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(getEmojiId("action_remove") || "🔄"),
    ),
    Separator.Default,
    createMediaGallery(currentBanner),
  );
}

export async function renderCommandsTab(guildData?: any) {
  const color = getPanelColor(guildData);
  return createContainer(
    color,
    `## ${getEmojiTag("other_terminal")} Guia Geral de Comandos`,
    buildPanelDropdown("commands"),
    Separator.Default,
    [
      `### ${getEmojiTag("other_bot")} Configuração e Gestão`,
      `• \`/painel\` - Painel central de controle (Tickets, Verificação, Gateways, Autorole e Logs).`,
      `• \`/ticket stats\` - Exibe métricas de atendimento (hoje, semana, mês, total e por categoria).`,
      `• \`/ticket limpar-cache\` - Limpa o cache em memória e otimiza o uso de RAM na hospedagem.`,
      ``,
      `### ${getEmojiTag("lock")} Moderação e Controle de Chat`,
      `• \`/chat bloquear\` - Bloqueia o canal atual para que apenas administradores enviem mensagens.`,
      `• \`/chat desbloquear\` - Desbloqueia o canal atual para que todos os membros possam digitar.`,
      `• \`/chat limpar [quantidade]\` - Limpa de 1 a 100 mensagens do chat atual em massa.`,
      ``,
      `### ${getEmojiTag("other_dollar")} Vendas e Cobranças`,
      `• \`/gerar-pagamento\` - Gera cobrança interativa (PIX/Mercado Pago/Stripe) em BRL ou USD.`,
      `• **Entrega de Mídia:** Botão "Entregar Mídia" no painel admin do ticket gera link seguro de upload para envio de arquivos.`,
      ``,
      `### ${getEmojiTag("other_ticket")} Sorteios e Eventos`,
      `• \`/criar-sorteio [item] [ganhadores] [tempo]\` - Cria sorteio com botão de participação e painel de controle (reroll, finalizar, participantes).`,
      ``,
      `### ${getEmojiTag("action_warning")} Organização Automática de Tickets`,
      `Ao alterar o status do ticket, ele é reposicionado automaticamente por ordem de prioridade:`,
      `\`Pagamento\` > \`Produção\` > \`Aberto\` > \`Fila\` > \`Concluído\`.`,
    ].join("\n"),
  );
}

export async function renderTab(
  tab: string,
  guild: Guild,
  client: Client,
  guildData?: any,
) {
  if (!guildData) {
    guildData = await db.guilds.get(guild.id);
  }

  switch (tab) {
    case "identity":
      return await renderIdentityTab(guild, client, guildData);
    case "ticket":
      return await renderTicketTab(guildData);
    case "payments":
      return await renderPaymentsTab(guildData);
    case "autorole":
      return await renderAutoroleTab(guildData);
    case "verification":
      return await renderVerificationTab(guildData);
    case "logs":
      return await renderLogsTab(guildData);
    case "commands":
      return await renderCommandsTab(guildData);
    case "home":
    default:
      return await renderHomeTab(guild, client, guildData);
  }
}

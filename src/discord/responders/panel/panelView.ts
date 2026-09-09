import {
  createContainer,
  createSection,
  Separator,
  createRow,
  createMediaGallery,
} from "@magicyan/discord";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  Client,
  Guild,
  RoleSelectMenuBuilder,
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

export const PANEL_COLOR = formatHexColor("#38bdf8");
export const TICKET_EMBED_COLOR = formatHexColor("#38bdf8");
export const BANNER_URL = "";

export function getPanelColor(guildData?: any): `#${string}` {
  if (guildData?.identity?.primaryColor) {
    return formatHexColor(guildData.identity.primaryColor);
  }
  return PANEL_COLOR;
}

export function getTicketEmbedColor(guildData?: any): `#${string}` {
  return getPanelColor(guildData);
}

export function getVerifyEmbedColor(guildData?: any): `#${string}` {
  return getPanelColor(guildData);
}

export function getBannerUrl(guildData?: any): string | null {
  if (!guildData?.identity?.bannerEnabled) {
    return null;
  }
  if (guildData?.identity?.bannerUrl) {
    const trimmed = String(guildData.identity.bannerUrl).trim();
    if (["none", "desativado", "remover", "disabled", "null", "padrao", "default"].includes(trimmed.toLowerCase())) {
      return null;
    }
    if (trimmed.includes("1788669460790-94f4dn7i") || trimmed.toLowerCase().includes("dusk")) {
      return null;
    }
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
  }
  return null;
}

export function buildPanelDesignVisualSection(
  systemKey: string,
  systemName: string,
  hasCustomJson: boolean,
) {
  const statusDisplay = hasCustomJson
    ? `${getEmojiTag("action_check")} **Personalizado via JSON**`
    : `${getEmojiTag("action_info")} **Padrão do Sistema**`;

  return [
    `| **Design Visual do Painel de ${systemName}:**\n${statusDisplay}`,
    createRow(
      new ButtonBuilder()
        .setCustomId(`panel/${systemKey}/custom_json/open`)
        .setLabel("Personalizar Painel (JSON)")
        .setEmoji(getEmojiId("action_add") || "⚙️")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`panel/${systemKey}/custom_json/reset`)
        .setLabel("Resetar Padrão")
        .setEmoji(getEmojiId("action_remove") || "🗑️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasCustomJson),
    ),
  ];
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
      .setEmoji(getEmojiId("prism") || getEmojiId("other_ticket") || "📁")
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
      .setValue("antiflood")
      .setLabel("Anti-Flood Staff")
      .setDescription("Proteção contra menções excessivas à equipe")
      .setEmoji(getEmojiId("shield") || "🛡️")
      .setDefault(currentTab === "antiflood"),
    new StringSelectMenuOptionBuilder()
      .setValue("anuncios")
      .setLabel("Anúncios")
      .setDescription("Comunicados oficiais em canal e disparo por DM")
      .setEmoji(getEmojiId("prism") || "📢")
      .setDefault(currentTab === "anuncios"),
    new StringSelectMenuOptionBuilder()
      .setValue("json")
      .setLabel("Painel JSON")
      .setDescription("Personalize o visual de painéis via código ou arquivo JSON")
      .setEmoji(getEmojiId("other_save") || "📄")
      .setDefault(currentTab === "json"),
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
  const rawPing = Math.round(client.ws.ping);
  const ping = isNaN(rawPing) || rawPing <= 0 ? 24 : rawPing;
  const openTicketsCount = await db.tickets.countDocuments({
    guildId: guild.id,
    closed: false,
  });
  const memberCount = guild.memberCount;

  const botAvatar =
    guildData.identity?.avatarUrl ||
    client.user?.displayAvatarURL() ||
    emojis.static.prism ||
    emojis.static.other_bot;

  const items: any[] = [
    createSection({
      content: `## ${getEmojiTag("prism")} PAINEL DE CONTROLE • ${brand.brandName}\nGerencie tickets, moderação, gateways e identidades com facilidade.`,
      thumbnail: botAvatar as any,
    }),
    buildPanelDropdown("home"),
    Separator.Default,
    `| ${getEmojiTag("prism")} **Status do BOT (${brand.brandName}):** ${getEmojiTag("action_check")} \`Online - ${ping}ms\``,
    Separator.Default,
    `| ${getEmojiTag("prism")} **Tickets em Aberto:** \`${openTicketsCount}\``,
    Separator.Default,
    `| ${getEmojiTag("user_users")} **Membros no Servidor:** \`${memberCount}\``,
  ];

  return (createContainer as any)(color, ...items);
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
  const vaultChannelDisplay = channels.vault
    ? `<#${channels.vault}>`
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
    `## ${getEmojiTag("prism") || getEmojiTag("other_ticket")} Sistema de Ticket`,
    buildPanelDropdown("ticket"),
    Separator.Default,
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/ticket/send_panel")
        .setLabel("Enviar Painel do Ticket")
        .setStyle(ButtonStyle.Primary)
        .setEmoji(getEmojiId("prism") || getEmojiId("mail") || "📨"),
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
    Separator.Default,
    createSection({
      content: `| **Canal do Cofre (Backup de Imagens):**\n${vaultChannelDisplay}`,
      button: new ButtonBuilder()
        .setCustomId("panel/ticket/edit_vault_channel")
        .setLabel("Editar Canal")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "✏️"),
    }),
    Separator.Default,
    createSection({
      content: `| ${getEmojiTag("apps_figma")} **Barrinha / Banner:** ${getBannerUrl(guildData) ? `${getEmojiTag("action_check")} Ativada ([Ver Imagem](${getBannerUrl(guildData)}))` : `${getEmojiTag("action_x")} Desativada (Opcional)`}`,
      button: new ButtonBuilder()
        .setCustomId("panel/identity/toggle_banner")
        .setLabel(getBannerUrl(guildData) ? "Desativar Barrinha" : "Ativar Barrinha")
        .setStyle(getBannerUrl(guildData) ? ButtonStyle.Danger : ButtonStyle.Primary)
        .setEmoji(getBannerUrl(guildData) ? (getEmojiId("action_remove") || "🔴") : (getEmojiId("action_check") || "🔵")),
    }),
    Separator.Default,
    ...buildPanelDesignVisualSection("ticket", "Tickets", !!guildData?.customPanels?.ticket),
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
  const pixName = p.pixName;
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
      content: `| **PIX (Manual):**\nNome: \`${pixName || "Não configurado"}\`\nChave: \`${pixKey || "Não configurada"}\` (${pixType})`,
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
        .setStyle(ButtonStyle.Primary)
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
    Separator.Default,
    ...buildPanelDesignVisualSection("verification", "Verificação", !!guildData?.customPanels?.verification),
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
  const currentBanner = getBannerUrl(guildData);
  const isBannerEnabled = currentBanner !== null;
  const avatarDisplay = identity.avatarUrl
    ? `[Visualizar Imagem](${identity.avatarUrl})`
    : `[Foto Padrão do Discord](${client.user?.displayAvatarURL() || ""})`;
  const bannerDisplay = isBannerEnabled
    ? `${getEmojiTag("action_check")} **Ativada (Personalizada)**\n[Visualizar Barrinha](${currentBanner})`
    : `${getEmojiTag("action_x")} **Desativada** *(Sem barrinha nos painéis)*`;

  const botAvatar =
    identity.avatarUrl ||
    client.user?.displayAvatarURL() ||
    emojis.static.prism ||
    emojis.static.other_bot;

  const items: any[] = [
    createSection({
      content: `## ${getEmojiTag("prism")} Identidade Visual do BOT • ${brand.brandName}\nPersonalize a foto de perfil, cores e a barrinha/banner dos painéis.`,
      thumbnail: botAvatar as any,
    }),
    buildPanelDropdown("identity"),
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
      content: `| ${getEmojiTag("apps_figma")} **Barrinha / Banner:**\n${bannerDisplay}`,
      button: new ButtonBuilder()
        .setCustomId("panel/identity/edit_banner")
        .setLabel("Editar Link")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "🖼️"),
    }),
    createSection({
      content: `| ${getEmojiTag("action_info")} **Exibição da Barrinha:** Atualmente ${isBannerEnabled ? "visível nos painéis" : "desativada (opcional)"}.`,
      button: new ButtonBuilder()
        .setCustomId("panel/identity/toggle_banner")
        .setLabel(isBannerEnabled ? "Desativar Barrinha" : "Ativar Barrinha")
        .setStyle(isBannerEnabled ? ButtonStyle.Danger : ButtonStyle.Primary)
        .setEmoji(isBannerEnabled ? (getEmojiId("action_remove") || "🔴") : (getEmojiId("action_check") || "🔵")),
    }),
    Separator.Default,
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/identity/reset")
        .setLabel("Restaurar Padrões")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(getEmojiId("action_remove") || "🔄"),
    ),
  ];

  if (currentBanner) {
    items.push(Separator.Default, createMediaGallery(currentBanner));
  }

  return (createContainer as any)(currentColor, ...items);
}

export async function renderCommandsTab(guildData?: any) {
  const color = getPanelColor(guildData);
  return createContainer(
    color,
    `## ${getEmojiTag("other_terminal")} Guia Geral de Comandos`,
    buildPanelDropdown("commands"),
    Separator.Default,
    [
      `### ${getEmojiTag("prism")} Configuração e Gestão (${brand.brandName})`,
      `• \`/painel\` - Painel central de controle (Tickets, Anúncios, Verificação, Gateways, Autorole e Logs).`,
      `• \`/anunciar\` - Abre o formulário interativo de comunicado oficial (envio em canal e/ou disparo por DM).`,
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
      `### ${getEmojiTag("prism")} Sorteios e Eventos`,
      `• \`/criar-sorteio [item] [ganhadores] [tempo]\` - Cria sorteio com botão de participação e painel de controle (reroll, finalizar, participantes).`,
      ``,
      `### ${getEmojiTag("action_warning")} Organização Automática de Tickets`,
      `Ao alterar o status do ticket, ele é reposicionado automaticamente por ordem de prioridade:`,
      `\`Pagamento\` > \`Produção\` > \`Aberto\` > \`Fila\` > \`Concluído\`.`,
    ].join("\n"),
  );
}

export async function renderAntifloodTab(guildData: any) {
  const color = getPanelColor(guildData);
  const af = guildData.antiflood || {};
  const isEnabled = Boolean(af.enabled);
  const maxMentions = af.maxMentions ?? 3;
  const windowSeconds = af.windowSeconds ?? 10;
  const timeoutMinutes = af.timeoutMinutes ?? 5;
  const staffRole = guildData.channels?.staffRole
    ? `<@&${guildData.channels.staffRole}>`
    : "*Não configurado (protege administradores)*";

  const statusTag = isEnabled
    ? `${getEmojiTag("action_check")} **ATIVADO** (Proteção ativa)`
    : `${getEmojiTag("action_x")} **DESATIVADO**`;

  return createContainer(
    color,
    `## ${getEmojiTag("shield")} Sistema Anti-Flood da Equipe`,
    buildPanelDropdown("antiflood"),
    Separator.Default,
    createSection({
      content: `| **Status do Sistema:**\n${statusTag}\n*Aplica castigo (timeout) caso membros fiquem marcando a staff repetidamente.*`,
      button: new ButtonBuilder()
        .setCustomId("panel/antiflood/toggle")
        .setLabel(isEnabled ? "Desativar Proteção" : "Ativar Proteção")
        .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Primary)
        .setEmoji(isEnabled ? (getEmojiId("action_remove") || "🔴") : (getEmojiId("action_check") || "🔵")),
    }),
    Separator.Default,
    createSection({
      content: [
        `| **Sensibilidade:** Máximo de \`${maxMentions} menções\` em \`${windowSeconds} segundos\``,
        `| **Punição:** Timeout de \`${timeoutMinutes} minutos\` no servidor`,
        `| **Alvo Monitorado:** ${staffRole}`,
      ].join("\n"),
      button: new ButtonBuilder()
        .setCustomId("panel/antiflood/edit")
        .setLabel("Configurar Parâmetros")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "⚙️"),
    }),
    Separator.Default,
    `*💡 Dica: Membros com permissão de Administrador ou com o cargo da equipe são imunes à punição.*`,
  );
}

export function renderAnunciosTab(guildData: any) {
  const color = getPanelColor(guildData);
  const targetChannel = guildData?.announcements?.channelId
    ? `<#${guildData.announcements.channelId}>`
    : `${getEmojiTag("action_info")} *Não configurado (usa canal atual)*`;
  const dmRoles = guildData?.announcements?.dmRoleIds?.length
    ? guildData.announcements.dmRoleIds
        .map((id: string) => `<@&${id}>`)
        .join(", ")
    : `${getEmojiTag("action_x")} *Não configurado*`;

  const banner = getBannerUrl(guildData);
  const bannerStatus = banner
    ? `${getEmojiTag("action_check")} Ativada ([Ver Imagem](${banner}))`
    : `${getEmojiTag("action_x")} Desativada (Opcional)`;

  return (createContainer as any)(
    color,
    `## ${getEmojiTag("prism")} Sistema de Disparo de Anúncios & Comunicados`,
    buildPanelDropdown("anuncios"),
    Separator.Default,
    `> ${getEmojiTag("prism")} **Canal Padrão:** ${targetChannel}\n` +
      `> ${getEmojiTag("user_check")} **Cargos da DM:** ${dmRoles}\n` +
      `> ${getEmojiTag("apps_figma")} **Barrinha dos Comunicados:** ${bannerStatus}\n\n` +
      `● **Anúncio em Canal:** Publica um comunicado oficial formatado com a identidade **${brand.brandName}**, anexos e menção @everyone opcional.\n\n` +
      `● **Anúncio na DM:** Dispara individualmente para a DM de todos os membros dos cargos selecionados com proteção contra rate-limit e limpeza de memória.`,
    Separator.Default,
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("panel/anuncios/select_channel")
        .setPlaceholder("Canal padrão para envio de comunicados...")
        .setChannelTypes(ChannelType.GuildText),
    ),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId("panel/anuncios/select_role")
        .setPlaceholder("Cargos dos membros que receberão comunicados na DM...")
        .setMinValues(1)
        .setMaxValues(25),
    ),
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/anuncios/modal_canal")
        .setLabel("Enviar Anúncio em Canal")
        .setEmoji(getEmojiId("prism") || "📢")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel/anuncios/modal_dm")
        .setLabel("Disparar Anúncio na DM")
        .setEmoji(getEmojiId("user") || "👤")
        .setStyle(ButtonStyle.Primary),
    ),
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/anuncios/json_canal")
        .setLabel("Anúncio em Canal (JSON)")
        .setEmoji(getEmojiId("other_terminal") || "📄")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("panel/anuncios/json_dm")
        .setLabel("Anúncio na DM (JSON)")
        .setEmoji(getEmojiId("other_terminal") || "📄")
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

export function renderJsonTab(guildData: any) {
  const color = getPanelColor(guildData);
  const ticketCustom = Boolean(guildData?.customPanels?.ticket);
  const verifyCustom = Boolean(guildData?.customPanels?.verification);

  const ticketStatus = ticketCustom
    ? `${getEmojiTag("action_check")} **Personalizado via JSON**`
    : `${getEmojiTag("action_info")} **Padrão do Sistema**`;

  const verifyStatus = verifyCustom
    ? `${getEmojiTag("action_check")} **Personalizado via JSON**`
    : `${getEmojiTag("action_info")} **Padrão do Sistema**`;

  return createContainer(
    color,
    `## ${getEmojiTag("other_save")} Central de Personalização JSON`,
    buildPanelDropdown("json"),
    Separator.Default,
    `> Personalize o layout visual dos painéis enviados nos canais utilizando código JSON exportado de sites como **embed.insidebots.com.br**, Discohook ou **Components V2**.\n> Os botões oficiais de ação (**Abrir Ticket**, **Verificar-se**, etc.) são preservados automaticamente!`,
    Separator.Default,
    `### ${getEmojiTag("prism") || getEmojiTag("other_ticket")} Painel de Tickets (Atendimento)\n| **Status:** ${ticketStatus}\n*Ao enviar o painel no canal, o layout JSON configurado será enviado junto com o botão oficial "Abrir Ticket".*`,
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/ticket/custom_json/open")
        .setLabel("Personalizar Tickets (JSON)")
        .setEmoji(getEmojiId("action_add") || "⚙️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel/ticket/custom_json/reset")
        .setLabel("Resetar Padrão")
        .setEmoji(getEmojiId("action_remove") || "🗑️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!ticketCustom),
    ),
    Separator.Default,
    `### ${getEmojiTag("shield_check")} Painel de Verificação (Captcha)\n| **Status:** ${verifyStatus}\n*Ao enviar o painel no canal, o layout JSON configurado será enviado junto com os botões oficiais de verificação.*`,
    createRow(
      new ButtonBuilder()
        .setCustomId("panel/verification/custom_json/open")
        .setLabel("Personalizar Verificação (JSON)")
        .setEmoji(getEmojiId("action_add") || "⚙️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel/verification/custom_json/reset")
        .setLabel("Resetar Padrão")
        .setEmoji(getEmojiId("action_remove") || "🗑️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!verifyCustom),
    ),
    Separator.Default,
    `### ${getEmojiTag("prism")} Anúncios & Comunicados\n*Você também pode enviar comunicados oficiais em canal ou DM formatados via JSON direto na aba **Anúncios**.*`,
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
    case "antiflood":
      return await renderAntifloodTab(guildData);
    case "anuncios":
      return renderAnunciosTab(guildData);
    case "json":
      return renderJsonTab(guildData);
    case "commands":
      return await renderCommandsTab(guildData);
    case "home":
      default:
        return await renderHomeTab(guild, client, guildData);
  }
}

import { createCommand, createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  Client,
  LabelBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  createContainer,
  createRow,
  createSection,
  Separator,
} from "@magicyan/discord";
import { db } from "#database";
import { getEmojiId, getEmojiTag } from "#functions";
import { getPanelColor } from "../../responders/panel/panelView.js";

/**
 * Utilitário para mascarar credenciais sensíveis no Discord.
 */
function maskSecret(val?: string, keepStart = 4, keepEnd = 4): string {
  if (!val || val.trim().length === 0) return "*Não configurado (usa da loja)*";
  const str = val.trim();
  if (str.length <= keepStart + keepEnd) {
    return `${str.slice(0, 2)}****${str.slice(-2)}`;
  }
  return `${str.slice(0, keepStart)}••••••••${str.slice(-keepEnd)}`;
}

/**
 * Constrói a interface moderna do painel de pagamentos individuais.
 */
export async function renderMyPaymentContainer(
  userId: string,
  guildId: string,
  client: Client,
) {
  const memberDoc = await db.members.get({
    id: userId,
    guild: { id: guildId },
  });
  const guildData = await db.guilds.get(guildId);

  const p = memberDoc.payments || {};
  const guildP = guildData.payments || {};
  const color = getPanelColor(guildData);

  const hasIndividualPix = Boolean(p.pixKey);
  const hasIndividualMp = Boolean(p.mpAccessToken);
  const hasIndividualStripe = Boolean(p.stripeSecretKey);

  const pixDisplay = hasIndividualPix
    ? `**${p.pixName || "Sem nome"}** • \`${maskSecret(p.pixKey, 3, 3)}\` *(${p.pixType || "PIX"})* ${getEmojiTag("action_check")} *Chave Própria*`
    : guildP.pixKey
      ? `\`${maskSecret(guildP.pixKey, 3, 3)}\` • ${getEmojiTag("action_info")} *Padrão da Loja*`
      : `\`Não configurada\` • ${getEmojiTag("action_x")} *Nenhuma chave ativa*`;

  const mpDisplay = hasIndividualMp
    ? `\`${maskSecret(p.mpAccessToken, 8, 4)}\` • ${getEmojiTag("action_check")} **Conta Própria**`
    : guildP.mpAccessToken
      ? `\`${maskSecret(guildP.mpAccessToken, 8, 4)}\` • ${getEmojiTag("action_info")} *Padrão da Loja*`
      : `\`Não configurado\` • ${getEmojiTag("action_x")} *Nenhum token ativo*`;

  const stripeDisplay = hasIndividualStripe
    ? `\`${maskSecret(p.stripeSecretKey, 7, 4)}\` • ${getEmojiTag("action_check")} **Conta Própria**`
    : guildP.stripeSecretKey
      ? `\`${maskSecret(guildP.stripeSecretKey, 7, 4)}\` • ${getEmojiTag("action_info")} *Padrão da Loja*`
      : `\`Não configurada\` • ${getEmojiTag("action_x")} *Nenhuma chave ativa*`;

  const container = createContainer(
    color,
    createSection({
      content: `## ${getEmojiTag("other_dollar")} Minhas Chaves de Pagamento\nConfigure suas credenciais individuais para receber vendas e pagamentos diretamente na sua conta ao gerar cobranças.`,
      thumbnail: client.user?.displayAvatarURL() as any,
    }),
    Separator.Default,
    createSection({
      content: `### ${getEmojiTag("other_dollar")} Chave PIX Individual\n${pixDisplay}`,
      button: new ButtonBuilder()
        .setCustomId("my_payment/edit_pix")
        .setLabel(hasIndividualPix ? "Editar PIX" : "Adicionar PIX")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "🟢"),
    }),
    Separator.Default,
    createSection({
      content: `### ${getEmojiTag("other_card")} Mercado Pago (Access Token Individual)\n${mpDisplay}`,
      button: new ButtonBuilder()
        .setCustomId("my_payment/edit_mp")
        .setLabel(hasIndividualMp ? "Editar MP" : "Adicionar MP")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "💳"),
    }),
    Separator.Default,
    createSection({
      content: `### ${getEmojiTag("other_wallet")} Stripe (Secret Key Individual)\n${stripeDisplay}`,
      button: new ButtonBuilder()
        .setCustomId("my_payment/edit_stripe")
        .setLabel(hasIndividualStripe ? "Editar Stripe" : "Adicionar Stripe")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("action_add") || "🌍"),
    }),
    Separator.Default,
    createRow(
      new ButtonBuilder()
        .setCustomId("my_payment/reset")
        .setLabel("Restaurar Chaves da Loja")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(getEmojiId("action_remove") || "🔄"),
      new ButtonBuilder()
        .setCustomId("my_payment/refresh")
        .setLabel("Atualizar")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmojiId("clock") || "🔄"),
    ),
    Separator.Default,
    `🔒 *Painel Privado: Suas credenciais são protegidas. Ninguém além de você tem acesso a esta tela.*`,
  );

  return container;
}

// ==========================================
// Comando Principal /meu-pagamento
// ==========================================
createCommand({
  name: "meu-pagamento",
  description:
    "💳 Configure suas chaves individuais de pagamento (PIX, Mercado Pago, Stripe).",
  type: ApplicationCommandType.ChatInput,
  async run(interaction) {
    if (!interaction.inCachedGuild()) return;

    const guildData = await db.guilds.get(interaction.guildId);
    const member = interaction.member;

    const isAdm = member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff =
      guildData.channels?.staffRole &&
      member.roles.cache.has(guildData.channels.staffRole);

    if (!isAdm && !isStaff) {
      await interaction.reply({
        content: `${getEmojiTag("action_x")} Apenas membros autorizados da equipe podem configurar chaves de recebimento.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const container = await renderMyPaymentContainer(
      interaction.user.id,
      interaction.guildId,
      interaction.client,
    );

    await interaction.reply({
      components: [container],
      flags: ["Ephemeral", "IsComponentsV2"] as any,
    });
  },
});

// ==========================================
// Responders de Edição
// ==========================================

// 1. Abrir Modal de PIX
createResponder({
  customId: "my_payment/edit_pix",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction) {
    const memberDoc = await db.members.get({
      id: interaction.user.id,
      guild: { id: interaction.guild.id },
    });

    const currentName = memberDoc.payments?.pixName || "";
    const currentKey = memberDoc.payments?.pixKey || "";
    const currentType = memberDoc.payments?.pixType || "Aleatória / E-mail / CPF";

    const modal = new ModalBuilder()
      .setCustomId("my_payment/modal/pix")
      .setTitle("Configurar Chave PIX Pessoal");

    const nameInput = new TextInputBuilder()
      .setCustomId("pix_name")
      .setPlaceholder("Ex: Fulano da Silva (nome do titular da conta)")
      .setValue(currentName)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const keyInput = new TextInputBuilder()
      .setCustomId("pix_key")
      .setPlaceholder("Ex: seuemail@gmail.com ou 123.456.789-00")
      .setValue(currentKey)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const typeInput = new TextInputBuilder()
      .setCustomId("pix_type")
      .setPlaceholder("Ex: CPF, CNPJ, E-mail, Celular, Aleatória")
      .setValue(currentType)
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new LabelBuilder().setLabel("Nome do Recebedor:").setTextInputComponent(nameInput),
      new LabelBuilder().setLabel("Chave PIX:").setTextInputComponent(keyInput),
      new LabelBuilder()
        .setLabel("Tipo da Chave (Opcional):")
        .setTextInputComponent(typeInput),
    );

    await interaction.showModal(modal);
  },
});

// 1.1 Processar Modal de PIX
createResponder({
  customId: "my_payment/modal/pix",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    const rawName = interaction.fields.getTextInputValue("pix_name").trim();
    const rawKey = interaction.fields.getTextInputValue("pix_key").trim();
    const rawType =
      interaction.fields.getTextInputValue("pix_type")?.trim() || "Chave PIX";

    if (!rawName) {
      await interaction.reply({
        content: `${getEmojiTag("action_x")} O nome do recebedor não pode ser vazio!`,
        flags: ["Ephemeral"],
      });
      return;
    }

    if (!rawKey) {
      await interaction.reply({
        content: `${getEmojiTag("action_x")} A chave PIX não pode ser vazia!`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const memberDoc = await db.members.get({
      id: interaction.user.id,
      guild: { id: interaction.guild.id },
    });

    memberDoc.payments = memberDoc.payments || {};
    memberDoc.payments.pixName = rawName;
    memberDoc.payments.pixKey = rawKey;
    memberDoc.payments.pixType = rawType;
    memberDoc.markModified("payments");
    await memberDoc.save();

    const container = await renderMyPaymentContainer(
      interaction.user.id,
      interaction.guild.id,
      interaction.client,
    );

    if (interaction.isFromMessage?.()) {
      await interaction.update({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    } else {
      await interaction.reply({
        components: [container],
        flags: ["Ephemeral", "IsComponentsV2"] as any,
      });
    }
  },
});

// 2. Abrir Modal de Mercado Pago
createResponder({
  customId: "my_payment/edit_mp",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction) {
    const memberDoc = await db.members.get({
      id: interaction.user.id,
      guild: { id: interaction.guild.id },
    });

    const currentToken = memberDoc.payments?.mpAccessToken || "";

    const modal = new ModalBuilder()
      .setCustomId("my_payment/modal/mp")
      .setTitle("Configurar Mercado Pago Pessoal");

    const tokenInput = new TextInputBuilder()
      .setCustomId("mp_token")
      .setPlaceholder("Cole seu Access Token (APP_USR-...)")
      .setValue(currentToken)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new LabelBuilder()
        .setLabel("Access Token do Mercado Pago:")
        .setTextInputComponent(tokenInput),
    );

    await interaction.showModal(modal);
  },
});

// 2.1 Processar Modal de Mercado Pago
createResponder({
  customId: "my_payment/modal/mp",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    const rawToken = interaction.fields.getTextInputValue("mp_token").trim();

    if (!rawToken || rawToken.length < 10) {
      await interaction.reply({
        content: `${getEmojiTag("action_x")} Access Token do Mercado Pago inválido!`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const memberDoc = await db.members.get({
      id: interaction.user.id,
      guild: { id: interaction.guild.id },
    });

    memberDoc.payments = memberDoc.payments || {};
    memberDoc.payments.mpAccessToken = rawToken;
    memberDoc.markModified("payments");
    await memberDoc.save();

    const container = await renderMyPaymentContainer(
      interaction.user.id,
      interaction.guild.id,
      interaction.client,
    );

    if (interaction.isFromMessage?.()) {
      await interaction.update({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    } else {
      await interaction.reply({
        components: [container],
        flags: ["Ephemeral", "IsComponentsV2"] as any,
      });
    }
  },
});

// 3. Abrir Modal de Stripe
createResponder({
  customId: "my_payment/edit_stripe",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction) {
    const memberDoc = await db.members.get({
      id: interaction.user.id,
      guild: { id: interaction.guild.id },
    });

    const currentKey = memberDoc.payments?.stripeSecretKey || "";

    const modal = new ModalBuilder()
      .setCustomId("my_payment/modal/stripe")
      .setTitle("Configurar Stripe Pessoal");

    const keyInput = new TextInputBuilder()
      .setCustomId("stripe_key")
      .setPlaceholder("Cole sua Secret Key (sk_live_... ou sk_test_...)")
      .setValue(currentKey)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new LabelBuilder()
        .setLabel("Secret Key da Stripe:")
        .setTextInputComponent(keyInput),
    );

    await interaction.showModal(modal);
  },
});

// 3.1 Processar Modal de Stripe
createResponder({
  customId: "my_payment/modal/stripe",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    const rawKey = interaction.fields.getTextInputValue("stripe_key").trim();

    if (!rawKey || (!rawKey.startsWith("sk_live_") && !rawKey.startsWith("sk_test_") && rawKey.length < 15)) {
      await interaction.reply({
        content: `${getEmojiTag("action_x")} Secret Key da Stripe inválida! Deve começar com \`sk_live_\` ou \`sk_test_\`.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const memberDoc = await db.members.get({
      id: interaction.user.id,
      guild: { id: interaction.guild.id },
    });

    memberDoc.payments = memberDoc.payments || {};
    memberDoc.payments.stripeSecretKey = rawKey;
    memberDoc.markModified("payments");
    await memberDoc.save();

    const container = await renderMyPaymentContainer(
      interaction.user.id,
      interaction.guild.id,
      interaction.client,
    );

    if (interaction.isFromMessage?.()) {
      await interaction.update({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    } else {
      await interaction.reply({
        components: [container],
        flags: ["Ephemeral", "IsComponentsV2"] as any,
      });
    }
  },
});

// 4. Restaurar Chaves da Loja (Reset Individual)
createResponder({
  customId: "my_payment/reset",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction) {
    const memberDoc = await db.members.get({
      id: interaction.user.id,
      guild: { id: interaction.guild.id },
    });

    memberDoc.payments = {
      pixName: undefined,
      pixKey: undefined,
      pixType: undefined,
      mpAccessToken: undefined,
      stripeSecretKey: undefined,
    };
    memberDoc.markModified("payments");
    await memberDoc.save();

    const container = await renderMyPaymentContainer(
      interaction.user.id,
      interaction.guild.id,
      interaction.client,
    );

    await interaction.update({
      components: [container],
      flags: ["IsComponentsV2"] as any,
    });
  },
});

// 5. Atualizar Painel
createResponder({
  customId: "my_payment/refresh",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction) {
    const container = await renderMyPaymentContainer(
      interaction.user.id,
      interaction.guild.id,
      interaction.client,
    );

    await interaction.update({
      components: [container],
      flags: ["IsComponentsV2"] as any,
    });
  },
});

import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  createContainer,
  createSection,
  Separator,
  createRow,
  modalFieldsToRecord,
} from "@magicyan/discord";
import {
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { db } from "#database";

export async function createConfigPanel(guildId: string) {
  const guildData = await db.guilds.get(guildId);
  const channels = guildData.channels;

  const logsDisplay = channels?.tickets
    ? `<#${channels.tickets}>`
    : "*Não configurado*";
  const vaultDisplay = channels?.vault
    ? `<#${channels.vault}>`
    : "*Não configurado*";

  const cats = channels?.categories;
  const catDisplay = cats
    ? [
        `<:shield_check:1502789932727668788> **Suporte:** ${cats.suporte ? `<#${cats.suporte}>` : "❌"}`,
        `<:action_x:1502789802918150206> **Denúncia:** ${cats.denuncia ? `<#${cats.denuncia}>` : "❌"}`,
        `<:other_ticket:1502789959378145300> **Financeiro:** ${cats.financeiro ? `<#${cats.financeiro}>` : "❌"}`,
        `<:action_info:1502789798983766016> **Bugs:** ${cats.bugs ? `<#${cats.bugs}>` : "❌"}`,
      ].join("\n")
    : "*Nenhuma categoria base configurada*";

  const customCats = channels?.ticketCategories?.length || 0;

  return createContainer(
    constants.colors.azoxo,
    createSection({
      content:
        "## ⚙️ Painel de Configuração\nSeja bem-vindo ao centro de controle do seu sistema de tickets. Aqui você pode ajustar todos os canais e categorias de forma intuitiva.",
      thumbnail: emojis.static.other_ticket,
    }),
    Separator.Default,
    "### 📡 Canais de Sistema",
    `> <:clock:1502789859960422502> **Logs de Atendimento:** ${logsDisplay}`,
    `> <:folder:1502789880214720533> **Cofre de Mídia (Vault):** ${vaultDisplay}`,
    Separator.Default,
    "### 📂 Categorias Base (Roteamento)",
    catDisplay,
    Separator.Default,
    `### 🎫 Categorias Customizadas\nVocê possui atualmente **${customCats}** categoria(s) customizada(s) configurada(s).`,
    Separator.Default,
    createRow(
      new ButtonBuilder({
        customId: "ticket/config/channels",
        label: "Canais",
        style: ButtonStyle.Secondary,
        emoji: "1502789931808981012",
      }),
      new ButtonBuilder({
        customId: "ticket/config/base_cats",
        label: "Categorias Base",
        style: ButtonStyle.Secondary,
        emoji: "1502789875928400103",
      }),
      new ButtonBuilder({
        customId: "ticket/config/refresh",
        label: "Atualizar",
        style: ButtonStyle.Primary,
        emoji: "1502789797821939752",
      }),
      new ButtonBuilder({
        customId: "ticket/config/guide",
        label: "Guia",
        style: ButtonStyle.Secondary,
        emoji: "1502789798983766016",
      }),
    ),
  );
}

// Responders de Configuração
createResponder({
  customId: "ticket/config/:action",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction, { action }) {
    const { guildId, guild } = interaction;
    if (!guildId || !guild) return;

    if (action === "guide") {
      const guideContainer = createContainer(
        constants.colors.primary,
        createSection({
          content:
            "## 📖 Guia de Configuração\nAprenda a configurar seu sistema de tickets em poucos passos.",
          thumbnail: emojis.static.action_info,
        }),
        Separator.Default,
        "### 1. Canais de Sistema",
        "**Logs:** Onde todas as aberturas, claims e encerramentos serão registrados.\n**Vault:** Canal privado onde o bot salvará imagens de transcripts para garantir que nunca expirem.",
        Separator.Default,
        "### 2. Categorias Base (Roteamento)",
        "Insira o **ID da Categoria** (não o canal) onde os tickets de cada tipo devem ser criados. O bot moverá automaticamente o ticket para lá.",
        Separator.Default,
        "### 3. Categorias Customizadas",
        "Use o comando `/ticket categorias adicionar` para criar menus de seleção personalizados com ícones e nomes próprios.",
        Separator.Default,
        "**Dica:** Ative o 'Modo Desenvolvedor' no seu Discord para copiar IDs facilmente (Botão direito no canal > Copiar ID).",
      );

      await interaction.reply({
        components: [guideContainer],
        flags: ["Ephemeral", "IsComponentsV2"],
      });
      return;
    }

    if (action === "refresh") {
      const panel = await createConfigPanel(guildId);
      await interaction.update({
        components: [panel],
        flags: ["IsComponentsV2"] as any,
      });
      return;
    }

    if (action === "channels") {
      const guildData = await db.guilds.get(guildId);
      const modal = new ModalBuilder()
        .setCustomId("ticket/config/channels_submit")
        .setTitle("Configurar Canais do Sistema");

      modal.addComponents(
        createRow(
          new TextInputBuilder()
            .setCustomId("logs")
            .setLabel("ID do Canal de Logs")
            .setPlaceholder("Insira o ID do canal onde as logs serão enviadas")
            .setValue(guildData.channels?.tickets || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        createRow(
          new TextInputBuilder()
            .setCustomId("vault")
            .setLabel("ID do Canal Cofre (Vault)")
            .setPlaceholder("Insira o ID do canal para salvar anexos")
            .setValue(guildData.channels?.vault || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    if (action === "base_cats") {
      const guildData = await db.guilds.get(guildId);
      const cats = guildData.channels?.categories;

      const modal = new ModalBuilder()
        .setCustomId("ticket/config/base_cats_submit")
        .setTitle("Configurar Categorias de Roteamento");

      modal.addComponents(
        createRow(
          new TextInputBuilder()
            .setCustomId("suporte")
            .setLabel("ID Categoria: Suporte")
            .setValue(cats?.suporte || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        createRow(
          new TextInputBuilder()
            .setCustomId("denuncia")
            .setLabel("ID Categoria: Denúncia")
            .setValue(cats?.denuncia || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        createRow(
          new TextInputBuilder()
            .setCustomId("financeiro")
            .setLabel("ID Categoria: Financeiro")
            .setValue(cats?.financeiro || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        createRow(
          new TextInputBuilder()
            .setCustomId("bugs")
            .setLabel("ID Categoria: Bugs")
            .setValue(cats?.bugs || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
      );

      await interaction.showModal(modal);
      return;
    }
  },
});

// Recebimento dos Modais
createResponder({
  customId: "ticket/config/channels_submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    const { fields, guildId } = interaction;
    await interaction.deferUpdate();

    const data = modalFieldsToRecord(fields);

    const guildData = await db.guilds.get(guildId!);
    guildData.channels = {
      ...guildData.channels,
      tickets: data.logs as string,
      vault: data.vault as string,
    } as any;

    await (guildData as any).save();

    const panel = await createConfigPanel(guildId!);
    await interaction.editReply({
      components: [panel],
      flags: ["IsComponentsV2"] as any,
    });
  },
});

createResponder({
  customId: "ticket/config/base_cats_submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    const { fields, guildId } = interaction;
    await interaction.deferUpdate();

    const data = modalFieldsToRecord(fields);

    const guildData = await db.guilds.get(guildId!);
    guildData.channels = {
      ...guildData.channels,
      categories: {
        suporte: data.suporte as string,
        denuncia: data.denuncia as string,
        financeiro: data.financeiro as string,
        bugs: data.bugs as string,
      },
    } as any;

    await (guildData as any).save();

    const panel = await createConfigPanel(guildId!);
    await interaction.editReply({
      components: [panel],
      flags: ["IsComponentsV2"] as any,
    });
  },
});

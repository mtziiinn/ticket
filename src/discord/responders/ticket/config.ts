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

  const customCats = channels?.ticketCategories || [];
  const catDisplay =
    customCats.length > 0
      ? customCats
          .map((c) => {
            const emojiDisplay =
              c.emoji?.length && c.emoji.length > 5 && !c.emoji.includes(":")
                ? `<:emoji:${c.emoji}>`
                : c.emoji || "🎫";
            return `> ${emojiDisplay} **${c.name}** (\`${c.value}\`) -> <#${c.parentId}>`;
          })
          .join("\n")
      : "*Nenhuma categoria configurada. Use `/ticket categorias adicionar`*";

  return createContainer(
    constants.colors.azoxo,
    createSection({
      content:
        "## ⚙️ Painel de Configuração\nGerencie os canais do sistema e visualize as categorias de atendimento ativas.",
      thumbnail: emojis.static.other_ticket,
    }),
    Separator.Default,
    "### 📡 Canais de Sistema",
    `> <:clock:1502789859960422502> **Logs de Atendimento:** ${logsDisplay}`,
    `> <:folder:1502789880214720533> **Cofre de Mídia (Vault):** ${vaultDisplay}`,
    Separator.Default,
    "### 📂 Categorias Ativas",
    catDisplay,
    Separator.Default,
    createRow(
      new ButtonBuilder({
        customId: "ticket/config/channels",
        label: "Configurar Canais",
        style: ButtonStyle.Secondary,
        emoji: "1502789931808981012",
      }),
      new ButtonBuilder({
        customId: "ticket/config/refresh",
        label: "Atualizar Status",
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
        "### 2. Categorias Dinâmicas",
        "Agora você tem total liberdade! Use o comando `/ticket categorias adicionar` para criar quantas categorias desejar. Cada uma pode ter seu próprio nome, emoji e categoria de destino no Discord.",
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

    if (!guildData.channels) {
      guildData.channels = {
        tickets: "",
        vault: "",
        categories: { suporte: "", denuncia: "", financeiro: "", bugs: "" },
        ticketCategories: [] as any,
      } as any;
    }

    if (guildData.channels) {
      guildData.channels.tickets = data.logs as string;
      guildData.channels.vault = data.vault as string;
    }

    guildData.markModified("channels");
    await (guildData as any).save();

    const panel = await createConfigPanel(guildId!);
    await interaction.editReply({
      components: [panel],
      flags: ["IsComponentsV2"] as any,
    });
  },
});

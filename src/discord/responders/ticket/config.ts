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
  StringSelectMenuBuilder,
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
      : "*Nenhuma categoria configurada.*";

  return createContainer(
    constants.colors.azoxo,
    createSection({
      content:
        "## ⚙️ Painel de Configuração\nGerencie os canais do sistema e as categorias de atendimento de forma visual.",
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
        label: "Canais",
        style: ButtonStyle.Secondary,
        emoji: "1502789931808981012",
      }),
      new ButtonBuilder({
        customId: "ticket/config/cat_add",
        label: "Add Categoria",
        style: ButtonStyle.Secondary,
        emoji: "1502789796278304800",
      }),
      new ButtonBuilder({
        customId: "ticket/config/cat_remove_list",
        label: "Remover Cat",
        style: ButtonStyle.Secondary,
        emoji: "1502789800967536741",
        disabled: customCats.length === 0,
      }),
    ),
    createRow(
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
        "### <:clock:1502789859960422502> 1. Canais de Sistema",
        "**Logs:** Onde todas as aberturas e encerramentos serão registrados.\n**Vault:** Canal para backup permanente de imagens.",
        Separator.Default,
        "### <:folder_add:1502789875009851432> 2. Gerenciando Categorias",
        "**Adicionar:** Clique em 'Add Categoria' e preencha o formulário. O ID da Categoria Pai é onde os tickets serão criados.\n**Remover:** Clique em 'Remover Cat' e selecione a categoria que deseja excluir.",
        Separator.Default,
        "**Dica:** Ative o 'Modo Desenvolvedor' para copiar IDs de categorias no Discord.",
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
            .setValue(guildData.channels?.tickets || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        createRow(
          new TextInputBuilder()
            .setCustomId("vault")
            .setLabel("ID do Canal Cofre (Vault)")
            .setValue(guildData.channels?.vault || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    if (action === "cat_add") {
      const modal = new ModalBuilder()
        .setCustomId("ticket/config/cat_add_submit")
        .setTitle("Adicionar Nova Categoria");

      modal.addComponents(
        createRow(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Nome da Categoria")
            .setPlaceholder("Ex: Suporte VIP")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        createRow(
          new TextInputBuilder()
            .setCustomId("description")
            .setLabel("Descrição")
            .setPlaceholder("Ex: Atendimento prioritário para VIPs")
            .setStyle(TextInputStyle.Short)
            .setRequired(false),
        ),
        createRow(
          new TextInputBuilder()
            .setCustomId("parentId")
            .setLabel("ID da Categoria Pai (Discord)")
            .setPlaceholder("ID da categoria onde os tickets serão criados")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        createRow(
          new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Emoji (ID ou Emoji)")
            .setPlaceholder("Ex: 1502789959378145300 ou 🎫")
            .setStyle(TextInputStyle.Short)
            .setRequired(false),
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    if (action === "cat_remove_list") {
      const guildData = await db.guilds.get(guildId);
      const cats = guildData.channels?.ticketCategories || [];

      if (cats.length === 0) {
        await interaction.reply({
          content: "Nenhuma categoria para remover.",
          flags: ["Ephemeral"],
        });
        return;
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket/config/cat_remove_select")
        .setPlaceholder("Selecione a categoria para remover...")
        .addOptions(
          ...cats.map((c) => ({
            label: c.name!,
            value: c.value!,
            description: `ID: ${c.parentId}`,
            emoji: c.emoji || undefined,
          })),
        );

      await interaction.reply({
        content: "Selecione abaixo a categoria que deseja excluir:",
        components: [createRow(menu)],
        flags: ["Ephemeral"],
      });
    }
  },
});

// Recebimento dos Modais e Menus
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
        categories: {},
        ticketCategories: [],
      } as any;
    }

    guildData.channels.tickets = data.logs as string;
    guildData.channels.vault = data.vault as string;

    guildData.markModified("channels");
    await (guildData as any).save();

    const panel = await createConfigPanel(guildId!);
    await interaction.editReply({
      components: [panel],
      flags: ["IsComponentsV2"] as any,
    });
  },
});

createResponder({
  customId: "ticket/config/cat_add_submit",
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
        categories: {},
        ticketCategories: [],
      } as any;
    }
    if (!guildData.channels.ticketCategories)
      guildData.channels.ticketCategories = [] as any;

    const name = data.name as string;
    const value = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");

    guildData.channels.ticketCategories.push({
      name,
      value,
      description: data.description as string,
      parentId: data.parentId as string,
      emoji: (data.emoji as string) || "1502789959378145300",
    });

    guildData.markModified("channels");
    await (guildData as any).save();

    const panel = await createConfigPanel(guildId!);
    await interaction.editReply({
      components: [panel],
      flags: ["IsComponentsV2"] as any,
    });
  },
});

createResponder({
  customId: "ticket/config/cat_remove_select",
  types: [ResponderType.StringSelect],
  cache: "cached",
  async run(interaction) {
    const { values, guildId, message } = interaction;
    const valueToRemove = values[0];

    const guildData = await db.guilds.get(guildId!);
    if (guildData.channels?.ticketCategories) {
      guildData.channels.ticketCategories =
        guildData.channels.ticketCategories.filter(
          (c) => c.value !== valueToRemove,
        ) as any;
      guildData.markModified("channels");
      await (guildData as any).save();
    }

    // Deleta a mensagem do menu (ephemeral)
    await interaction.deferUpdate();
    await interaction.deleteReply().catch(() => {});

    // Atualiza o painel principal
    const panel = await createConfigPanel(guildId!);
    // Como o painel está em outra mensagem, precisamos achar o contexto original ou pedir refresh
    // Mas podemos tentar dar um followUp ou informar o sucesso
    await interaction.followUp({
      content:
        "✅ Categoria removida com sucesso! Atualize o painel para ver as mudanças.",
      flags: ["Ephemeral"],
    });
  },
});

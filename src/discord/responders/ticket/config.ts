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
  const emojiDisplay = channels?.ticketEmoji || "🎫";

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
        "## <:shield_add:1502789931808981012> Painel de Configuração\nGerencie os canais do sistema e as categorias de atendimento de forma visual.",
      thumbnail: emojis.static.other_ticket,
    }),
    Separator.Default,
    "### <:database:1502789865023209512> Canais de Sistema",
    `> <:clock:1502789859960422502> **Logs de Atendimento:** ${logsDisplay}`,
    `> <:folder:1502789880214720533> **Cofre de Mídia (Vault):** ${vaultDisplay}`,
    `> ${emojiDisplay} **Emoji dos Canais:** \`${emojiDisplay}\``,
    Separator.Default,
    "### <:folder_open:1502789875928400103> Categorias Ativas",
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
            "## <:action_info:1502789798983766016> Guia de Configuração\nSiga os passos abaixo para deixar seu sistema de tickets pronto para uso.",
          thumbnail: emojis.static.action_info,
        }),
        Separator.Default,
        "### <:database:1502789865023209512> 1. Canais do Sistema",
        "Clique no botão **Canais** para definir onde o bot deve trabalhar:\n> <:clock:1502789859960422502> **Logs:** Canal para registro de todo o histórico.\n> <:folder:1502789880214720533> **Vault:** Canal privado para backup de anexos.",
        Separator.Default,
        "### <:folder_add:1502789875009851432> 2. Categorias de Atendimento",
        "Você deve criar pelo menos uma categoria para os usuários selecionarem:\n> <:action_add:1502789796278304800> **Adicionar:** Defina nome, emoji e o ID da categoria pai no Discord.\n> <:action_remove:1502789800967536741> **Remover:** Exclua categorias que não são mais necessárias.",
        Separator.Default,
        "### <:other_ticket:1502789959378145300> 3. Painel de Abertura",
        "Após configurar tudo, use o comando abaixo no canal desejado:\n` /ticket painel canal: #seu-canal `\n\n**Dica:** Ative o **Modo Desenvolvedor** no seu Discord para copiar IDs facilmente clicando com o botão direito nos canais.",
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
        createRow(
          new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Emoji dos Canais")
            .setPlaceholder("Ex: 🎫 ou 🛠️")
            .setValue(guildData.channels?.ticketEmoji || "🎫")
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

    if (guildData.channels) {
      guildData.channels.tickets = data.logs as string;
      guildData.channels.vault = data.vault as string;
      guildData.channels.ticketEmoji = data.emoji as string;
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
    if (guildData.channels && !guildData.channels.ticketCategories) {
      guildData.channels.ticketCategories = [] as any;
    }

    const name = data.name as string;
    const value = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");

    if (guildData.channels) {
      guildData.channels.ticketCategories.push({
        name,
        value,
        description: data.description as string,
        parentId: data.parentId as string,
        emoji: (data.emoji as string) || "1502789959378145300",
      });
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

createResponder({
  customId: "ticket/config/cat_remove_select",
  types: [ResponderType.StringSelect],
  cache: "cached",
  async run(interaction) {
    const { values, guildId } = interaction;
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

    // Informar o sucesso
    await interaction.followUp({
      content:
        "✅ Categoria removida com sucesso! Atualize o painel para ver as mudanças.",
      flags: ["Ephemeral"],
    });
  },
});

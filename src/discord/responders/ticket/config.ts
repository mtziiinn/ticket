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
  const staffRoleDisplay = channels?.staffRole
    ? `<@&${channels.staffRole}>`
    : "*Não configurado*";
  const isClosed = channels?.closed ?? false;
  const statusDisplay = isClosed
    ? `<:action_x:1502789802918150206> **Loja Fechada** (Abertura bloqueada)`
    : `<:action_check:1502789797821939752> **Loja Aberta** (Abertura liberada)`;

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
      content: `## <:shield_add:1502789931808981012> Painel de Configuração\nGerencie os canais, cargo de equipe e o status de funcionamento do sistema.`,
      thumbnail: emojis.static.other_ticket,
    }),
    Separator.Default,
    "### <:database:1502789865023209512> Canais e Acesso",
    `> <:clock:1502789859960422502> **Logs de Atendimento:** ${logsDisplay}`,
    `> <:folder:1502789880214720533> **Cofre de Mídia (Vault):** ${vaultDisplay}`,
    `> <:other_dollar:1502789953334280345> **Chave PIX:** \`${channels?.pixKey || "Não configurada"}\``,
    `> <:user_users:1502789976327327801> **Cargo Staff:** ${staffRoleDisplay}`,
    Separator.Default,
    "### <:clock_check:1502789856881938502> Status de Funcionamento",
    `> ${statusDisplay}`,
    Separator.Default,
    "### <:folder_open:1502789875928400103> Categorias Ativas",
    catDisplay,
    Separator.Default,
    createRow(
      new ButtonBuilder({
        customId: "ticket/config/channels",
        label: "Sistema",
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
        customId: "ticket/config/cat_edit_list",
        label: "Editar Cat",
        style: ButtonStyle.Secondary,
        emoji: "1502789796278304800",
        disabled: customCats.length === 0,
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
        customId: isClosed
          ? "ticket/config/open_store"
          : "ticket/config/close_store",
        label: isClosed ? "Abrir Loja" : "Fechar Loja",
        style: isClosed ? ButtonStyle.Success : ButtonStyle.Danger,
        emoji: isClosed ? "1502789797821939752" : "1502789802918150206",
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
            "## <:action_info:1502789798983766016> Guia de Configuração\nSiga os passos abaixo para deixar seu sistema de tickets pronto para uso.",
          thumbnail: emojis.static.action_info,
        }),
        Separator.Default,
        "### <:database:1502789865023209512> 1. Canais e Acesso",
        "**Logs/Vault:** Defina os canais de registro e backup.\n**Cargo Staff:** O cargo que terá acesso administrativo aos tickets (não precisa ser ADM).",
        Separator.Default,
        "### <:clock_check:1502789856881938502> 2. Abrir/Fechar Loja",
        "Use os botões coloridos para bloquear ou liberar a abertura de novos tickets pelos usuários instantaneamente.",
        Separator.Default,
        "### <:folder_add:1502789875009851432> 3. Categorias Dinâmicas",
        "Crie setores de atendimento personalizados com IDs de categorias do Discord específicos. Cada categoria possui seu próprio emoji que aparece no nome do canal do ticket.",
        Separator.Default,
        "### <:other_ticket:1502789959378145300> 4. Painel de Abertura",
        "Após configurar tudo, use o comando abaixo no canal desejado:\n` /ticket painel canal: #seu-canal `",
      );

      await interaction.reply({
        components: [guideContainer],
        flags: ["Ephemeral", "IsComponentsV2"],
      });
      return;
    }

    if (action === "open_store" || action === "close_store") {
      const guildData = await db.guilds.get(guildId);
      if (!guildData.channels) {
        guildData.channels = {
          tickets: "",
          vault: "",
          categories: {},
          ticketCategories: [],
          closed: false,
          staffRole: "",
        } as any;
      }
      if (guildData.channels) {
        guildData.channels.closed = action === "close_store";
      }
      guildData.markModified("channels");
      await (guildData as any).save();

      const panel = await createConfigPanel(guildId);
      await interaction.update({
        components: [panel],
        flags: ["IsComponentsV2"] as any,
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
        .setTitle("Configurar Canais e Acesso");

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
            .setCustomId("staffRole")
            .setLabel("ID do Cargo Staff")
            .setPlaceholder("ID do cargo que gerenciará os tickets")
            .setValue(guildData.channels?.staffRole || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        createRow(
          new TextInputBuilder()
            .setCustomId("pixKey")
            .setLabel("Chave PIX")
            .setPlaceholder("Insira sua chave (CPF, E-mail, etc.)")
            .setValue(guildData.channels?.pixKey || "")
            .setStyle(TextInputStyle.Short)
            .setRequired(false),
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
            .setCustomId("slug")
            .setLabel("Identificador (slug)")
            .setPlaceholder("Ex: suporte-vip (usado no nome do canal)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false),
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
        closed: false,
        staffRole: "",
      } as any;
    }

    if (guildData.channels) {
      guildData.channels.tickets = data.logs as string;
      guildData.channels.vault = data.vault as string;
      guildData.channels.staffRole = data.staffRole as string;
      guildData.channels.pixKey = data.pixKey as string;
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
        closed: false,
        staffRole: "",
      } as any;
    }
    if (guildData.channels && !guildData.channels.ticketCategories) {
      guildData.channels.ticketCategories = [] as any;
    }

    const name = data.name as string;
    const rawSlug = data.slug as string;
    const value = rawSlug
      ? rawSlug.toLowerCase().replace(/\s+/g, "-")
      : name
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
        emoji: (data.emoji as string) || "🎫",
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
    await interaction.deleteReply().catch((err: any) => console.error("[Config]", err));

    // Informar o sucesso
    await interaction.followUp({
      content:
        "<:action_check:1502789797821939752> Categoria removida com sucesso! Atualize o painel para ver as mudanças.",
      flags: ["Ephemeral"],
    });
  },
});

// Editar Categoria - Lista
createResponder({
  customId: "ticket/config/cat_edit_list",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction) {
    const { guildId } = interaction;
    const guildData = await db.guilds.get(guildId!);
    const cats = guildData.channels?.ticketCategories || [];

    if (cats.length === 0) {
      await interaction.reply({
        content: "Nenhuma categoria para editar.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket/config/cat_edit_select")
      .setPlaceholder("Selecione a categoria para editar...")
      .addOptions(
        ...cats.map((c) => ({
          label: c.name!,
          value: c.value!,
          description: `Slug: ${c.value}`,
          emoji: c.emoji || undefined,
        })),
      );

    await interaction.reply({
      content: "Selecione abaixo a categoria que deseja editar:",
      components: [createRow(menu)],
      flags: ["Ephemeral"],
    });
  },
});

// Editar Categoria - Seleção
createResponder({
  customId: "ticket/config/cat_edit_select",
  types: [ResponderType.StringSelect],
  cache: "cached",
  async run(interaction) {
    const { values, guildId } = interaction;
    const slug = values[0];

    const guildData = await db.guilds.get(guildId!);
    const cat = guildData.channels?.ticketCategories?.find(
      (c) => c.value === slug,
    );

    if (!cat) {
      await interaction.reply({
        content: "Categoria não encontrada.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId("ticket/config/cat_edit_submit")
      .setTitle("Editar Categoria");

    modal.addComponents(
      createRow(
        new TextInputBuilder()
          .setCustomId("name")
          .setLabel("Nome da Categoria")
          .setPlaceholder("Ex: Suporte VIP")
          .setValue(cat.name || "")
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      createRow(
        new TextInputBuilder()
          .setCustomId("description")
          .setLabel("Descrição")
          .setPlaceholder("Ex: Atendimento prioritário para VIPs")
          .setValue(cat.description || "")
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
      createRow(
        new TextInputBuilder()
          .setCustomId("parentId")
          .setLabel("ID da Categoria Pai (Discord)")
          .setPlaceholder("ID da categoria onde os tickets serão criados")
          .setValue(cat.parentId || "")
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      createRow(
        new TextInputBuilder()
          .setCustomId("slug")
          .setLabel("Identificador (slug)")
          .setPlaceholder("Ex: suporte-vip (usado no nome do canal)")
          .setValue(cat.value || "")
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      createRow(
        new TextInputBuilder()
          .setCustomId("emoji")
          .setLabel("Emoji (ID ou Emoji)")
          .setPlaceholder("Ex: 1502789959378145300 ou 🎫")
          .setValue(cat.emoji || "")
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
    );

    await interaction.showModal(modal);
  },
});

// Editar Categoria - Submit
createResponder({
  customId: "ticket/config/cat_edit_submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    const { fields, guildId } = interaction;
    await interaction.deferUpdate();

    const data = modalFieldsToRecord(fields);
    const guildData = await db.guilds.get(guildId!);
    const oldSlug = (data.slug as string) || "";

    if (guildData.channels?.ticketCategories) {
      const index = guildData.channels.ticketCategories.findIndex(
        (c) => c.value === oldSlug,
      );

      if (index !== -1) {
        const rawSlug = data.slug as string;
        const newValue = rawSlug
          ? rawSlug.toLowerCase().replace(/\s+/g, "-")
          : (data.name as string)
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/\s+/g, "_");

        guildData.channels.ticketCategories[index] = {
          name: data.name as string,
          value: newValue,
          description: (data.description as string) || "",
          parentId: data.parentId as string,
          emoji: (data.emoji as string) || "",
        } as any;
        guildData.markModified("channels");
        await (guildData as any).save();
      }
    }

    await interaction.editReply({
      content: "<:action_check:1502789797821939752> Categoria editada com sucesso!",
      flags: ["Ephemeral"] as any,
    });
  },
});

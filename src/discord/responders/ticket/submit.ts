import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  createContainer,
  createSection,
  modalFieldsToRecord,
  Separator,
  createRow,
} from "@magicyan/discord";
import {
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputStyle,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
} from "discord.js";
import { db } from "#database";

console.log(
  "[Ticket] Sistema de Tickets (V15 - Multi-Category Routing) carregado!",
);

// Função compartilhada para criar o ticket
async function processTicketSubmission(interaction: any) {
  console.log(">>> [Ticket] PROCESSANDO CRIAÇÃO DO TICKET...");

  await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => {});

  const { guild, user, fields } = interaction;

  try {
    // 0. Verificar se o usuário já possui um ticket aberto
    const existingTicket = await db.tickets.findOne({
      guildId: guild.id,
      ownerId: user.id,
      closed: false,
    });

    if (existingTicket) {
      await interaction.editReply({
        content: `<:action_x:1502789802918150206> Você já possui um ticket aberto em <#${existingTicket.channelId}>! Finalize-o antes de abrir um novo.`,
      });
      return;
    }

    const data = modalFieldsToRecord(fields);
    const categoryRaw = data.category;
    const category =
      ((Array.isArray(categoryRaw) ? categoryRaw[0] : categoryRaw) as string) ||
      "suporte";
    const description = (data.description as string) || "Nenhuma descrição.";

    const ticketId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const openedAt = new Date().toLocaleString("pt-BR");

    // 1. Buscar as configurações de categorias no banco
    const guildData = await db.guilds.get(guild.id);
    const dynamicCategories = guildData.channels?.ticketCategories || [];
    const selectedCategory = dynamicCategories.find(
      (c) => c.value === category,
    );

    // Pega o ID da categoria baseado no assunto escolhido
    let parentId = selectedCategory?.parentId;

    console.log(
      `[Ticket] Roteando assunto "${category}" para categoria ID: ${parentId || "Padrão"}`,
    );

    // Emojis customizados para o tópico
    const eTicket = "<:other_ticket:1502789959378145300>";
    const eUser = "<:user:1502789979229913268>";
    const eCalendar = "<:calendar:1502789854486986752>";
    const eFolder = "<:folder:1502789880214720533>";

    // 2. Criar o canal na categoria correta
    const channel = await guild.channels.create({
      name: `🎫・${ticketId}`,
      type: ChannelType.GuildText,
      parent: parentId || undefined,
      topic: `${eTicket}・${ticketId} | ${eUser} Aberto Por: ${user.tag} | ${eCalendar} Aberto em: ${openedAt} | ${eFolder} Categoria: ${category.toUpperCase()}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    });

    // 3. Preparar Interface
    const container = createContainer(
      constants.colors.azoxo,
      createSection({
        content: `## <:other_ticket:1502789959378145300> Ticket ${ticketId}\n${user} Seja bem-vindo(a) ao seu ticket! Através deste canal, a equipe irá realizar seu atendimento e esclarecer suas dúvidas. Envie abaixo sua solicitação e aguarde.`,
        thumbnail: user.displayAvatarURL() as any,
      }),
      Separator.Default,
      `<:folder_open:1502789875928400103> **Categoria do atendimento:**\n\`\`\`\n${category.toUpperCase()}\n\`\`\``,
      `<:action_info:1502789798983766016> **Motivo do contato:**\n\`\`\`\n${description}\n\`\`\``,
      Separator.Default,
      createRow(
        new ButtonBuilder({
          customId: "ticket/manage/claim",
          label: "Assumir Ticket",
          style: ButtonStyle.Secondary,
          emoji: "1502789940612698192",
        }),
        new ButtonBuilder({
          customId: "ticket/manage/admin",
          label: "Painel Admin",
          style: ButtonStyle.Secondary,
          emoji: "1502789931808981012",
        }),
      ),
      createRow(
        new ButtonBuilder({
          customId: "ticket/manage/close_confirm",
          label: "Finalizar Ticket",
          style: ButtonStyle.Secondary,
          emoji: "1502789802918150206",
        }),
      ),
    );

    const mainMessage = await channel.send({
      components: [container],
      flags: ["IsComponentsV2"],
    });

    // 4. Salvar no banco
    await db.tickets.create({
      guildId: guild.id,
      ownerId: user.id,
      channelId: channel.id,
      messageId: mainMessage.id,
      ticketId,
      category,
      description,
    });

    await interaction.editReply({
      content: `Seu ticket foi aberto com sucesso em ${channel}!`,
    });
  } catch (error: any) {
    console.error("[Ticket] ERRO NA CRIAÇÃO:", error);
    await interaction
      .editReply({
        content: `❌ Erro ao criar ticket: \`${error.message}\``,
      })
      .catch(() => {});
  }
}

// 1. Responder que abre o Modal
createResponder({
  customId: "ticket/form/open",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction) {
    const { guild } = interaction;
    const guildData = await db.guilds.get(guild.id);
    const dynamicCategories = guildData.channels?.ticketCategories || [];

    if (dynamicCategories.length === 0) {
      await interaction.reply({
        content:
          "❌ Nenhuma categoria de atendimento foi configurada pela Staff ainda.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId("ticket/form/submit")
      .setTitle("Abertura de Ticket");

    const categoryLabel = new LabelBuilder()
      .setLabel("Selecione a categoria")
      .setDescription("Escolha o assunto que melhor descreve seu problema")
      .setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId("category")
          .setPlaceholder("Selecione uma categoria...")
          .setOptions(
            ...dynamicCategories.map((cat) => ({
              label: cat.name as string,
              value: cat.value as string,
              description: (cat.description as string) || undefined,
              emoji: cat.emoji || undefined,
            })),
          ),
      );

    const descriptionLabel = new LabelBuilder()
      .setLabel("Descrição do Problema")
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("description")
          .setPlaceholder("Descreva detalhadamente o motivo do seu contato...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true),
      );

    modal.addComponents(categoryLabel, descriptionLabel);
    await interaction.showModal(modal).catch((e) => console.error(e));
  },
});

// 2. Responder que recebe a submissão
createResponder({
  customId: "ticket/form/submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processTicketSubmission(interaction);
  },
});

// 3. Responder de backup
createResponder({
  customId: "Abertura de Ticket",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processTicketSubmission(interaction);
  },
});

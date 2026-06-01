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
  MessageType,
} from "discord.js";
import { db } from "#database";
import { formatEmoji } from "#functions";

// Função compartilhada para criar o ticket
async function processTicketSubmission(
  interaction: any,
  routeCategory?: string,
) {
  const { guild, user, fields } = interaction;

  // 1. Verificar se o sistema está fechado (Loja Fechada)
  const guildData = await db.guilds.get(guild.id);
  if (guildData.channels?.closed) {
    await interaction
      .reply({
        content: `<:action_x:1502789802918150206> Desculpe, o setor de atendimentos está temporariamente **fechado**. Tente novamente mais tarde!`,
        flags: ["Ephemeral"],
      })
      .catch((err: any) => console.error("[Submit]", err));
    return;
  }

  await interaction
    .deferReply({ flags: ["Ephemeral"] })
    .catch((err: any) => console.error("[Submit]", err));

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
      routeCategory ||
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

    // Emojis customizados para o tópico
    const eTicket = "<:other_ticket:1502789959378145300>";
    const eUser = "<:user:1502789979229913268>";
    const eCalendar = "<:calendar:1502789854486986752>";
    const eFolder = "<:folder:1502789880214720533>";

    // 2. Criar o canal na categoria correta
    // Usa o channelEmoji configurado (unicode) ou fallback 🎫
    const channelEmoji = selectedCategory?.channelEmoji || "🎫";

    const permissionOverwrites: any[] = [
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
    ];

    const staffRoleId = guildData.channels?.staffRole;
    if (staffRoleId) {
      permissionOverwrites.push({
        id: staffRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      });
    }

    const channel = await guild.channels.create({
      name: `${channelEmoji}・${category}-${ticketId}`,
      type: ChannelType.GuildText,
      parent: parentId || undefined,
      topic: `${eTicket}・${ticketId} | ${eUser} Aberto Por: ${user.tag} | ${eCalendar} Aberto em: ${openedAt} | ${eFolder} Categoria: ${category.toUpperCase()}`,
      permissionOverwrites,
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

    // Fixar a mensagem principal no canal do ticket
    await mainMessage
      .pin()
      .catch((err: any) =>
        console.error("[Submit] Erro ao fixar mensagem:", err),
      );

    // Apagar a mensagem automática do Discord com um pequeno delay
    setTimeout(async () => {
      try {
        console.log(
          `[Submit] Iniciando busca de mensagem de pin em: ${channel.id}`,
        );
        const messages = await channel.messages.fetch({ limit: 50 });
        console.log(`[Submit] Mensagens buscadas: ${messages.size}`);

        const pinSystemMessage = messages.find((m: any) => {
          console.log(`[Submit] Verificando msg ${m.id} - Tipo: ${m.type}`);
          return m.type === MessageType.ChannelPinnedMessage;
        });

        if (pinSystemMessage) {
          console.log(
            `[Submit] Mensagem de pin encontrada (${pinSystemMessage.id}). Tentando deletar...`,
          );
          await pinSystemMessage
            .delete()
            .then(() =>
              console.log(`[Submit] Mensagem de pin deletada com sucesso.`),
            )
            .catch((err: any) =>
              console.error(`[Submit] Erro ao deletar msg de pin:`, err),
            );
        } else {
          console.log(
            `[Submit] Nenhuma mensagem de pin encontrada nas últimas 50 mensagens.`,
          );
        }
      } catch (e) {
        console.error("[Submit] Erro crítico ao processar limpeza de pin:", e);
      }
    }, 5000);

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

    // 5. Enviar Log de Abertura
    const logChannelId = guildData.channels?.tickets;
    if (logChannelId) {
      const logChannel = await guild.channels
        .fetch(logChannelId)
        .catch(() => null);
      if (logChannel?.isTextBased()) {
        const openedAtTimestamp = Math.floor(Date.now() / 1000);
        const categoryName = selectedCategory?.name || category.toUpperCase();

        const logContainer = createContainer(
          constants.colors.primary,
          createSection({
            content: `## <:folder:1502789880214720533> Novo Atendimento ${ticketId}\nVenho registrar a log de abertura do atendimento \`${ticketId}\`, iniciado por ${user}. Abaixo você pode ver todas as informações do ticket.`,
            thumbnail: user.displayAvatarURL() as any,
          }),
          Separator.Default,
          `**Identificação**\n` +
            [
              `<:user:1502789979229913268> **Aberto por:** ${user} (\`${user.id}\`)`,
              `<:folder_open:1502789875928400103> **Categoria:** \`${categoryName}\``,
            ].join("\n"),
          Separator.Default,
          `**Cronologia**\n` +
            [
              `<:clock:1502789859960422502> **Aberto em:** <t:${openedAtTimestamp}:f> (<t:${openedAtTimestamp}:R>)`,
            ].join("\n"),
          Separator.Default,
          `**<:action_info:1502789798983766016> Motivo da Abertura:**\n\`\`\`\n${description}\n\`\`\``,
          createRow(
            new ButtonBuilder({
              label: "Ir para o Canal",
              style: ButtonStyle.Link,
              emoji: "1502789882916110407",
              url: channel.url,
            }),
          ),
        );

        await (logChannel as any)
          .send({ components: [logContainer], flags: ["IsComponentsV2"] })
          .catch((err: any) => console.error("[Submit]", err));
      }
    }

    await interaction.editReply({
      content: `Seu ticket foi aberto com sucesso em ${channel}!`,
    });
  } catch (error: any) {
    console.error("[Ticket] ERRO NA CRIAÇÃO:", error);
    await interaction
      .editReply({
        content: `❌ Erro ao criar ticket: \`${error.message}\``,
      })
      .catch((err: any) => console.error("[Submit]", err));
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

    if (guildData.channels?.closed) {
      await interaction.reply({
        content: `<:action_x:1502789802918150206> Desculpe, o setor de atendimentos está temporariamente **fechado**. Tente novamente mais tarde!`,
        flags: ["Ephemeral"],
      });
      return;
    }

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
            ...dynamicCategories.map((cat) => {
              return {
                label: cat.name as string,
                value: cat.value as string,
                description: (cat.description as string) || undefined,
                emoji: formatEmoji(cat.emoji),
              };
            }),
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
    await interaction.showModal(modal).catch((e: any) => {
      console.error("[Ticket] Erro ao abrir modal:", e);
    });
  },
});

// 1. Responder de Seleção direta do Painel
createResponder({
  customId: "ticket/form/select_open",
  types: [ResponderType.StringSelect],
  cache: "cached",
  async run(interaction) {
    const { values, guild } = interaction;
    const category = values[0];

    const guildData = await db.guilds.get(guild.id);
    if (guildData.channels?.closed) {
      await interaction.reply({
        content: `<:action_x:1502789802918150206> Desculpe, o setor de atendimentos está temporariamente **fechado**. Tente novamente mais tarde!`,
        flags: ["Ephemeral"],
      });
      return;
    }

    // Verificar se o usuário já possui um ticket aberto
    const existingTicket = await db.tickets.findOne({
      guildId: guild.id,
      ownerId: interaction.user.id,
      closed: false,
    });

    if (existingTicket) {
      await interaction.reply({
        content: `<:action_x:1502789802918150206> Você já possui um ticket aberto em <#${existingTicket.channelId}>! Finalize-o antes de abrir um novo.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`ticket/form/submit/${category}`)
      .setTitle("Abertura de Ticket");

    const descriptionLabel = new LabelBuilder()
      .setLabel("Descrição do Problema")
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("description")
          .setPlaceholder("Descreva detalhadamente o motivo do seu contato...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true),
      );

    modal.addComponents(descriptionLabel);
    await interaction.showModal(modal).catch((e: any) => {
      console.error("[Ticket] Erro ao abrir modal de seleção:", e);
    });
  },
});

// 2. Responder que recebe a submissão via parâmetro de categoria
createResponder({
  customId: "ticket/form/submit/:category",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction, { category }) {
    await processTicketSubmission(interaction, category);
  },
});

// 3. Responder que recebe a submissão legado
createResponder({
  customId: "ticket/form/submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processTicketSubmission(interaction);
  },
});

// 4. Responder de backup legado
createResponder({
  customId: "Abertura de Ticket",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processTicketSubmission(interaction);
  },
});

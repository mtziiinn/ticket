import { createCommand } from "#base";
import {
  createContainer,
  createSection,
  Separator,
  createRow,
} from "@magicyan/discord";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { db } from "#database";

createCommand({
  name: "ticket",
  description: "Comandos do sistema de tickets",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: ["Administrator"],
  options: [
    {
      name: "painel",
      description: "Enviar o painel de abertura de tickets",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "canal",
          description: "Canal onde o painel será enviado",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
      ],
    },
    {
      name: "configurar",
      description: "Configurar canais de logs e categorias de roteamento",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "logs",
          description: "Canal onde os logs de tickets serão enviados",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "vault",
          description:
            "Canal cofre onde as imagens serão salvas permanentemente",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "cat_suporte",
          description: "Categoria para Suporte Geral",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "cat_denuncia",
          description: "Categoria para Denúncias",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "cat_financeiro",
          description: "Categoria para Financeiro",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "cat_bugs",
          description: "Categoria para Bugs",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
      ],
    },
    {
      name: "categorias",
      description: "Gerenciar categorias de atendimento",
      type: ApplicationCommandOptionType.SubcommandGroup,
      options: [
        {
          name: "adicionar",
          description: "Adicionar uma nova categoria de atendimento",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "nome",
              description: "Nome da categoria (ex: Suporte VIP)",
              type: ApplicationCommandOptionType.String,
              required: true,
            },
            {
              name: "descrição",
              description: "Descrição que aparecerá no menu",
              type: ApplicationCommandOptionType.String,
              required: true,
            },
            {
              name: "categoria",
              description:
                "ID da categoria no Discord onde o ticket será criado",
              type: ApplicationCommandOptionType.Channel,
              required: true,
            },
            {
              name: "emoji",
              description: "Emoji da categoria (pode ser o ID ou emoji comum)",
              type: ApplicationCommandOptionType.String,
              required: false,
            },
          ],
        },
        {
          name: "remover",
          description: "Remover uma categoria de atendimento",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "valor",
              description: "O valor (slug) da categoria a ser removida",
              type: ApplicationCommandOptionType.String,
              required: true,
            },
          ],
        },
        {
          name: "listar",
          description: "Listar todas as categorias configuradas",
          type: ApplicationCommandOptionType.Subcommand,
        },
      ],
    },
  ],
  async run(interaction) {
    const { options, guildId } = interaction;
    const subcommand = options.getSubcommand();
    const group = options.getSubcommandGroup();

    if (group === "categorias") {
      await interaction.deferReply({ ephemeral: true });
      const guildData = await db.guilds.get(guildId!);

      if (subcommand === "adicionar") {
        const name = options.getString("nome", true);
        const description = options.getString("descrição", true);
        const categoryChannel = options.getChannel("categoria", true);
        const emoji = options.getString("emoji") || "1502789959378145300";
        const value = name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "_");

        if (!guildData.channels) {
          guildData.channels = {
            tickets: "",
            categories: { suporte: "", denuncia: "", financeiro: "", bugs: "" },
            ticketCategories: [] as any,
          };
        }
        if (!guildData.channels.ticketCategories)
          guildData.channels.ticketCategories = [] as any;

        const exists = guildData.channels.ticketCategories.find(
          (c) => c.value === value,
        );
        if (exists) {
          await interaction.editReply({
            content: `❌ Já existe uma categoria com o valor \`${value}\`. Use outro nome.`,
          });
          return;
        }

        guildData.channels.ticketCategories.push({
          name,
          value,
          description,
          emoji,
          parentId: categoryChannel.id,
        });

        await (guildData as any).save();
        await interaction.editReply({
          content: `✅ Categoria **${name}** (\`${value}\`) adicionada com sucesso!`,
        });
        return;
      }

      if (subcommand === "remover") {
        const value = options.getString("valor", true);

        if (!guildData.channels?.ticketCategories) {
          await interaction.editReply({
            content: "❌ Nenhuma categoria configurada.",
          });
          return;
        }

        const initialLength = guildData.channels.ticketCategories.length;
        const filtered = guildData.channels.ticketCategories.filter(
          (c) => c.value !== value,
        );

        if (filtered.length === initialLength) {
          await interaction.editReply({
            content: `❌ Nenhuma categoria encontrada com o valor \`${value}\`.`,
          });
          return;
        }

        guildData.channels.ticketCategories = filtered as any;

        await (guildData as any).save();
        await interaction.editReply({
          content: `✅ Categoria \`${value}\` removida com sucesso!`,
        });
        return;
      }

      if (subcommand === "listar") {
        const cats = guildData.channels?.ticketCategories;
        if (!cats || cats.length === 0) {
          await interaction.editReply({
            content: "Nenhuma categoria configurada no momento.",
          });
          return;
        }

        const list = cats
          .map((c) => {
            const emojiDisplay =
              c.emoji?.length && c.emoji.length > 5 && !c.emoji.includes(":")
                ? `<:emoji:${c.emoji}>`
                : c.emoji || "🎫";
            return `• ${emojiDisplay} **${c.name}** (\`${c.value}\`) - <#${c.parentId}>`;
          })
          .join("\n");
        await interaction.editReply({
          content: `### 📂 Categorias Configuradas\n${list}`,
        });
        return;
      }
    }

    if (subcommand === "painel") {
      const channel = options.getChannel("canal", true);
      if (!channel.isTextBased()) {
        await interaction.reply({
          content: "O canal precisa ser de texto!",
          flags: ["Ephemeral"],
        });
        return;
      }

      const container = createContainer(
        constants.colors.azoxo,
        createSection({
          content: `## <:other_ticket:1502789959378145300> Central de Atendimento\nSeja bem-vindo(a) ao nosso sistema de atendimento. Através do atendimento, você pode falar diretamente com nossa equipe.`,
          thumbnail: emojis.static.other_ticket,
        }),
        Separator.Default,
        [
          `● Forneça o motivo e o máximo de informações possível para agilizar seu atendimento.`,
          `● Não chame membros da equipe no privado.`,
          `● Iniciar um atendimento sem um motivo coerente poderá resultar em punições.`,
        ].join("\n"),
        Separator.Default,
        "Clique no botão abaixo para iniciar o seu atendimento.",
        createRow(
          new ButtonBuilder({
            customId: "ticket/form/open",
            label: "Abrir Ticket",
            style: ButtonStyle.Primary,
            emoji: "1502789959378145300",
          }),
        ),
      );

      await (channel as any).send({
        components: [container],
        flags: ["IsComponentsV2"],
      });

      await interaction.reply({
        content: "Painel de tickets enviado com sucesso!",
        flags: ["Ephemeral"],
      });
    }

    if (subcommand === "configurar") {
      const logsChannel = options.getChannel("logs", true);
      const vaultChannel = options.getChannel("vault", true);
      const catSuporte = options.getChannel("cat_suporte", true);
      const catDenuncia = options.getChannel("cat_denuncia", true);
      const catFinanceiro = options.getChannel("cat_financeiro", true);
      const catBugs = options.getChannel("cat_bugs", true);

      await interaction.deferReply({ flags: ["Ephemeral"] });

      try {
        const guildData = await db.guilds.get(guildId!);
        guildData.channels = {
          ...guildData.channels,
          tickets: logsChannel.id,
          vault: vaultChannel.id,
          categories: {
            suporte: catSuporte.id,
            denuncia: catDenuncia.id,
            financeiro: catFinanceiro.id,
            bugs: catBugs.id,
          },
          ticketCategories: guildData.channels?.ticketCategories || ([] as any),
        } as any;
        await (guildData as any).save();

        await interaction.editReply({
          content:
            "✅ Sistema de tickets configurado! Logs e Categorias salvos com sucesso.",
        });
      } catch (error) {
        console.error("Erro na configuração:", error);
        await interaction.editReply({
          content: "Ocorreu um erro ao salvar a configuração.",
        });
      }
    }
  },
});

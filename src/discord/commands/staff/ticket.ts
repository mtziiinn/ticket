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
import { createConfigPanel } from "../../responders/ticket/config.js";

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getCategoryStats(guildId: string) {
  const todayStart = startOfDay();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const [result] = await db.tickets.aggregate([
    { $match: { guildId } },
    {
      $facet: {
        byCategory: [
          {
            $group: {
              _id: { $ifNull: ["$category", "desconhecido"] },
              total: { $sum: 1 },
              today: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", todayStart] }, 1, 0]
                }
              },
              week: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", weekStart] }, 1, 0]
                }
              },
              month: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", monthStart] }, 1, 0]
                }
              }
            }
          }
        ],
        totals: [
          {
            $group: {
              _id: null,
              totalAll: { $sum: 1 },
              totalToday: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", todayStart] }, 1, 0]
                }
              },
              totalWeek: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", weekStart] }, 1, 0]
                }
              },
              totalMonth: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", monthStart] }, 1, 0]
                }
              }
            }
          }
        ]
      }
    }
  ]);

  const stats: Record<string, { today: number; week: number; month: number; total: number }> = {};
  
  if (result && result.byCategory) {
    for (const catData of result.byCategory) {
      stats[catData._id] = {
        today: catData.today,
        week: catData.week,
        month: catData.month,
        total: catData.total,
      };
    }
  }

  const totals = result?.totals?.[0] || { totalToday: 0, totalWeek: 0, totalMonth: 0, totalAll: 0 };

  return {
    stats,
    totalToday: totals.totalToday,
    totalWeek: totals.totalWeek,
    totalMonth: totals.totalMonth,
    totalAll: totals.totalAll,
  };
}


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
      description: "Acessar o painel interativo de configuração do sistema",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "logs",
          description: "Canal de logs (Opcional - pode configurar no painel)",
          type: ApplicationCommandOptionType.Channel,
          required: false,
        },
        {
          name: "vault",
          description: "Canal cofre (Opcional - pode configurar no painel)",
          type: ApplicationCommandOptionType.Channel,
          required: false,
        },
      ],
    },
    {
      name: "stats",
      description: "Exibir estatísticas de tickets",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
  async run(interaction) {
    const { options, guildId, member } = interaction;
    const subcommand = options.getSubcommand();

    // Verificar Permissões (ADM ou Cargo Staff)
    const guildData = await db.guilds.get(guildId!);
    const isAdm = (member as any).permissions.has("Administrator");
    const isStaff =
      guildData.channels?.staffRole &&
      (member as any).roles.cache.has(guildData.channels.staffRole);

    if (!isAdm && !isStaff) {
      await interaction.reply({
        content:
          "❌ Você não possui permissão para usar os comandos de Staff do sistema de tickets.",
        flags: ["Ephemeral"],
      });
      return;
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
      const logsChannel = options.getChannel("logs");
      const vaultChannel = options.getChannel("vault");

      await interaction.deferReply({ flags: ["Ephemeral"] });

      try {
        const guildData = await db.guilds.get(guildId!);

        // Se forneceu opções no comando, já salva elas
        if (logsChannel || vaultChannel) {
          if (!guildData.channels) {
            guildData.channels = {
              tickets: "",
              vault: "",
              categories: {
                suporte: "",
                denuncia: "",
                financeiro: "",
                bugs: "",
              },
              ticketCategories: [] as any,
            } as any;
          }

          if (guildData.channels) {
            if (logsChannel) guildData.channels.tickets = logsChannel.id;
            if (vaultChannel) guildData.channels.vault = vaultChannel.id;
          }
          guildData.markModified("channels");
          await (guildData as any).save();
        }

        const panel = await createConfigPanel(guildId!);

        await interaction.editReply({
          components: [panel],
          flags: ["IsComponentsV2"] as any,
        });
      } catch (error) {
        console.error("Erro na configuração:", error);
        await interaction.editReply({
          content: "Ocorreu um erro ao abrir o painel de configuração.",
        });
      }
    }

    if (subcommand === "stats") {
      await interaction.deferReply({ flags: ["Ephemeral"] });

      const { stats, totalToday, totalWeek, totalMonth, totalAll } = await getCategoryStats(guildId!);

      const categoryLines = Object.entries(stats)
        .sort(([, a], [, b]) => b.total - a.total)
        .map(([cat, s]) => {
          return `> <:folder_open:1502789875928400103> **${cat.toUpperCase()}**\n> <:clock_add:1502789855548276836> Hoje: \`${s.today}\` | <:calendar_check:1502789850649071740> Semana: \`${s.week}\` | <:calendar:1502789854486986752> Mês: \`${s.month}\` | <:database:1502789865023209512> Total: \`${s.total}\``;
        })
        .join("\n\n");

      const container = createContainer(
        constants.colors.azoxo,
        createSection({
          content: `## <:other_ticket:1502789959378145300> Estatísticas de Tickets\nConfira abaixo o resumo completo dos atendimentos do servidor.`,
          thumbnail: emojis.static.other_ticket,
        }),
        Separator.Default,
        "### <:clock:1502789859960422502> Períodos",
        [
          `<:clock_add:1502789855548276836> **Hoje:** \`${totalToday}\` tickets`,
          `<:calendar_check:1502789850649071740> **Semana:** \`${totalWeek}\` tickets`,
          `<:calendar:1502789854486986752> **Mês:** \`${totalMonth}\` tickets`,
          `<:database:1502789865023209512> **Total:** \`${totalAll}\` tickets`,
        ].join("\n"),
        Separator.Default,
        "### <:folder_open:1502789875928400103> Por Categoria",
        categoryLines || "*Nenhum ticket encontrado.*",
      );

      await interaction.editReply({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    }
  },
});

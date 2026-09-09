import { createCommand } from "#base";
import {
  createContainer,
  createSection,
  Separator,
} from "@magicyan/discord";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";
import { db } from "#database";
import { clearBotCache, getEmojiTag } from "#functions";

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
                  $cond: [{ $gte: ["$openedAt", todayStart] }, 1, 0],
                },
              },
              week: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", weekStart] }, 1, 0],
                },
              },
              month: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", monthStart] }, 1, 0],
                },
              },
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              totalAll: { $sum: 1 },
              totalToday: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", todayStart] }, 1, 0],
                },
              },
              totalWeek: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", weekStart] }, 1, 0],
                },
              },
              totalMonth: {
                $sum: {
                  $cond: [{ $gte: ["$openedAt", monthStart] }, 1, 0],
                },
              },
            },
          },
        ],
      },
    },
  ]);

  const stats: Record<
    string,
    { today: number; week: number; month: number; total: number }
  > = {};

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

  const totals = result?.totals?.[0] || {
    totalToday: 0,
    totalWeek: 0,
    totalMonth: 0,
    totalAll: 0,
  };

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
      name: "stats",
      description: "Exibir estatísticas de tickets",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "limpar-cache",
      description: "Limpa a memória RAM e o cache temporário do bot",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "ram",
      description: "Exibe diagnóstico detalhado de consumo de memória RAM e uptime",
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
          `${getEmojiTag("action_x")} Você não possui permissão para usar os comandos de Staff do sistema de tickets.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    if (subcommand === "stats") {
      await interaction.deferReply({ flags: ["Ephemeral"] });

      const { stats, totalToday, totalWeek, totalMonth, totalAll } =
        await getCategoryStats(guildId!);

      const categoryLines = Object.entries(stats)
        .sort(([, a], [, b]) => b.total - a.total)
        .map(([cat, s]) => {
          return `> ${getEmojiTag("folder_open")} **${cat.toUpperCase()}**\n> ${getEmojiTag("clock_add")} Hoje: \`${s.today}\` | ${getEmojiTag("calendar_check")} Semana: \`${s.week}\` | ${getEmojiTag("calendar")} Mês: \`${s.month}\` | ${getEmojiTag("database")} Total: \`${s.total}\``;
        })
        .join("\n\n");

      const container = createContainer(
        constants.colors.azoxo,
        createSection({
          content: `## ${getEmojiTag("prism")} Estatísticas de Tickets • ${brand.brandName}\nConfira abaixo o resumo completo dos atendimentos do servidor.`,
          thumbnail: emojis.static.prism || emojis.static.other_ticket,
        }),
        Separator.Default,
        `### ${getEmojiTag("clock")} Períodos`,
        [
          `${getEmojiTag("clock_add")} **Hoje:** \`${totalToday}\` tickets`,
          `${getEmojiTag("calendar_check")} **Semana:** \`${totalWeek}\` tickets`,
          `${getEmojiTag("calendar")} **Mês:** \`${totalMonth}\` tickets`,
          `${getEmojiTag("database")} **Total:** \`${totalAll}\` tickets`,
        ].join("\n"),
        Separator.Default,
        `### ${getEmojiTag("folder_open")} Por Categoria`,
        categoryLines || "*Nenhum ticket encontrado.*",
      );

      await interaction.editReply({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    }

    if (subcommand === "limpar-cache") {
      await interaction.deferReply({ flags: ["Ephemeral"] });

      const result = clearBotCache(interaction.client, true);

      const resourcesList = [
        `${getEmojiTag("file_check")} **Mensagens liberadas:** \`${result.messagesSwept}\``,
        `${getEmojiTag("user_check")} **Usuários limpos do cache:** \`${result.usersSwept}\``,
        `${getEmojiTag("user_users")} **Membros limpos do cache:** \`${result.membersSwept}\``,
      ];

      if (result.voiceStatesSwept > 0) {
        resourcesList.push(
          `${getEmojiTag("action_info")} **Estados de voz liberados:** \`${result.voiceStatesSwept}\``,
        );
      }
      if (result.captchasSwept > 0) {
        resourcesList.push(
          `${getEmojiTag("clock_check")} **Captchas expirados eliminados:** \`${result.captchasSwept}\``,
        );
      }
      if (result.guildConfigsSwept > 0) {
        resourcesList.push(
          `${getEmojiTag("database_check")} **Configurações de servidores recicladas:** \`${result.guildConfigsSwept}\``,
        );
      }

      const container = createContainer(
        constants.colors.azoxo,
        createSection({
          content: `## ${getEmojiTag("database")} Limpeza de Cache Concluída\nO cache temporário e a memória RAM foram limpos com sucesso para otimizar o consumo na hospedagem.`,
          thumbnail: (emojis.static.prism || interaction.client.user?.displayAvatarURL()) as any,
        }),
        Separator.Default,
        `### ${getEmojiTag("clock_check")} Recursos Liberados`,
        resourcesList.join("\n"),
        Separator.Default,
        `### ${getEmojiTag("database_check")} Consumo de Memória`,
        [
          `${getEmojiTag("database")} **Heap Utilizado:** \`${result.heapUsedAfterMB} MB\` *(era \`${result.heapUsedBeforeMB} MB\`)*`,
          `${getEmojiTag("action_check")} **Memória Liberada:** \`${result.heapDiffMB} MB\``,
          `${getEmojiTag("cloud_check")} **Processo RSS Total:** \`${result.rssAfterMB} MB\``,
        ].join("\n"),
        Separator.Default,
        `${getEmojiTag("action_info")} *O sistema também executa limpezas automáticas de cache a cada 20 minutos, mantendo apenas o essencial para as respostas serem rápidas.*`,
      );

      await interaction.editReply({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    }

    if (subcommand === "ram") {
      await interaction.deferReply({ flags: ["Ephemeral"] });

      const mem = process.memoryUsage();
      const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

      const heapPercent = ((mem.heapUsed / mem.heapTotal) * 100).toFixed(1);

      const container = createContainer(
        constants.colors.azoxo,
        createSection({
          content: `## ${getEmojiTag("database")} Diagnóstico de Memória & Saúde\nMonitoramento de telemetria do processo Node.js na hospedagem.`,
          thumbnail: (emojis.static.prism || interaction.client.user?.displayAvatarURL()) as any,
        }),
        Separator.Default,
        `### ${getEmojiTag("clock")} Tempo de Atividade (Uptime)`,
        `| ${getEmojiTag("clock_add")} **Uptime do Processo:** \`${uptimeStr}\`\n| ${getEmojiTag("prism")} **Bot:** \`${brand.brandName} Tickets\` | **Node.js:** \`${process.version}\` (\`${process.platform}\`)`,
        Separator.Default,
        `### ${getEmojiTag("database_check")} Alocação de Memória (RAM)`,
        [
          `${getEmojiTag("cloud_check")} **RSS Total do Processo:** \`${toMB(mem.rss)} MB\` *(limite container: 200 MB)*`,
          `${getEmojiTag("database")} **Heap Utilizado:** \`${toMB(mem.heapUsed)} MB\` / \`${toMB(mem.heapTotal)} MB\` (\`${heapPercent}%\`)`,
          `${getEmojiTag("action_info")} **Memória Externa (C++/Buffers):** \`${toMB(mem.external)} MB\``,
          `${getEmojiTag("file_check")} **ArrayBuffers:** \`${toMB(mem.arrayBuffers || 0)} MB\``,
        ].join("\n"),
        Separator.Default,
        `*Dica: Use \`/ticket limpar-cache\` se desejar forçar a reciclagem imediata e Garbage Collection.*`,
      );

      await interaction.editReply({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    }
  },
});

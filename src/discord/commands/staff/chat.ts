import { createCommand } from "#base";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { createContainer } from "@magicyan/discord";
import { getEmojiTag } from "#functions";

createCommand({
  name: "chat",
  description: "Comandos de moderação e gerenciamento do chat",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.ManageChannels,
  options: [
    {
      name: "bloquear",
      description: "Bloqueia o canal atual para que apenas administradores enviem mensagens",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "desbloquear",
      description: "Desbloqueia o canal atual para que todos possam enviar mensagens",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "limpar",
      description: "Limpa uma quantidade de mensagens do chat atual (1 a 100)",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "quantidade",
          description: "Quantidade de mensagens a serem apagadas (1 a 100)",
          type: ApplicationCommandOptionType.Integer,
          minValue: 1,
          maxValue: 100,
          required: true,
        },
      ],
    },
  ],
  async run(interaction) {
    if (!interaction.inCachedGuild()) return;
    const channel = interaction.channel;

    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.reply({
        content: `${getEmojiTag("action_warning")} Este comando só pode ser executado em canais de texto!`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "bloquear") {
      try {
        await channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: false,
          },
        );

        const container = createContainer(
          "#ED4245",
          `| ${getEmojiTag("lock")} **Chat Bloqueado:**\nEste canal foi bloqueado por <@${interaction.user.id}>. Apenas a equipe pode enviar mensagens no momento.`,
        );

        await interaction.reply({
          components: [container],
          flags: ["IsComponentsV2"] as any,
        });
      } catch (err) {
        console.error("[chat bloquear] Erro:", err);
        await interaction.reply({
          content: `${getEmojiTag("action_x")} Erro ao bloquear o canal. Verifique se o bot possui permissão de Gerenciar Canais.`,
          flags: ["Ephemeral"],
        });
      }
      return;
    }

    if (subcommand === "desbloquear") {
      try {
        await channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: null,
          },
        );

        const container = createContainer(
          "#22c55e",
          `| ${getEmojiTag("unlock")} **Chat Desbloqueado:**\nEste canal foi liberado por <@${interaction.user.id}>. Todos os membros podem digitar novamente.`,
        );

        await interaction.reply({
          components: [container],
          flags: ["IsComponentsV2"] as any,
        });
      } catch (err) {
        console.error("[chat desbloquear] Erro:", err);
        await interaction.reply({
          content: `${getEmojiTag("action_x")} Erro ao desbloquear o canal. Verifique se o bot possui permissão de Gerenciar Canais.`,
          flags: ["Ephemeral"],
        });
      }
      return;
    }

    if (subcommand === "limpar") {
      const amount = interaction.options.getInteger("quantidade", true);

      await interaction.deferReply({ flags: ["Ephemeral", "IsComponentsV2"] as any });

      try {
        const deleted = await channel.bulkDelete(amount, true);

        const container = createContainer(
          "#22c55e",
          `| ${getEmojiTag("file_remove")} **Limpeza Concluída:**\nForam apagadas com sucesso \`${deleted.size}\` mensagens deste canal.`,
        );

        await interaction.editReply({
          components: [container],
          flags: ["IsComponentsV2"] as any,
        });
      } catch (err) {
        console.error("[chat limpar] Erro:", err);
        await interaction.editReply({
          content: `${getEmojiTag("action_x")} Erro ao apagar mensagens. Lembre-se que mensagens com mais de 14 dias não podem ser apagadas em massa pelo Discord.`,
        });
      }
    }
  },
});

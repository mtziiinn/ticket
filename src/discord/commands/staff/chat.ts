import { createCommand } from "#base";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { createContainer } from "@magicyan/discord";

// 1. Comando /bloquear-chat
createCommand({
  name: "bloquear-chat",
  description:
    "Bloqueia o chat atual para que apenas administradores possam enviar mensagens.",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.ManageChannels,
  async run(interaction) {
    if (!interaction.inCachedGuild()) return;
    const channel = interaction.channel;

    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.reply({
        content: "⚠️ Este comando só pode ser executado em canais de texto!",
        flags: ["Ephemeral"],
      });
      return;
    }

    try {
      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: false,
        },
      );

      const container = createContainer(
        "#ED4245",
        `| 🔒 **Chat Bloqueado:**\nEste canal foi bloqueado por <@${interaction.user.id}>. Apenas a equipe pode enviar mensagens no momento.`,
      );

      await interaction.reply({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    } catch (err) {
      console.error("[bloquear-chat] Erro:", err);
      await interaction.reply({
        content:
          "❌ Erro ao bloquear o canal. Verifique se o bot possui permissão de Gerenciar Canais.",
        flags: ["Ephemeral"],
      });
    }
  },
});

// 2. Comando /desbloquear-chat
createCommand({
  name: "desbloquear-chat",
  description:
    "Desbloqueia o chat atual para que todos possam enviar mensagens.",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.ManageChannels,
  async run(interaction) {
    if (!interaction.inCachedGuild()) return;
    const channel = interaction.channel;

    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.reply({
        content: "⚠️ Este comando só pode ser executado em canais de texto!",
        flags: ["Ephemeral"],
      });
      return;
    }

    try {
      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: null,
        },
      );

      const container = createContainer(
        "#22c55e",
        `| 🔓 **Chat Desbloqueado:**\nEste canal foi liberado por <@${interaction.user.id}>. Todos os membros podem digitar novamente.`,
      );

      await interaction.reply({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    } catch (err) {
      console.error("[desbloquear-chat] Erro:", err);
      await interaction.reply({
        content:
          "❌ Erro ao desbloquear o canal. Verifique se o bot possui permissão de Gerenciar Canais.",
        flags: ["Ephemeral"],
      });
    }
  },
});

// 3. Comando /limpar-chat
createCommand({
  name: "limpar-chat",
  description: "Limpa uma quantidade de mensagens do chat atual.",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
  options: [
    {
      name: "quantidade_mensagens",
      description: "Quantidade de mensagens a serem apagadas (1 a 100).",
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 100,
      required: true,
    },
  ],
  async run(interaction) {
    if (!interaction.inCachedGuild()) return;
    const channel = interaction.channel;

    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.reply({
        content: "⚠️ Este comando só pode ser executado em canais de texto!",
        flags: ["Ephemeral"],
      });
      return;
    }

    const amount = interaction.options.getInteger(
      "quantidade_mensagens",
      true,
    );

    await interaction.deferReply({ flags: ["Ephemeral"] });

    try {
      const deleted = await channel.bulkDelete(amount, true);

      const container = createContainer(
        "#22c55e",
        `| 🧹 **Limpeza Concluída:**\nForam apagadas com sucesso \`${deleted.size}\` mensagens deste canal.`,
      );

      await interaction.editReply({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    } catch (err) {
      console.error("[limpar-chat] Erro:", err);
      await interaction.editReply({
        content:
          "❌ Erro ao apagar mensagens. Lembre-se que mensagens com mais de 14 dias não podem ser apagadas em massa pelo Discord.",
      });
    }
  },
});

import { createCommand } from "#base";
import { ApplicationCommandType, PermissionFlagsBits } from "discord.js";
import { renderHomeTab } from "../../responders/panel/panelView.js";

createCommand({
  name: "painel",
  description: "Exibe o painel completo de configuração do BOT.",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  async run(interaction) {
    if (!interaction.inCachedGuild()) return;

    await interaction.deferReply({ flags: ["Ephemeral"] });

    try {
      const container = await renderHomeTab(
        interaction.guild,
        interaction.client,
      );

      await interaction.editReply({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    } catch (err) {
      console.error("[Painel] Erro ao renderizar painel:", err);
      await interaction.editReply({
        content: "❌ Ocorreu um erro ao carregar o painel de configurações.",
      });
    }
  },
});

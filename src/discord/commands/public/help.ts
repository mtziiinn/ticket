import { createCommand } from "#base";
import {
  createContainer,
  createSection,
  Separator,
} from "@magicyan/discord";
import { ApplicationCommandType } from "discord.js";

createCommand({
  name: "help",
  description: "Exibe a lista de comandos disponíveis",
  type: ApplicationCommandType.ChatInput,
  async run(interaction) {
    const container = createContainer(
      constants.colors.azoxo,
      createSection({
        content: `## <:other_ticket:1502789959378145300> Central de Ajuda\nConfira abaixo todos os comandos disponíveis do sistema.`,
        thumbnail: emojis.static.other_ticket,
      }),
      Separator.Default,
      "### <:shield_check:1502789932727668788> Comandos da Equipe",
      [
        `<:action_info:1502789798983766016> \`/ticket painel\` — Envia o painel de abertura em um canal`,
        `<:folder:1502789880214720533> \`/ticket configurar\` — Abre o painel interativo de configuração`,
        `<:database:1502789865023209512> \`/ticket stats\` — Exibe estatísticas de tickets`,
        `<:file_add:1502789905112105071> **Entrega de Mídia:** Botão "Entregar Mídia" no painel admin gera link de upload`,
      ].join("\n"),
      Separator.Default,
      "### <:other_terminal:1502789958430232688> Comandos Públicos",
      [
        `<:action_question:1502789799969296454> \`/help\` — Mostra esta mensagem`,
      ].join("\n"),
      Separator.Default,
      "### <:action_warning:1502789801949265990> Status e Prioridade",
      "Ao alterar o status do pedido, o ticket é reposicionado automaticamente na categoria por ordem de prioridade (Pagamento > Produção > Aberto > Fila > Concluído).",
      Separator.Default,
      "### <:other_megaphone:1502789956312236092> Dúvidas?",
      "Caso precise de suporte, contate um membro da equipe.",
    );

    await interaction.reply({
      components: [container],
      flags: ["Ephemeral", "IsComponentsV2"],
    });
  },
});

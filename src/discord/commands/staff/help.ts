import { createCommand } from "#base";
import { ApplicationCommandType } from "discord.js";
import { createContainer, createSection, Separator } from "@magicyan/discord";
import { getEmojiTag } from "#functions";

createCommand({
  name: "help",
  description: "Central de ajuda com todos os comandos do bot",
  type: ApplicationCommandType.ChatInput,
  async run(interaction) {
    const header = `## ${getEmojiTag("action_info")} Central de Comandos • PR1SM\nConfira abaixo os comandos disponíveis. Todas as respostas são **efêmeras** (apenas você enxerga).`;

    const pagamentos = [
      `${getEmojiTag("other_dollar")} **${getEmojiTag("other_wallet")} \`/gerar-pagamento\`** — Gera uma cobrança (PIX, Mercado Pago ou Stripe) para um cliente.`,
      `${getEmojiTag("other_dollar")} **${getEmojiTag("user")} \`/meu-pagamento\`** — Configura as suas chaves individuais de pagamento (PIX, Mercado Pago, Stripe).`,
    ].join("\n");

    const sistema = [
      `${getEmojiTag("action_check")} **\`/painel\`** — Abre o painel completo de configuração do bot.`,
      `${getEmojiTag("clock_add")} **\`/ticket stats\`** — Estatísticas de atendimentos por período e categoria.`,
      `${getEmojiTag("database")} **\`/ticket ram\`** — Diagnóstico detalhado de memória RAM e uptime.`,
      `${getEmojiTag("file_check")} **\`/ticket limpar-cache\`** — Limpa o cache e a memória do bot.`,
      `${getEmojiTag("lock")} **\`/chat\`** — Moderação do chat: \`bloquear\`, \`desbloquear\` e \`limpar\`.`,
      `${getEmojiTag("other_megaphone")} **\`/anunciar\`** — Cria e publica um comunicado oficial (canal e/ou DM).`,
      `${getEmojiTag("calendar_check")} **\`/giveaway\`** — Inicia um sorteio interativo no canal.`,
    ].join("\n");

    const container = createContainer(
      constants.colors.primary,
      createSection({
        content: header,
        thumbnail: emojis.static.prism || emojis.static.other_bot,
      }),
      Separator.Default,
      `### ${getEmojiTag("other_ticket")} Atendimento\nPara abrir um ticket, utilize os **botões / menus** do painel de atendimento configurado pela equipe e escolha a categoria do seu assunto.`,
      Separator.Default,
      `### ${getEmojiTag("other_dollar")} Pagamentos\n${pagamentos}`,
      Separator.Default,
      `### ${getEmojiTag("shield")} Sistema & Moderação\n${sistema}`,
      Separator.Default,
      `*Precisa de ajuda? Abra um ticket pelo painel de atendimento — a equipe vai te atender!*`,
    );

    await interaction.reply({
      components: [container],
      flags: ["Ephemeral", "IsComponentsV2"] as any,
    });
  },
});
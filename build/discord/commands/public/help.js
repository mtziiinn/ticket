import { createCommand } from "#base";
import { createContainer, createSection, Separator, } from "@magicyan/discord";
import { ApplicationCommandType } from "discord.js";
import { getEmojiTag } from "#functions";
createCommand({
    name: "help",
    description: "Exibe a lista de comandos disponíveis",
    type: ApplicationCommandType.ChatInput,
    async run(interaction) {
        const container = createContainer(constants.colors.azoxo, createSection({
            content: `## ${getEmojiTag("other_ticket")} Central de Ajuda\nConfira abaixo todos os comandos disponíveis do sistema.`,
            thumbnail: emojis.static.other_ticket,
        }), Separator.Default, `### ${getEmojiTag("shield_check")} Comandos de Gestão e Configuração`, [
            `${getEmojiTag("other_bot")} \`/painel\` — Painel completo de gestão (Tickets, Verificação, Gateways e Sorteios)`,
            `${getEmojiTag("database")} \`/ticket stats\` — Exibe estatísticas completas de atendimentos`,
            `${getEmojiTag("clock_check")} \`/ticket limpar-cache\` — Limpa a memória RAM e cache temporário`,
            `${getEmojiTag("other_dollar")} \`/gerar-pagamento\` — Gera uma cobrança avulsa via Pix/Cartão`,
            `${getEmojiTag("other_ticket")} \`/criar-sorteio\` — Cria um sorteio interativo`,
            `${getEmojiTag("lock")} \`/bloquear-chat\` / \`/desbloquear-chat\` — Tranca ou destranca o canal atual`,
        ].join("\n"), Separator.Default, `### ${getEmojiTag("other_terminal")} Comandos Públicos`, [
            `${getEmojiTag("action_question")} \`/help\` — Exibe este menu informativo`,
        ].join("\n"), Separator.Default, `### ${getEmojiTag("action_warning")} Status e Prioridade`, "Ao alterar o status do pedido, o ticket é reposicionado automaticamente na categoria por ordem de prioridade (Pagamento > Produção > Aberto > Fila > Concluído).", Separator.Default, `### ${getEmojiTag("other_megaphone")} Dúvidas?`, "Caso precise de suporte, contate um membro da equipe.");
        await interaction.reply({
            components: [container],
            flags: ["Ephemeral", "IsComponentsV2"],
        });
    },
});

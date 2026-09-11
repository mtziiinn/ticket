import { createCommand } from "#base";
import { ApplicationCommandOptionType, ApplicationCommandType, PermissionFlagsBits, } from "discord.js";
import { createContainer, Separator } from "@magicyan/discord";
import { db } from "#database";
import { MONTHLY_BILLING_CONFIG, getCurrentMonthYear, getBrasiliaDate, sendMonthlyBillingDM, getEmojiTag, } from "#functions";
createCommand({
    name: "mensalidade",
    description: "📅 Gerencia e testa as cobranças automáticas mensais dos clientes.",
    type: ApplicationCommandType.ChatInput,
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    options: [
        {
            name: "status",
            description: "Visualiza o status das cobranças mensais e a próxima data de envio.",
            type: ApplicationCommandOptionType.Subcommand,
        },
        {
            name: "disparar",
            description: "Envia a cobrança de teste na DM de um cliente ou de você mesmo.",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "cliente",
                    description: "Membro para quem enviar a cobrança na DM.",
                    type: ApplicationCommandOptionType.User,
                    required: false,
                },
            ],
        },
    ],
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        const sub = interaction.options.getSubcommand();
        const brandColor = typeof brand !== "undefined" && brand.primaryColor
            ? brand.primaryColor
            : "#38bdf8";
        if (sub === "status") {
            await interaction.deferReply({ flags: ["Ephemeral"] });
            const now = getBrasiliaDate();
            const currentMonthYear = getCurrentMonthYear(now);
            // Calcular a próxima data de cobrança (sempre dia 06)
            const nextDate = new Date(now.getFullYear(), now.getMonth(), 6);
            if (now.getDate() >= 6) {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
            const nextDateFormatted = `06/${(nextDate.getMonth() + 1).toString().padStart(2, "0")}/${nextDate.getFullYear()}`;
            const clientStatuses = [];
            for (const c of MONTHLY_BILLING_CONFIG.clients) {
                const billed = await db.monthlyBillings.findOne({
                    userId: c.id,
                    monthYear: currentMonthYear,
                });
                const statusTag = billed
                    ? `${getEmojiTag("action_check") || "✅"} Cobrado em ${billed.sentAt.toLocaleDateString("pt-BR")}`
                    : `${getEmojiTag("clock") || "⏳"} Pendente para ${nextDateFormatted}`;
                clientStatuses.push(`| • <@${c.id}> (**${c.name}**)\n| ↳ Status (${currentMonthYear}): ${statusTag}`);
            }
            const container = createContainer(brandColor, `## ${getEmojiTag("other_dollar") || "🟢"} Cobrança Automática Mensal • Status`, Separator.Default, [
                `| **Titular Recebedor:** ${MONTHLY_BILLING_CONFIG.beneficiaryName}`,
                `| **Chave PIX:** \`${MONTHLY_BILLING_CONFIG.pixKey}\` (${MONTHLY_BILLING_CONFIG.pixType})`,
                `| **Valor Mensal:** \`R$ ${MONTHLY_BILLING_CONFIG.amount.toFixed(2).replace(".", ",")}\``,
                `| **Dia do Vencimento:** Todo dia 06`,
                `| **Próximo Disparo Automático:** **${nextDateFormatted}**`,
            ].join("\n"), Separator.Default, `### Clientes Cadastrados:\n${clientStatuses.join("\n\n")}`, Separator.Default, `*Use \`/mensalidade disparar\` para enviar uma cobrança de teste na DM.*`);
            await interaction.editReply({
                components: [container],
                flags: ["IsComponentsV2"],
            });
            return;
        }
        if (sub === "disparar") {
            await interaction.deferReply({ flags: ["Ephemeral"] });
            const targetUser = interaction.options.getUser("cliente") || interaction.user;
            const matchedConfig = MONTHLY_BILLING_CONFIG.clients.find((c) => c.id === targetUser.id);
            const clientConfig = matchedConfig || {
                id: targetUser.id,
                name: targetUser.username,
            };
            const result = await sendMonthlyBillingDM(interaction.client, clientConfig, {
                isTest: true,
            });
            if (!result.success) {
                await interaction.editReply({
                    content: `${getEmojiTag("action_x") || "❌"} Falha ao enviar na DM de <@${targetUser.id}>: ${result.error}`,
                });
                return;
            }
            await interaction.editReply({
                content: `${getEmojiTag("action_check") || "✅"} Cobrança de teste enviada com sucesso para a DM de <@${targetUser.id}>!`,
            });
        }
    },
});

import { createEvent } from "#base";
import { ActivityType } from "discord.js";
import { db } from "#database";
import { finishGiveaway } from "../commands/staff/giveaway.js";
import { checkAndProcessMonthlyBillings, checkPendingMonthlyPayments, checkAndSendPaymentReminders, checkAndEnforceShutdown, sendStartupWebhook, } from "#functions";
createEvent({
    name: "ready",
    event: "ready",
    once: true,
    async run(client) {
        sendStartupWebhook(client).catch(() => { });
        const statuses = brand.presence?.length > 0
            ? brand.presence
            : [`💻 Desenvolvido para ${brand.brandName}`];
        let i = 0;
        client.user?.setPresence({
            status: "dnd",
            activities: [{ name: statuses[0], type: ActivityType.Custom }],
        });
        setInterval(() => {
            i = (i + 1) % statuses.length;
            client.user?.setPresence({
                status: "dnd",
                activities: [{ name: statuses[i], type: ActivityType.Custom }],
            });
        }, 60000); // Rotação a cada 1 minuto (economiza ciclos de CPU e conexões de Gateway)
        // Verificação automática de sorteios a cada 30 segundos
        setInterval(async () => {
            try {
                const expiredGiveaways = await db.giveaways.find({
                    ended: false,
                    endsAt: { $lte: new Date() },
                });
                for (const g of expiredGiveaways) {
                    await finishGiveaway(g, client);
                }
            }
            catch (err) {
                console.error("[Giveaway Sweep] Erro:", err);
            }
        }, 30000);
        // Sincronizar bio (descrição da aplicação) do bot
        try {
            const defaultBio = brand.appBio;
            await client.application?.fetch();
            if (client.application && client.application.description !== defaultBio) {
                await client.application.edit({ description: defaultBio }).catch(() => { });
            }
        }
        catch (err) {
            console.error("[Ready] Erro ao sincronizar bio do bot:", err);
        }
        // Verificação periódica de cobranças mensais (a cada 1 hora)
        checkAndProcessMonthlyBillings(client).catch((err) => console.error("[Ready] Erro na checagem inicial de cobrança mensal:", err));
        setInterval(() => {
            checkAndProcessMonthlyBillings(client).catch((err) => console.error("[Interval] Erro na checagem de cobrança mensal:", err));
        }, 60 * 60 * 1000);
        // Lembrete pra quem foi cobrado e ainda não pagou (a cada 6 horas — a
        // funcao so manda de fato quando reminderIntervalDays ja passou desde
        // o ultimo toque, entao rodar com essa frequencia so deixa o atraso
        // maximo entre "passou o prazo" e "lembrete chega" bem curto)
        checkAndSendPaymentReminders(client).catch((err) => console.error("[Ready] Erro na checagem inicial de lembretes:", err));
        setInterval(() => {
            checkAndSendPaymentReminders(client).catch((err) => console.error("[Interval] Erro na checagem de lembretes:", err));
        }, 6 * 60 * 60 * 1000);
        // Desligamento automático se TODOS os clientes ficarem inadimplentes
        // por shutdownAfterDays dias seguidos (a cada 1 hora — nao precisa de
        // mais frequencia que isso pra um prazo medido em dias)
        checkAndEnforceShutdown(client).catch((err) => console.error("[Ready] Erro na checagem inicial de desligamento:", err));
        setInterval(() => {
            checkAndEnforceShutdown(client).catch((err) => console.error("[Interval] Erro na checagem de desligamento:", err));
        }, 60 * 60 * 1000);
        // Verificação automática de pagamentos pendentes do Mercado Pago (a cada 2 minutos)
        checkPendingMonthlyPayments(client).catch((err) => console.error("[Ready] Erro na checagem de PIX pendente:", err));
        setInterval(() => {
            checkPendingMonthlyPayments(client).catch((err) => console.error("[Interval] Erro na checagem periódica de PIX pendente:", err));
        }, 2 * 60 * 1000);
    },
});

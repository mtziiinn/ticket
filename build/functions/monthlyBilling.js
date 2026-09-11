import { createContainer, createMediaGallery, Separator, } from "@magicyan/discord";
import { db } from "#database";
import { generatePixPayload, getEmojiTag, safeSendDM } from "./index.js";
export const MONTHLY_BILLING_CONFIG = {
    beneficiaryName: "Matheus Gonçalves",
    pixKey: "matheusgoncalves1502@gmail.com",
    pixType: "E-mail",
    amount: 15.0,
    dueDay: 6,
    developerId: "1061397602916126771",
    clients: [
        {
            id: "403271714437595137",
            name: "Luiza",
        },
    ],
};
/**
 * Retorna a data atual no fuso horário de Brasília (America/Sao_Paulo).
 */
export function getBrasiliaDate() {
    const now = new Date();
    const utcOffset = now.getTime() + now.getTimezoneOffset() * 60000;
    // Brasília é UTC-3
    return new Date(utcOffset - 3 * 3600000);
}
/**
 * Retorna a string do mês/ano no formato "YYYY-MM" (ex: "2026-10").
 */
export function getCurrentMonthYear(date = getBrasiliaDate()) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${year}-${month}`;
}
/**
 * Constrói o container visual da fatura mensal no formato Components V2.
 */
export function buildMonthlyBillingContainer(user, clientName, monthYear, pixPayload) {
    const [year, month] = monthYear.split("-");
    const formattedPeriod = `${month}/${year}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(pixPayload)}`;
    const brandColor = typeof brand !== "undefined" && brand.primaryColor
        ? brand.primaryColor
        : "#38bdf8";
    const container = createContainer(brandColor, `## ${getEmojiTag("other_dollar") || "🟢"} Fatura Mensal • Manutenção & Hospedagem`, Separator.Default, [
        `Olá <@${user.id}>! A fatura de manutenção e hospedagem do seu bot referente a **${formattedPeriod}** está disponível para pagamento.`,
        "",
        `| **Cliente:** <@${user.id}> (${clientName})`,
        `| **Serviço:** Hospedagem 24/7 & Manutenção do Bot`,
        `| **Vencimento:** Dia 06/${month}/${year}`,
        `| **Valor:** \`R$ ${MONTHLY_BILLING_CONFIG.amount.toFixed(2).replace(".", ",")}\``,
        `| **Beneficiário:** ${MONTHLY_BILLING_CONFIG.beneficiaryName} (<@${MONTHLY_BILLING_CONFIG.developerId}>)`,
    ].join("\n"), Separator.Default, [
        `### ${getEmojiTag("other_card") || "💳"} Dados para Pagamento (PIX)`,
        `| **Tipo de Chave:** ${MONTHLY_BILLING_CONFIG.pixType}`,
        `| **Chave PIX:** \`${MONTHLY_BILLING_CONFIG.pixKey}\``,
        `| **Titular:** ${MONTHLY_BILLING_CONFIG.beneficiaryName}`,
        "",
        `| **Código PIX Copia e Cola (Valor R$ 15,00 pré-definido):**`,
        `\`\`\`text\n${pixPayload}\n\`\`\``,
    ].join("\n"), Separator.Default, createMediaGallery(qrCodeUrl), Separator.Default, `*Após efetuar o pagamento, por gentileza envie o comprovante para <@${MONTHLY_BILLING_CONFIG.developerId}> (@mtzin7.rp) para confirmação da renovação mensal.*`);
    return container;
}
/**
 * Envia a cobrança mensal para a DM de um cliente específico.
 */
export async function sendMonthlyBillingDM(client, clientConfig, options = {}) {
    try {
        const user = await client.users.fetch(clientConfig.id).catch(() => null);
        if (!user) {
            return {
                success: false,
                error: `Não foi possível encontrar o usuário ${clientConfig.id} (${clientConfig.name}).`,
            };
        }
        const monthYear = options.monthYear || getCurrentMonthYear();
        const pixPayload = generatePixPayload(MONTHLY_BILLING_CONFIG.pixKey, MONTHLY_BILLING_CONFIG.beneficiaryName, "SAO PAULO", MONTHLY_BILLING_CONFIG.amount);
        const container = buildMonthlyBillingContainer(user, clientConfig.name, monthYear, pixPayload);
        const sent = await safeSendDM(user, {
            components: [container],
            flags: ["IsComponentsV2"],
        }, `Monthly Billing - ${clientConfig.name}`);
        if (!sent) {
            return {
                success: false,
                error: `A DM de <@${clientConfig.id}> está fechada ou bloqueada.`,
            };
        }
        // Salvar registro no banco
        if (!options.isTest) {
            await db.monthlyBillings.findOneAndUpdate({ userId: clientConfig.id, monthYear }, {
                userId: clientConfig.id,
                clientName: clientConfig.name,
                botName: typeof brand !== "undefined" ? brand.brandName : "Prism",
                monthYear,
                amount: MONTHLY_BILLING_CONFIG.amount,
                pixPayload,
                status: "sent",
                sentAt: new Date(),
                isTest: false,
            }, { upsert: true, new: true });
        }
        console.log(`[Monthly Billing] Fatura ${monthYear} enviada com sucesso para ${clientConfig.name} (${clientConfig.id}).`);
        return { success: true };
    }
    catch (err) {
        console.error(`[Monthly Billing] Erro ao enviar fatura para ${clientConfig.id}:`, err);
        return { success: false, error: err?.message || String(err) };
    }
}
/**
 * Rotina periódica de verificação e disparo das cobranças mensais.
 * Regra estrita: Dispara apenas no DIA 06 de cada mês.
 */
export async function checkAndProcessMonthlyBillings(client) {
    try {
        const brasiliaDate = getBrasiliaDate();
        const currentDay = brasiliaDate.getDate();
        // Dispara apenas no dia 6 de cada mês
        if (currentDay !== MONTHLY_BILLING_CONFIG.dueDay) {
            return;
        }
        const currentMonthYear = getCurrentMonthYear(brasiliaDate);
        for (const clientConfig of MONTHLY_BILLING_CONFIG.clients) {
            // Verifica se já foi cobrado neste mês
            const existing = await db.monthlyBillings.findOne({
                userId: clientConfig.id,
                monthYear: currentMonthYear,
            });
            if (existing) {
                continue;
            }
            await sendMonthlyBillingDM(client, clientConfig, {
                monthYear: currentMonthYear,
                isTest: false,
            });
        }
    }
    catch (error) {
        console.error("[Monthly Billing] Erro na verificação periódica:", error);
    }
}

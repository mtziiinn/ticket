import {
  ButtonBuilder,
  ButtonStyle,
  Client,
  User,
} from "discord.js";
import {
  createContainer,
  createMediaGallery,
  createRow,
  Separator,
} from "@magicyan/discord";
import { db } from "#database";
import { getEmojiId, getEmojiTag, safeSendDM } from "./index.js";

export interface MonthlyClientConfig {
  id: string;
  name: string;
}

export const MONTHLY_BILLING_CONFIG = {
  beneficiaryName: "Matheus Gonçalves",
  pixKey: "matheusgoncalves1502@gmail.com",
  pixType: "E-mail",
  amount: 15.0,
  dueDay: 6,
  // Dia fixo do mes (nao "dias desde o envio") em que quem ainda deve
  // recebe o lembrete. checkAndSendPaymentReminders so age a partir
  // desse dia, uma vez por mes por cliente.
  reminderDay: 8,
  // Dia fixo do mes em que o bot se desliga sozinho se NINGUÉM da lista
  // tiver pago ainda (checkAndEnforceShutdown). So conta se TODOS os
  // clientes estiverem inadimplentes ao mesmo tempo — um pagamento em dia
  // de qualquer um deles ja cancela o desligamento.
  shutdownDay: 10,
  developerId: "1061397602916126771",
  mpAccessToken: process.env.DEV_MP_ACCESS_TOKEN,
  clients: [
    {
      id: "403271714437595137",
      name: "Luiza",
    },
  ] as MonthlyClientConfig[],
};

/**
 * Retorna a data atual no fuso horário de Brasília (America/Sao_Paulo).
 */
export function getBrasiliaDate(): Date {
  const now = new Date();
  const utcOffset = now.getTime() + now.getTimezoneOffset() * 60000;
  // Brasília é UTC-3
  return new Date(utcOffset - 3 * 3600000);
}

/**
 * Retorna a string do mês/ano no formato "YYYY-MM" (ex: "2026-10").
 */
export function getCurrentMonthYear(date = getBrasiliaDate()): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Constrói o container da fatura mensal (aviso informativo sem PIX direto).
 */
export function buildMonthlyInvoiceContainer(
  user: User | { id: string },
  clientName: string,
  monthYear: string,
) {
  const [year, month] = monthYear.split("-");
  const formattedPeriod = `${month}/${year}`;

  const brandColor =
    typeof brand !== "undefined" && brand.primaryColor
      ? brand.primaryColor
      : "#38bdf8";

  const generateBtn = new ButtonBuilder()
    .setCustomId("monthly_billing/generate_pix")
    .setLabel("Gerar PIX para Pagamento")
    .setStyle(ButtonStyle.Success)
    .setEmoji(getEmojiId("other_card") || "💳");

  const container = createContainer(
    brandColor,
    `## ${getEmojiTag("other_dollar") || "🟢"} Fatura Mensal • Manutenção & Hospedagem`,
    Separator.Default,
    [
      `Olá <@${user.id}>! A fatura de manutenção e hospedagem do seu bot referente a **${formattedPeriod}** está disponível.`,
      "",
      `| **Cliente:** <@${user.id}> (${clientName})`,
      `| **Serviço:** Hospedagem 24/7 & Manutenção do Bot`,
      `| **Vencimento:** Todo dia 06/${month}/${year}`,
      `| **Valor:** \`R$ ${MONTHLY_BILLING_CONFIG.amount.toFixed(2).replace(".", ",")}\``,
      `| **Beneficiário:** ${MONTHLY_BILLING_CONFIG.beneficiaryName} (<@${MONTHLY_BILLING_CONFIG.developerId}>)`,
    ].join("\n"),
    Separator.Default,
    [
      `### ${getEmojiTag("other_card") || "💳"} Como Realizar o Pagamento`,
      `Para gerar o seu **PIX dinâmico com verificação e aprovação automática**, clique no botão abaixo ou envie o comando no meu privado:`,
      `> \`/pagar-mensalidade\``,
    ].join("\n"),
    Separator.Default,
    createRow(generateBtn),
    Separator.Default,
    `*Após a confirmação do pagamento, a renovação da hospedagem é computada automaticamente no sistema.*`,
  );

  return container;
}

/**
 * Constrói o container de lembrete pra quem já foi cobrado mas ainda não pagou.
 * Reusa o mesmo customId do botão de gerar PIX — o handler é auto-suficiente
 * (resolve tudo a partir de interaction.user), então funciona igual numa
 * mensagem nova.
 */
export function buildMonthlyReminderContainer(
  user: User | { id: string },
  clientName: string,
  monthYear: string,
  daysSinceSent: number,
) {
  const [year, month] = monthYear.split("-");
  const formattedPeriod = `${month}/${year}`;

  const brandColor = "#f59e0b";

  const generateBtn = new ButtonBuilder()
    .setCustomId("monthly_billing/generate_pix")
    .setLabel("Gerar PIX para Pagamento")
    .setStyle(ButtonStyle.Success)
    .setEmoji(getEmojiId("other_card") || "💳");

  const container = createContainer(
    brandColor,
    `## ${getEmojiTag("clock") || "⏰"} Lembrete • Fatura ${formattedPeriod} em aberto`,
    Separator.Default,
    [
      `Oi <@${user.id}>! A fatura de manutenção e hospedagem referente a **${formattedPeriod}** ainda consta **em aberto** há ${daysSinceSent} dias.`,
      "",
      `| **Cliente:** <@${user.id}> (${clientName})`,
      `| **Valor:** \`R$ ${MONTHLY_BILLING_CONFIG.amount.toFixed(2).replace(".", ",")}\``,
      `| **Beneficiário:** ${MONTHLY_BILLING_CONFIG.beneficiaryName} (<@${MONTHLY_BILLING_CONFIG.developerId}>)`,
    ].join("\n"),
    Separator.Default,
    createRow(generateBtn),
    Separator.Default,
    `*Se já pagou, ignore — a confirmação pode levar alguns minutos pra chegar. Qualquer dúvida, chama o desenvolvedor.*`,
  );

  return container;
}

/**
 * Constrói o container visual com os dados do PIX gerado pelo Mercado Pago.
 */
export function buildMonthlyPixContainer(
  user: User | { id: string },
  clientName: string,
  monthYear: string,
  pix: {
    paymentId: string;
    qrCode: string;
    ticketUrl?: string;
    amount: number;
  },
) {
  const [year, month] = monthYear.split("-");
  const formattedPeriod = `${month}/${year}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(pix.qrCode)}`;

  const brandColor =
    typeof brand !== "undefined" && brand.primaryColor
      ? brand.primaryColor
      : "#38bdf8";

  const buttons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(`monthly_billing/check/${pix.paymentId}`)
      .setLabel("Verificar Pagamento")
      .setStyle(ButtonStyle.Primary)
      .setEmoji(getEmojiId("action_check") || "🔄"),
  ];

  if (pix.ticketUrl) {
    buttons.push(
      new ButtonBuilder()
        .setLabel("Comprovante MP")
        .setStyle(ButtonStyle.Link)
        .setURL(pix.ticketUrl)
        .setEmoji(getEmojiId("other_dollar") || "📄"),
    );
  }

  const container = createContainer(
    brandColor,
    `## ${getEmojiTag("other_dollar") || "🟢"} Pagamento PIX • Fatura ${formattedPeriod}`,
    Separator.Default,
    [
      `| **Cliente:** <@${user.id}> (${clientName})`,
      `| **Valor:** \`R$ ${pix.amount.toFixed(2).replace(".", ",")}\``,
      `| **Beneficiário:** ${MONTHLY_BILLING_CONFIG.beneficiaryName}`,
      `| **Status:** ⏳ **Aguardando Pagamento...**`,
      "",
      `| **Código PIX Copia e Cola:**`,
      `\`\`\`text\n${pix.qrCode}\n\`\`\``,
    ].join("\n"),
    Separator.Default,
    createMediaGallery(qrCodeUrl),
    Separator.Default,
    createRow(...buttons),
    Separator.Default,
    `*Após pagar no seu banco, clique em **Verificar Pagamento** ou aguarde alguns segundos que o bot confirma automaticamente.*`,
  );

  return container;
}

/**
 * Constrói o container de confirmação de pagamento aprovado.
 */
export function buildMonthlyPaidContainer(
  user: User | { id: string },
  clientName: string,
  monthYear: string,
  amount: number,
  paidAt = new Date(),
) {
  const [year, month] = monthYear.split("-");
  const formattedPeriod = `${month}/${year}`;

  const container = createContainer(
    "#22c55e",
    `## ${getEmojiTag("action_check") || "✅"} Pagamento Confirmado • Fatura ${formattedPeriod}`,
    Separator.Default,
    [
      `O seu pagamento foi **identificado e aprovado com sucesso** pelo Mercado Pago!`,
      "",
      `| **Cliente:** <@${user.id}> (${clientName})`,
      `| **Serviço:** Hospedagem 24/7 & Manutenção do Bot`,
      `| **Referência:** Mês ${formattedPeriod}`,
      `| **Valor Pago:** \`R$ ${amount.toFixed(2).replace(".", ",")}\``,
      `| **Data de Confirmação:** <t:${Math.floor(paidAt.getTime() / 1000)}:F>`,
      `| **Status:** 🟢 **PAGO / RENOVADO**`,
    ].join("\n"),
    Separator.Default,
    `*A hospedagem e a manutenção do seu bot estão garantidas. Muito obrigado pela preferência e parceria!*`,
  );

  return container;
}

/**
 * Gera um pagamento PIX dinâmico no Mercado Pago para a mensalidade.
 */
export async function generateMonthlyPixPayment(
  userId: string,
  monthYear = getCurrentMonthYear(),
): Promise<{
  success: boolean;
  error?: string;
  pix?: {
    paymentId: string;
    qrCode: string;
    qrCodeBase64?: string;
    ticketUrl?: string;
    amount: number;
    monthYear: string;
    clientName: string;
  };
}> {
  let clientConfig = MONTHLY_BILLING_CONFIG.clients.find(
    (c) => c.id === userId,
  );
  if (!clientConfig && userId === MONTHLY_BILLING_CONFIG.developerId) {
    clientConfig = {
      id: userId,
      name: "Matheus (Desenvolvedor)",
    };  
  }
  if (!clientConfig) {
    return {
      success: false,
      error: "Você não está registrado na lista de clientes de mensalidade deste bot.",
    };
  }

  const token =
    MONTHLY_BILLING_CONFIG.mpAccessToken || process.env.DEV_MP_ACCESS_TOKEN;

  const [year, month] = monthYear.split("-");
  const formattedPeriod = `${month}/${year}`;
  const idempotencyKey = `monthly_${userId}_${monthYear}_${Date.now()}`;
  const botName =
    typeof brand !== "undefined" && brand.brandName
      ? brand.brandName
      : "Discord Bot";

  try {
    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: MONTHLY_BILLING_CONFIG.amount,
        description: `Mensalidade Hospedagem ${botName} - ${clientConfig.name} (${formattedPeriod})`,
        payment_method_id: "pix",
        payer: {
          email: "mensalidade.discord@tickets.com",
        },
        external_reference: `monthly_${userId}_${monthYear}`,
        metadata: {
          user_id: userId,
          month_year: monthYear,
          bot_name: botName,
          client_name: clientConfig.name,
          type: "monthly_billing",
        },
      }),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      console.error("[Monthly Billing] Erro Mercado Pago:", data);
      return {
        success: false,
        error:
          data.message ||
          data.error ||
          "Erro ao gerar cobrança PIX no Mercado Pago.",
      };
    }

    const paymentId = String(data.id);
    const qrCode = data.point_of_interaction?.transaction_data?.qr_code || "";
    const qrCodeBase64 =
      data.point_of_interaction?.transaction_data?.qr_code_base64 || "";
    const ticketUrl =
      data.point_of_interaction?.transaction_data?.ticket_url || "";

    // Salvar ou atualizar registro no banco
    await db.monthlyBillings.findOneAndUpdate(
      { userId, monthYear },
      {
        userId,
        clientName: clientConfig.name,
        botName,
        monthYear,
        amount: MONTHLY_BILLING_CONFIG.amount,
        pixPayload: qrCode,
        status: "pending",
        mpPaymentId: paymentId,
        qrCode,
        qrCodeBase64,
        ticketUrl,
        sentAt: new Date(),
      },
      { upsert: true, new: true },
    );

    return {
      success: true,
      pix: {
        paymentId,
        qrCode,
        qrCodeBase64,
        ticketUrl,
        amount: MONTHLY_BILLING_CONFIG.amount,
        monthYear,
        clientName: clientConfig.name,
      },
    };
  } catch (err: any) {
    console.error("[Monthly Billing] Exceção Mercado Pago:", err);
    return {
      success: false,
      error: `Falha na comunicação com o Mercado Pago: ${err.message}`,
    };
  }
}

/**
 * Consulta a API do Mercado Pago e valida se a fatura foi paga.
 * Em caso de aprovação, atualiza o banco e notifica cliente e desenvolvedor.
 */
export async function verifyMonthlyPayment(
  paymentId: string,
  client: Client,
): Promise<{
  paid: boolean;
  status: string;
  error?: string;
  billing?: any;
}> {
  const token =
    MONTHLY_BILLING_CONFIG.mpAccessToken || process.env.DEV_MP_ACCESS_TOKEN;

  try {
    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      return {
        paid: false,
        status: "unknown",
        error: "Não foi possível consultar o Mercado Pago.",
      };
    }

    const data = (await res.json()) as any;
    const mpStatus = data.status;

    if (mpStatus === "approved") {
      const billing = await db.monthlyBillings.findOne({
        mpPaymentId: paymentId,
      });

      if (billing && billing.status !== "paid") {
        const paidAt = new Date();
        billing.status = "paid";
        billing.paidAt = paidAt;
        await (billing as any).save();

        // Notificar cliente na DM
        try {
          const user = await client.users.fetch(billing.userId).catch(() => null);
          if (user) {
            const paidContainer = buildMonthlyPaidContainer(
              user,
              billing.clientName,
              billing.monthYear,
              billing.amount,
              paidAt,
            );

            let updated = false;
            if (billing.dmChannelId && billing.dmMessageId) {
              const channel = await client.channels
                .fetch(billing.dmChannelId)
                .catch(() => null);
              if (channel && channel.isTextBased()) {
                const message = await channel.messages
                  .fetch(billing.dmMessageId)
                  .catch(() => null);
                if (message) {
                  await message
                    .edit({
                      components: [paidContainer],
                      flags: ["IsComponentsV2"] as any,
                    })
                    .catch(() => null);
                  updated = true;
                }
              }
            }

            if (!updated) {
              await safeSendDM(
                user,
                {
                  components: [paidContainer],
                  flags: ["IsComponentsV2"] as any,
                },
                `Pagamento Confirmado - ${billing.clientName}`,
              );
            }
          }
        } catch (dmErr) {
          console.error("[Monthly Billing] Erro ao avisar cliente:", dmErr);
        }

        // Notificar o Desenvolvedor Matheus na DM
        try {
          const devUser = await client.users
            .fetch(MONTHLY_BILLING_CONFIG.developerId)
            .catch(() => null);
          if (devUser) {
            const [year, month] = billing.monthYear.split("-");
            const devNotice = createContainer(
              "#22c55e",
              `## ${getEmojiTag("action_check") || "🎉"} Mensalidade Recebida!`,
              Separator.Default,
              [
                `O cliente **${billing.clientName}** (<@${billing.userId}>) acabou de pagar a mensalidade via PIX Mercado Pago!`,
                "",
                `| **Cliente:** <@${billing.userId}> (${billing.clientName})`,
                `| **Referência:** ${month}/${year}`,
                `| **Valor:** \`R$ ${billing.amount.toFixed(2).replace(".", ",")}\``,
                `| **ID Mercado Pago:** \`${paymentId}\``,
                `| **Status:** 🟢 **Aprovado**`,
              ].join("\n"),
            );

            await safeSendDM(
              devUser,
              {
                components: [devNotice],
                flags: ["IsComponentsV2"] as any,
              },
              `Mensalidade Recebida - ${billing.clientName}`,
            );
          }
        } catch (devErr) {
          console.error("[Monthly Billing] Erro ao avisar dev:", devErr);
        }

        return { paid: true, status: "approved", billing };
      }

      return { paid: true, status: "approved", billing };
    }

    return { paid: false, status: mpStatus };
  } catch (err: any) {
    console.error("[Monthly Billing] Erro na verificação:", err);
    return { paid: false, status: "error", error: err.message };
  }
}

/**
 * Inicia verificação rápida em polling para quando o usuário gera o PIX na hora.
 * Checa a cada 8 segundos por até 10 minutos.
 */
export function startPaymentPolling(paymentId: string, client: Client) {
  let attempts = 0;
  const maxAttempts = 75; // ~10 minutos
  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
      return;
    }

    try {
      const billing = await db.monthlyBillings.findOne({ mpPaymentId: paymentId });
      if (!billing || billing.status === "paid") {
        clearInterval(interval);
        return;
      }

      const result = await verifyMonthlyPayment(paymentId, client);
      if (result.paid) {
        clearInterval(interval);
      }
    } catch {
      // Ignora falhas transitórias
    }
  }, 8000);
}

/**
 * Envia a cobrança mensal (fatura inicial sem PIX) para a DM de um cliente específico.
 */
export async function sendMonthlyBillingDM(
  client: Client,
  clientConfig: MonthlyClientConfig,
  options: { monthYear?: string; isTest?: boolean } = {},
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await client.users.fetch(clientConfig.id).catch(() => null);
    if (!user) {
      return {
        success: false,
        error: `Não foi possível encontrar o usuário ${clientConfig.id} (${clientConfig.name}).`,
      };
    }

    const monthYear = options.monthYear || getCurrentMonthYear();
    const container = buildMonthlyInvoiceContainer(
      user,
      clientConfig.name,
      monthYear,
    );

    let dmMsg: any = null;
    try {
      dmMsg = await user.send({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
    } catch {
      const sent = await safeSendDM(
        user,
        {
          components: [container],
          flags: ["IsComponentsV2"] as any,
        },
        `Monthly Billing - ${clientConfig.name}`,
      );
      if (!sent) {
        return {
          success: false,
          error: `A DM de <@${clientConfig.id}> está fechada ou bloqueada.`,
        };
      }
    }

    // Salvar registro inicial no banco (sem PIX ainda)
    if (!options.isTest) {
      const botName =
        typeof brand !== "undefined" && brand.brandName
          ? brand.brandName
          : "Prism";

      await db.monthlyBillings.findOneAndUpdate(
        { userId: clientConfig.id, monthYear },
        {
          userId: clientConfig.id,
          clientName: clientConfig.name,
          botName,
          monthYear,
          amount: MONTHLY_BILLING_CONFIG.amount,
          status: "sent",
          dmMessageId: dmMsg?.id,
          dmChannelId: dmMsg?.channelId,
          sentAt: new Date(),
          isTest: false,
        },
        { upsert: true, new: true },
      );
    }

    console.log(
      `[Monthly Billing] Fatura ${monthYear} enviada com sucesso para ${clientConfig.name} (${clientConfig.id}).`,
    );

    return { success: true };
  } catch (err: any) {
    console.error(
      `[Monthly Billing] Erro ao enviar fatura para ${clientConfig.id}:`,
      err,
    );
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Varre todos os pagamentos pendentes no banco e confere se foram pagos no Mercado Pago.
 */
export async function checkPendingMonthlyPayments(client: Client) {
  try {
    const pendings = await db.monthlyBillings.find({
      status: "pending",
      mpPaymentId: { $exists: true, $ne: "" },
    });

    for (const p of pendings) {
      if (!p.mpPaymentId) continue;
      await verifyMonthlyPayment(p.mpPaymentId, client);
    }
  } catch (error) {
    console.error("[Monthly Billing] Erro ao checar pagamentos pendentes:", error);
  }
}

/**
 * Varre as cobranças do mês atual que ainda não foram pagas (status "sent"
 * ou "pending") e manda UM lembrete por cliente, no dia fixo configurado
 * (MONTHLY_BILLING_CONFIG.reminderDay) — não é mais contado a partir de
 * quando a cobrança foi enviada, é sempre o mesmo dia do calendário pra
 * todo mundo, tanto faz quando cada um foi cobrado de fato.
 *
 * "Uma vez por mês" é garantido comparando o mês do último lembrete
 * (lastReminderAt) com o mês atual — sem isso, cada checagem periódica
 * mandaria de novo a partir do dia 08 até o fim do mês.
 *
 * Cobranças de teste (isTest: true) nunca entram aqui: são "sent" só na
 * memória, nunca gravadas no banco (ver sendMonthlyBillingDM).
 */
export async function checkAndSendPaymentReminders(client: Client) {
  try {
    const brasiliaDate = getBrasiliaDate();
    if (brasiliaDate.getDate() < MONTHLY_BILLING_CONFIG.reminderDay) return;

    const currentMonthYear = getCurrentMonthYear(brasiliaDate);
    const pendingBillings = await db.monthlyBillings.find({
      monthYear: currentMonthYear,
      status: { $in: ["sent", "pending"] },
    });

    for (const billing of pendingBillings) {
      // Ja lembrado esse mes? (compara o mes do ultimo lembrete, nao so a
      // data exata — assim nao manda de novo toda vez que a checagem roda
      // entre o dia 08 e o fim do mes).
      if (
        billing.lastReminderAt &&
        getCurrentMonthYear(billing.lastReminderAt) === currentMonthYear
      ) {
        continue;
      }

      const user = await client.users.fetch(billing.userId).catch(() => null);
      if (!user) continue;

      const daysSinceSent = Math.floor(
        (Date.now() - billing.sentAt.getTime()) / (24 * 60 * 60 * 1000),
      );

      const reminderContainer = buildMonthlyReminderContainer(
        user,
        billing.clientName,
        billing.monthYear,
        daysSinceSent,
      );

      const sent = await safeSendDM(
        user,
        {
          components: [reminderContainer],
          flags: ["IsComponentsV2"] as any,
        },
        `Lembrete Mensalidade - ${billing.clientName}`,
      );

      if (sent) {
        billing.lastReminderAt = new Date();
        billing.reminderCount = (billing.reminderCount ?? 0) + 1;
        await (billing as any).save();
        console.log(
          `[Monthly Billing] Lembrete enviado para ${billing.clientName} (${billing.userId}) — ${billing.reminderCount}º lembrete.`,
        );
      }
    }
  } catch (error) {
    console.error("[Monthly Billing] Erro ao enviar lembretes:", error);
  }
}

/**
 * Desliga o bot sozinho no dia fixo configurado (MONTHLY_BILLING_CONFIG.
 * shutdownDay) se TODOS os clientes da lista ainda estiverem inadimplentes
 * nesse dia. Um unico cliente em dia (pago, mes pulado de proposito, ou
 * ainda sem cobranca lançada) ja cancela o desligamento — a regra é
 * "ninguém pagou", não "alguém não pagou".
 *
 * Antes de desligar, avisa o desenvolvedor por DM com o motivo — sem isso
 * o bot simplesmente sumiria do ar sem explicação nenhuma.
 */
export async function checkAndEnforceShutdown(client: Client) {
  try {
    if (MONTHLY_BILLING_CONFIG.clients.length === 0) return;

    const brasiliaDate = getBrasiliaDate();
    if (brasiliaDate.getDate() < MONTHLY_BILLING_CONFIG.shutdownDay) return;

    const currentMonthYear = getCurrentMonthYear(brasiliaDate);

    for (const clientConfig of MONTHLY_BILLING_CONFIG.clients) {
      const billing = await db.monthlyBillings.findOne({
        userId: clientConfig.id,
        monthYear: currentMonthYear,
      });

      // Sem cobranca, pago, ou mes pulado de proposito: alguem esta em dia
      // (ou nem foi cobrado ainda) — cancela o desligamento.
      if (
        !billing ||
        billing.status === "paid" ||
        billing.status === "skipped"
      ) {
        return;
      }
    }

    // Chegou aqui: todo mundo inadimplente no dia do desligamento.
    console.error(
      `[Monthly Billing] Nenhum cliente pagou ate o dia ${MONTHLY_BILLING_CONFIG.shutdownDay} — desligando o bot.`,
    );

    try {
      const devUser = await client.users
        .fetch(MONTHLY_BILLING_CONFIG.developerId)
        .catch(() => null);
      if (devUser) {
        const clientList = MONTHLY_BILLING_CONFIG.clients
          .map((c) => `<@${c.id}> (${c.name})`)
          .join(", ");
        const shutdownNotice = createContainer(
          "#ef4444",
          `## ${getEmojiTag("action_x") || "🔴"} Bot desligado por falta de pagamento`,
          Separator.Default,
          [
            `Nenhum cliente pagou a mensalidade de **${currentMonthYear}** até o dia ${MONTHLY_BILLING_CONFIG.shutdownDay}.`,
            "",
            `| **Clientes:** ${clientList}`,
            `| **Ação:** o bot foi desligado automaticamente.`,
          ].join("\n"),
          Separator.Default,
          `*Assim que o pagamento for confirmado, reinicie o bot manualmente no Discloud.*`,
        );
        await safeSendDM(
          devUser,
          { components: [shutdownNotice], flags: ["IsComponentsV2"] as any },
          "Bot desligado — mensalidade em atraso",
        );
      }
    } catch (notifyErr) {
      console.error(
        "[Monthly Billing] Erro ao avisar dev do desligamento:",
        notifyErr,
      );
    }

    client.destroy();
    process.exit(0);
  } catch (error) {
    console.error("[Monthly Billing] Erro na checagem de desligamento:", error);
  }
}

/**
 * Rotina periódica de verificação e disparo das cobranças mensais.
 * Regra estrita: Dispara apenas no DIA 06 de cada mês.
 */
export async function checkAndProcessMonthlyBillings(client: Client) {
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
  } catch (error) {
    console.error("[Monthly Billing] Erro na verificação periódica:", error);
  }
}


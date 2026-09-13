import { createCommand, createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { ApplicationCommandType } from "discord.js";
import { db } from "#database";
import {
  MONTHLY_BILLING_CONFIG,
  getCurrentMonthYear,
  generateMonthlyPixPayment,
  buildMonthlyPixContainer,
  buildMonthlyPaidContainer,
  verifyMonthlyPayment,
  startPaymentPolling,
  getEmojiTag,
} from "#functions";

// ==========================================
// Comando /pagar-mensalidade (Disponível na DM e no Servidor)
// ==========================================
createCommand({
  name: "pagar-mensalidade",
  description: "💳 Gera o PIX para pagamento da fatura mensal de hospedagem e manutenção.",
  type: ApplicationCommandType.ChatInput,
  dmPermission: true,
  async run(interaction) {
    const isAuthorized =
      MONTHLY_BILLING_CONFIG.clients.some((c) => c.id === interaction.user.id) ||
      interaction.user.id === MONTHLY_BILLING_CONFIG.developerId;

    if (!isAuthorized) {
      await interaction.reply({
        content: `${getEmojiTag("action_x") || "❌"} Você não possui faturas de hospedagem associadas a esta conta.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const monthYear = getCurrentMonthYear();
    const existing = await db.monthlyBillings.findOne({
      userId: interaction.user.id,
      monthYear,
    });

    if (existing?.status === "paid") {
      const paidContainer = buildMonthlyPaidContainer(
        interaction.user,
        existing.clientName,
        monthYear,
        existing.amount,
        existing.paidAt || new Date(),
      );
      await interaction.reply({
        components: [paidContainer],
        flags: ["IsComponentsV2"] as any,
      });
      return;
    }

    await interaction.deferReply({
      flags: interaction.inGuild() ? ["Ephemeral"] : [],
    });

    const res = await generateMonthlyPixPayment(interaction.user.id, monthYear);
    if (!res.success || !res.pix) {
      await interaction.editReply({
        content: `${getEmojiTag("action_x") || "❌"} Erro ao gerar cobrança no Mercado Pago:\n${res.error}`,
      });
      return;
    }

    const container = buildMonthlyPixContainer(
      interaction.user,
      res.pix.clientName,
      monthYear,
      res.pix,
    );

    const msg = await interaction.editReply({
      components: [container],
      flags: ["IsComponentsV2"] as any,
    });

    if (msg) {
      await db.monthlyBillings.updateOne(
        { mpPaymentId: res.pix.paymentId },
        {
          $set: {
            dmMessageId: msg.id,
            dmChannelId: msg.channelId,
          },
        },
      );
    }

    // Iniciar verificação automática ativa
    startPaymentPolling(res.pix.paymentId, interaction.client);
  },
});

// ==========================================
// Responder: Botão [💳 Gerar PIX para Pagamento] na DM
// ==========================================
createResponder({
  customId: "monthly_billing/generate_pix",
  types: [ResponderType.Button],
  async run(interaction) {
    const isAuthorized =
      MONTHLY_BILLING_CONFIG.clients.some((c) => c.id === interaction.user.id) ||
      interaction.user.id === MONTHLY_BILLING_CONFIG.developerId;

    if (!isAuthorized) {
      await interaction.reply({
        content: `${getEmojiTag("action_x") || "❌"} Você não possui faturas de hospedagem registradas nesta aplicação.`,
        flags: ["Ephemeral"],
      });
      return;
    }

    await interaction.deferUpdate();
    const monthYear = getCurrentMonthYear();

    const existing = await db.monthlyBillings.findOne({
      userId: interaction.user.id,
      monthYear,
    });

    if (existing?.status === "paid") {
      const paidContainer = buildMonthlyPaidContainer(
        interaction.user,
        existing.clientName,
        monthYear,
        existing.amount,
        existing.paidAt || new Date(),
      );
      await interaction.editReply({
        components: [paidContainer],
        flags: ["IsComponentsV2"] as any,
      });
      return;
    }

    const res = await generateMonthlyPixPayment(interaction.user.id, monthYear);
    if (!res.success || !res.pix) {
      await interaction.followUp({
        content: `${getEmojiTag("action_x") || "❌"} Falha ao comunicar com o Mercado Pago:\n${res.error}`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const container = buildMonthlyPixContainer(
      interaction.user,
      res.pix.clientName,
      monthYear,
      res.pix,
    );

    await interaction.editReply({
      components: [container],
      flags: ["IsComponentsV2"] as any,
    });

    await db.monthlyBillings.updateOne(
      { mpPaymentId: res.pix.paymentId },
      {
        $set: {
          dmMessageId: interaction.message.id,
          dmChannelId: interaction.channelId,
        },
      },
    );

    // Iniciar verificação automática ativa
    startPaymentPolling(res.pix.paymentId, interaction.client);
  },
});

// ==========================================
// Responder: Botão [🔄 Verificar Pagamento]
// ==========================================
createResponder({
  customId: "monthly_billing/check/:paymentId",
  types: [ResponderType.Button],
  async run(interaction, params) {
    const { paymentId } = params;
    await interaction.deferReply({ flags: ["Ephemeral"] });

    const result = await verifyMonthlyPayment(paymentId, interaction.client);

    if (result.paid) {
      const billing =
        result.billing ||
        (await db.monthlyBillings.findOne({ mpPaymentId: paymentId }));

      const paidContainer = buildMonthlyPaidContainer(
        interaction.user,
        billing?.clientName || interaction.user.username,
        billing?.monthYear || getCurrentMonthYear(),
        billing?.amount || MONTHLY_BILLING_CONFIG.amount,
        billing?.paidAt || new Date(),
      );

      await interaction.message
        .edit({
          components: [paidContainer],
          flags: ["IsComponentsV2"] as any,
        })
        .catch(() => null);

      await interaction.editReply({
        content: `${getEmojiTag("action_check") || "✅"} **Pagamento Aprovado com Sucesso!** Sua fatura mensal foi confirmada e renovada. Muito obrigado!`,
      });
      return;
    }

    await interaction.editReply({
      content: `${getEmojiTag("clock") || "⏳"} **Pagamento ainda não aprovado.**\nStatus atual: \`${result.status}\`.\nSe você já efetuou a transferência no aplicativo do seu banco, aguarde alguns segundos e clique novamente em **Verificar Pagamento**.`,
    });
  },
});

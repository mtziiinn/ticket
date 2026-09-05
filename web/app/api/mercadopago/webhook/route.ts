import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

const DISCORD_API = "https://discord.com/api/v10";

async function sendDiscordMessage(channelId: string, content: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[Discord API] Erro ao enviar mensagem no canal ${channelId}: ${text}`);
    return null;
  }
  return res.json();
}

async function updateDiscordChannelName(channelId: string, newStatusEmoji: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;

  try {
    const getRes = await fetch(`${DISCORD_API}/channels/${channelId}`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!getRes.ok) return null;
    const channelData = await getRes.json();

    const currentName = channelData.name || "";
    const nameParts = currentName.split("・");
    const slug = nameParts[1] || currentName;
    const updatedName = `${newStatusEmoji}・${slug}`;

    await fetch(`${DISCORD_API}/channels/${channelId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: updatedName }),
    });
  } catch (err) {
    console.error("[Discord API] Erro ao atualizar nome do canal:", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) {
      console.warn("[MP Webhook] MP_ACCESS_TOKEN não configurado no ambiente.");
      return NextResponse.json({ error: "MP_ACCESS_TOKEN not configured" }, { status: 500 });
    }

    // 1. Extrair ID do pagamento (pode vir no body ou na query string)
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get("data.id") || searchParams.get("id");
    const queryType = searchParams.get("type") || searchParams.get("topic");

    let bodyData: any = {};
    try {
      bodyData = await request.json();
    } catch {
      // Body vazio é comum em pings do webhook
    }

    const paymentId = bodyData?.data?.id || bodyData?.id || queryId;
    const eventType = bodyData?.type || bodyData?.action || queryType;

    // Se não for evento de pagamento, responde 200 OK para o Mercado Pago
    if (!paymentId) {
      return NextResponse.json({ ok: true, message: "Webhook ping received" });
    }

    console.log(`[MP Webhook] Notificação recebida: ID ${paymentId} | Tipo: ${eventType}`);

    // 2. Consultar a API do Mercado Pago para obter o status real e seguro do pagamento
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${mpToken}`,
      },
    });

    if (!mpRes.ok) {
      console.error(`[MP Webhook] Erro ao buscar pagamento ${paymentId}: status ${mpRes.status}`);
      return NextResponse.json({ error: "Payment not found" }, { status: 200 }); // Retorna 200 para o MP não retentar indefinidamente
    }

    const payment = await mpRes.json();
    console.log(`[MP Webhook] Pagamento ${paymentId}: Status = ${payment.status}, Método = ${payment.payment_method_id}, Valor = ${payment.transaction_amount}`);

    // 3. Processar apenas se o status for "approved"
    if (payment.status === "approved") {
      const ticketId = payment.external_reference || payment.metadata?.ticket_id;
      const channelId = payment.metadata?.channel_id;

      if (!ticketId) {
        console.warn(`[MP Webhook] Pagamento ${paymentId} aprovado, mas sem ticketId associado.`);
        return NextResponse.json({ ok: true, warning: "No ticketId found" });
      }

      const db = await getDatabase();
      const ticket = await db.collection("tickets").findOne({ ticketId });

      if (!ticket) {
        console.warn(`[MP Webhook] Ticket #${ticketId} não encontrado no banco de dados.`);
        return NextResponse.json({ ok: true, warning: "Ticket not found in DB" });
      }

      // Verificar se já foi aprovado anteriormente para não duplicar avisos
      if (ticket.payment?.status === "approved") {
        console.log(`[MP Webhook] Pagamento do Ticket #${ticketId} já foi processado anteriormente.`);
        return NextResponse.json({ ok: true, message: "Already processed" });
      }

      const amountFormatted = Number(payment.transaction_amount || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      const paymentMethodName = payment.payment_method_id?.toUpperCase() === "PIX" 
        ? "PIX" 
        : `Cartão de Crédito (${payment.payment_method_id?.toUpperCase()})`;

      // Atualizar o Ticket no MongoDB
      await db.collection("tickets").updateOne(
        { ticketId },
        {
          $set: {
            status: "production",
            "payment.id": String(payment.id),
            "payment.status": "approved",
            "payment.amount": payment.transaction_amount,
            "payment.method": payment.payment_method_id,
            "payment.paidAt": new Date(),
          },
        }
      );

      const targetChannelId = channelId || ticket.channelId;

      if (targetChannelId) {
        // Enviar mensagem de celebração no canal do ticket no Discord
        const messageContent = [
          `# <:action_check:1502789797821939752> Pagamento Aprovado com Sucesso!`,
          `Recebemos a confirmação do pagamento no valor de **${amountFormatted}** via **${paymentMethodName}**.`,
          `\n> <:clock_check:1502789856881938502> **Novo Status:** \`EM PRODUÇÃO\``,
          `> <:user_check:1502789974276178121> **Cliente:** <@${ticket.ownerId}>`,
          `> <:database:1502789865023209512> **ID da Transação:** \`${payment.id}\``,
          `\nA equipe foi notificada e já dará início ao desenvolvimento da sua encomenda! 🚀`,
        ].join("\n");

        await sendDiscordMessage(targetChannelId, messageContent);

        // Atualizar o nome do canal com o emoji de produção (⚙️)
        await updateDiscordChannelName(targetChannelId, "⚙️");
      }

      console.log(`[MP Webhook] Sucesso: Ticket #${ticketId} atualizado para status pago (produção)!`);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[MP Webhook] Erro crítico no processamento:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Suporte para GET (validação de Webhook do Mercado Pago)
export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "Mercado Pago Webhook - Tickets MTS",
    timestamp: new Date().toISOString(),
  });
}

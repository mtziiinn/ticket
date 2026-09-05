import { env } from "#env";
export async function createMercadoPagoCharge(params) {
    const token = env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
    if (!token) {
        return {
            success: false,
            error: "O token do Mercado Pago (`MP_ACCESS_TOKEN`) não foi configurado no `.env`.",
        };
    }
    const roundedAmount = Number(params.amount.toFixed(2));
    if (isNaN(roundedAmount) || roundedAmount < 1) {
        return {
            success: false,
            error: "O valor mínimo para cobrança é de R$ 1,00.",
        };
    }
    const webhookUrl = `${env.WEB_URL}/api/mercadopago/webhook`;
    const sanitizedDescription = params.description.trim().substring(0, 200) || "Serviço / Atendimento";
    try {
        // 1. Criar PIX Dinâmico com a API de Pagamentos (/v1/payments)
        const idempotencyKey = `ticket_${params.ticketId}_${Date.now()}`;
        const pixResponse = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
                transaction_amount: roundedAmount,
                description: `${sanitizedDescription} (Ticket #${params.ticketId})`,
                payment_method_id: "pix",
                payer: {
                    email: params.customerEmail || "cliente.discord@ticket-mts.com",
                },
                external_reference: params.ticketId,
                notification_url: webhookUrl,
                metadata: {
                    ticket_id: params.ticketId,
                    channel_id: params.channelId,
                },
            }),
        });
        const pixData = (await pixResponse.json());
        if (!pixResponse.ok) {
            console.error("[MercadoPago] Erro ao criar PIX:", pixData);
            return {
                success: false,
                error: pixData.message ||
                    pixData.error ||
                    "Erro ao gerar cobrança PIX no Mercado Pago.",
            };
        }
        const qrCode = pixData.point_of_interaction?.transaction_data?.qr_code || "";
        const qrCodeBase64 = pixData.point_of_interaction?.transaction_data?.qr_code_base64 || "";
        const ticketUrl = pixData.point_of_interaction?.transaction_data?.ticket_url || "";
        // 2. Criar Preferência de Checkout para Cartão de Crédito e outros (/checkout/preferences)
        let cardCheckout = undefined;
        try {
            const prefResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    items: [
                        {
                            id: params.ticketId,
                            title: `${sanitizedDescription} - Ticket #${params.ticketId}`,
                            quantity: 1,
                            unit_price: roundedAmount,
                            currency_id: "BRL",
                        },
                    ],
                    external_reference: params.ticketId,
                    notification_url: webhookUrl,
                    metadata: {
                        ticket_id: params.ticketId,
                        channel_id: params.channelId,
                    },
                    back_urls: {
                        success: env.WEB_URL,
                        pending: env.WEB_URL,
                        failure: env.WEB_URL,
                    },
                    auto_return: "approved",
                }),
            });
            if (prefResponse.ok) {
                const prefData = (await prefResponse.json());
                cardCheckout = {
                    preferenceId: prefData.id,
                    initPoint: prefData.init_point,
                };
            }
            else {
                console.warn("[MercadoPago] Falha ao criar preferência de cartão:", await prefResponse.text());
            }
        }
        catch (err) {
            console.warn("[MercadoPago] Exceção ao criar preferência de cartão:", err);
        }
        return {
            success: true,
            pix: {
                paymentId: pixData.id,
                qrCode,
                qrCodeBase64,
                ticketUrl,
                status: pixData.status,
            },
            cardCheckout,
        };
    }
    catch (error) {
        console.error("[MercadoPago] Erro de comunicação:", error);
        return {
            success: false,
            error: `Erro ao conectar com a API do Mercado Pago: ${error.message}`,
        };
    }
}
export async function getMercadoPagoPayment(paymentId) {
    const token = env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
    if (!token)
        return null;
    try {
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch (error) {
        console.error("[MercadoPago] Erro ao buscar pagamento:", error);
        return null;
    }
}

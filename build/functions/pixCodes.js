import { db } from "#database";
/**
 * Guarda o código PIX copia-e-cola gerado.
 *
 * O customId de um botão tem limite de 100 caracteres, então o payload completo
 * não cabe nele. Por isso é gerado um ID curto e o payload é salvo em:
 * 1. Cache em memória (acesso ultra-rápido instantâneo)
 * 2. MongoDB na collection `pix_codes` (persiste mesmo que o bot seja reiniciado na Discloud)
 * 3. Fallback inteligente: se o código não estiver em memória nem no banco,
 *    consegue extrair o payload original diretamente da URL do QR Code da mensagem do Discord!
 */
const PIX_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const pendingPixCodes = new Map();
export function registerPixCode(payload) {
    const id = Math.random().toString(36).slice(2, 10);
    pendingPixCodes.set(id, { payload, createdAt: Date.now() });
    // Persiste no MongoDB para sobreviver a reinicializações e deploys
    db.pixCodes
        .create({ codeId: id, payload })
        .catch((err) => console.warn("[PixCodes] Falha ao persistir código PIX no banco:", err));
    return id;
}
export async function getPixCode(id, message) {
    // 1. Tenta recuperar da memória (mais rápido)
    const fromMemory = pendingPixCodes.get(id)?.payload;
    if (fromMemory)
        return fromMemory;
    // 2. Tenta recuperar do MongoDB (se o bot foi reiniciado)
    try {
        const doc = (await db.pixCodes.findOne({ codeId: id }).lean());
        if (doc?.payload) {
            pendingPixCodes.set(id, { payload: doc.payload, createdAt: Date.now() });
            return doc.payload;
        }
    }
    catch (err) {
        console.warn("[PixCodes] Erro ao buscar código PIX no banco:", err);
    }
    // 3. Fallback inteligente: se a cobrança foi gerada antes do restart ou antes
    // de salvar no banco, extrai o payload direto da URL do QR Code da mensagem
    if (message) {
        try {
            const raw = JSON.stringify(message);
            const match = raw.match(/api\.qrserver\.com\/v1\/create-qr-code\/\?[^"']*data=([^&"'\s\\]+)/);
            if (match && match[1]) {
                const decoded = decodeURIComponent(match[1]);
                if (decoded.startsWith("000201")) {
                    pendingPixCodes.set(id, { payload: decoded, createdAt: Date.now() });
                    db.pixCodes.create({ codeId: id, payload: decoded }).catch(() => { });
                    return decoded;
                }
            }
        }
        catch { }
    }
    return undefined;
}
export function cleanupPendingPixCodes() {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, entry] of pendingPixCodes) {
        if (now - entry.createdAt > PIX_CODE_TTL_MS) {
            pendingPixCodes.delete(id);
            cleaned++;
        }
    }
    return cleaned;
}

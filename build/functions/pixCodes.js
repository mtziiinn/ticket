/**
 * Guarda o codigo PIX copia-e-cola gerado, pra abrir mao de mostrar ele cru
 * dentro do Container (Components V2 nao formata bem code block longo pra
 * copiar no celular) e em vez disso oferecer um botao — ao clicar, o bot
 * manda o codigo como mensagem de texto normal, que da pra selecionar tudo
 * com um toque so.
 *
 * O customId de um botao tem limite de 100 caracteres, entao nao da pra
 * embutir o payload inteiro nele — fica guardado aqui, na memoria do
 * processo, por um id curto. TTL de 24h (tempo de sobra pra um cliente
 * pagar) com varredura no cacheCleaner, mesmo padrao dos rascunhos de
 * /anunciar.
 */
const PIX_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const pendingPixCodes = new Map();
export function registerPixCode(payload) {
    const id = Math.random().toString(36).slice(2, 10);
    pendingPixCodes.set(id, { payload, createdAt: Date.now() });
    return id;
}
export function getPixCode(id) {
    return pendingPixCodes.get(id)?.payload;
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

import { db } from "#database";
import { buildTicketChannelName, parseTicketChannelName } from "./ticketName.js";
/**
 * Fila numerada por categoria (equivalente à fila da Dusk, mas agrupada pela
 * categoria do canal em vez do responsável — o Prism não tem categoria
 * pessoal de staff).
 *
 * Regra: todo ticket aberto com status "queue" na mesma categoria entra na
 * numeração 1, 2, 3... na ordem em que entrou na fila (`queuedAt`). Quem sai
 * da fila perde o número e os outros são renumerados.
 *
 * O número mora no próprio nome do canal ("🟠・2・cliente"), então nada disso
 * precisa de campo novo no banco.
 */
const NUMERIC_SEGMENT = /^\d+$/;
// Ids dos canais em fila numa categoria, na ordem da fila. Usa os filhos da
// categoria (que já estão em cache) pra não varrer o servidor inteiro.
async function getCategoryQueueChannelIds(guild, categoryId) {
    const category = guild.channels.cache.get(categoryId);
    const channelIds = category ? [...category.children.cache.keys()] : [];
    if (channelIds.length === 0)
        return [];
    const tickets = await db.tickets
        .find({ channelId: { $in: channelIds }, status: "queue", closed: false })
        .sort({ queuedAt: 1, openedAt: 1 })
        .select("channelId")
        .lean()
        .catch((err) => {
        console.error("[Fila] Erro ao buscar a fila da categoria:", err);
        return [];
    });
    return tickets
        .map((t) => t.channelId)
        .filter((id) => guild.channels.cache.has(id));
}
// Nome do canal com o número da posição (ou sem número, quando não está na
// fila), preservando a bolinha do status, os extras que não são número e o
// slug. Limpa números antigos/duplicados no caminho.
function withQueueNumber(currentName, position, emoji) {
    const { emoji: currentEmoji, extras, slug, } = parseTicketChannelName(currentName);
    const keptExtras = extras.filter((extra) => !NUMERIC_SEGMENT.test(extra));
    const parts = position ? [String(position), ...keptExtras] : keptExtras;
    return buildTicketChannelName(emoji ?? currentEmoji, parts, slug);
}
// Posição (1, 2, 3...) do ticket na fila da categoria, ou null se ele não está
// numa fila.
export async function getQueuePosition(guild, ticket, categoryId) {
    if (!ticket || ticket.closed || ticket.status !== "queue")
        return null;
    const ids = await getCategoryQueueChannelIds(guild, categoryId);
    const index = ids.indexOf(ticket.channelId);
    return index === -1 ? null : index + 1;
}
// Nome que o canal deveria ter agora, já com (ou sem) o número da fila.
export async function getTicketChannelName(guild, ticket, currentName, categoryId, emoji) {
    const position = await getQueuePosition(guild, ticket, categoryId);
    return withQueueNumber(currentName, position, emoji);
}
// Renumera os canais da fila de uma categoria. Roda em segundo plano: o
// Discord limita renomeações de um mesmo canal, então um rename pode ficar
// esperando o rate limit. Chamadas enquanto uma passada está rodando são
// agrupadas numa única passada extra no final.
const pendingRefresh = new Map();
export function refreshCategoryQueue(guild, categoryId) {
    if (!guild || !categoryId)
        return;
    const key = `${guild.id}:${categoryId}`;
    if (pendingRefresh.has(key)) {
        pendingRefresh.set(key, true);
        return;
    }
    pendingRefresh.set(key, false);
    void (async () => {
        try {
            do {
                pendingRefresh.set(key, false);
                await renumberCategoryQueue(guild, categoryId);
            } while (pendingRefresh.get(key));
        }
        catch (err) {
            console.error("[Fila] Erro ao renumerar a fila da categoria:", err);
        }
        finally {
            pendingRefresh.delete(key);
        }
    })();
}
async function renumberCategoryQueue(guild, categoryId) {
    const ids = await getCategoryQueueChannelIds(guild, categoryId);
    await Promise.allSettled(ids.map(async (channelId, index) => {
        const channel = guild.channels.cache.get(channelId);
        if (!channel)
            return;
        const desired = withQueueNumber(channel.name, index + 1);
        if (channel.name === desired)
            return;
        await channel.setName(desired).catch((err) => {
            console.error("[Fila] Erro ao renomear canal da fila:", err);
        });
    }));
}

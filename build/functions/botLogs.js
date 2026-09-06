import { db } from "#database";
/**
 * Envia uma mensagem de log formatada para o canal de logs configurado no servidor (botLogsChannel).
 */
export async function sendBotLog(guild, container) {
    try {
        const guildData = await db.guilds.get(guild.id);
        const logChannelId = guildData?.botLogsChannel;
        if (!logChannelId)
            return;
        let logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel) {
            logChannel = (await guild.channels.fetch(logChannelId).catch(() => null));
        }
        if (!logChannel || !logChannel.isTextBased())
            return;
        await logChannel.send({
            components: [container],
            flags: ["IsComponentsV2"],
        });
    }
    catch (err) {
        console.error("[BotLog] Erro ao despachar log no canal:", err);
    }
}
/**
 * Busca a entrada mais recente no Audit Log do Discord para identificar o executor da ação.
 */
export async function getAuditLogExecutor(guild, action, targetId, maxAgeSeconds = 10) {
    try {
        const auditLogs = await guild.fetchAuditLogs({
            type: action,
            limit: 5,
        }).catch(() => null);
        if (!auditLogs)
            return null;
        const now = Date.now();
        const entry = auditLogs.entries.find((e) => {
            const isTargetMatch = targetId ? e.targetId === targetId : true;
            const isRecent = (now - e.createdTimestamp) < maxAgeSeconds * 1000;
            return isTargetMatch && isRecent;
        });
        return entry?.executor || null;
    }
    catch {
        return null;
    }
}

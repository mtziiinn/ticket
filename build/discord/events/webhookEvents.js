import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, } from "discord.js";
import { getEmojiTag, sendBotLog } from "#functions";
const WEBHOOK_LOG_TYPES = [
    { type: AuditLogEvent.WebhookCreate, label: "Criado", emoji: "action_add", color: "#22c55e" },
    { type: AuditLogEvent.WebhookDelete, label: "Excluído", emoji: "action_remove", color: "#ef4444" },
    { type: AuditLogEvent.WebhookUpdate, label: "Atualizado", emoji: "action_info", color: "#eab308" },
];
// Dedup por id de entrada do audit log — evita logar duas vezes se
// webhookUpdate disparar mais de uma vez pra mesma mudança.
const loggedWebhookEntries = new Set();
// webhookUpdate só avisa "algo mudou nos webhooks desse canal", sem dizer o
// quê — usa o audit log pra descobrir se foi criação, edição ou exclusão.
createEvent({
    name: "webhookUpdate",
    event: "webhookUpdate",
    async run(channel) {
        const guild = channel.guild;
        if (!guild)
            return;
        try {
            const now = Date.now();
            let best = null;
            for (const t of WEBHOOK_LOG_TYPES) {
                const logs = await guild.fetchAuditLogs({ type: t.type, limit: 5 }).catch(() => null);
                // Sem filtrar por canal, um webhook criado/editado em OUTRO canal ao
                // mesmo tempo podia ser escolhido aqui por engano. O target nem
                // sempre traz o channelId (ex.: às vezes falta no delete) — nesse
                // caso não filtra, só quando o dado está presente e diverge.
                const entry = logs?.entries.find((e) => {
                    if (now - e.createdTimestamp > 10_000)
                        return false;
                    const targetChannelId = e.target?.channelId ?? e.target?.channel_id;
                    return !targetChannelId || targetChannelId === channel.id;
                });
                if (!entry)
                    continue;
                if (!best || entry.createdTimestamp > best.entry.createdTimestamp) {
                    best = { entry, label: t.label, emoji: t.emoji, color: t.color };
                }
            }
            if (!best)
                return;
            if (loggedWebhookEntries.has(best.entry.id))
                return;
            loggedWebhookEntries.add(best.entry.id);
            if (loggedWebhookEntries.size > 200)
                loggedWebhookEntries.clear();
            const targetName = best.entry.target?.name || "Webhook";
            const executor = best.entry.executor;
            const container = createContainer(best.color, `## ${getEmojiTag(best.emoji)} Webhook ${best.label}`, [
                `| ${getEmojiTag("folder")} <#${channel.id}>`,
                `| \`${targetName}\``,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(guild, container);
        }
        catch (err) {
            console.error("[webhookUpdate] Erro ao registrar log:", err);
        }
    },
});

import { env } from "#env";
import "../constants.js";
function truncate(str, max) {
    return str.length > max ? str.slice(0, max - 3) + "..." : str;
}
function formatStack(stack) {
    if (!stack)
        return "Sem stack trace disponível.";
    const lines = stack.split("\n").slice(0, 12);
    return truncate(lines.join("\n"), 1900);
}
function getTypeColor(type) {
    switch (type) {
        case "unhandledRejection":
        case "uncaughtException":
            return 0xed4245; // red
        case "commandError":
        case "interactionError":
            return 0xfbbd23; // yellow
        case "ticketError":
        case "paymentError":
            return 0xff6b6b; // light red
        case "databaseError":
            return 0xeb459e; // fuchsia
        case "warning":
            return 0xfbbd23; // yellow
        default:
            return 0x38bdf8; // primary
    }
}
function getTypeEmoji(type) {
    switch (type) {
        case "unhandledRejection":
        case "uncaughtException":
            return "🔴";
        case "commandError":
        case "interactionError":
            return "🟡";
        case "ticketError":
        case "paymentError":
            return "🟠";
        case "databaseError":
            return "🟣";
        case "warning":
            return "⚠️";
        default:
            return "ℹ️";
    }
}
export async function sendErrorWebhook(report) {
    const webhookUrl = brand.errorWebhook?.url;
    if (!webhookUrl)
        return;
    try {
        const mem = process.memoryUsage();
        const fields = [
            {
                name: "Tipo",
                value: `\`${report.type}\``,
                inline: true,
            },
            {
                name: "Mensagem",
                value: `\`\`\`${truncate(report.message, 900)}\`\`\``,
                inline: false,
            },
        ];
        if (report.context) {
            fields.push({
                name: "Contexto",
                value: truncate(report.context, 500),
                inline: false,
            });
        }
        if (report.stack) {
            fields.push({
                name: "Stack Trace",
                value: `\`\`\`${formatStack(report.stack)}\`\`\``,
                inline: false,
            });
        }
        const locationParts = [];
        if (report.guildId)
            locationParts.push(`Guild: \`${report.guildId}\``);
        if (report.channelId)
            locationParts.push(`Canal: <#${report.channelId}>`);
        if (report.userId)
            locationParts.push(`User: <@${report.userId}>`);
        if (locationParts.length > 0) {
            fields.push({
                name: "Localização",
                value: locationParts.join(" | "),
                inline: true,
            });
        }
        fields.push({
            name: "Recursos",
            value: `Heap: \`${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB\` | RSS: \`${(mem.rss / 1024 / 1024).toFixed(1)}MB\``,
            inline: true,
        });
        const embed = {
            color: getTypeColor(report.type),
            title: `${getTypeEmoji(report.type)} ${report.type}`,
            description: truncate(report.message, 2000),
            fields,
            footer: {
                text: `${brand.brandName} Bot • ${env.NODE_ENV || "production"}`,
            },
            timestamp: new Date().toISOString(),
        };
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: brand.errorWebhook?.name || `${brand.brandName} Error Logs`,
                avatar_url: brand.avatarUrl,
                embeds: [embed],
            }),
        });
    }
    catch (err) {
        // Silently fail — error webhook itself should not crash the bot
        console.error("[ErrorWebhook] Falha ao enviar webhook de erro:", err);
    }
}
// Funções utilitárias para uso em todo o bot
export function reportError(type, error, context) {
    const message = error?.message || String(error) || "Erro desconhecido";
    const stack = error?.stack || "";
    sendErrorWebhook({
        type,
        message,
        stack,
        context,
    }).catch(() => { });
}

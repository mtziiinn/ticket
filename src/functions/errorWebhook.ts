import { env } from "#env";
import "../constants.js";

interface ErrorReport {
  type: string;
  message: string;
  stack?: string;
  context?: string;
  guildId?: string;
  channelId?: string;
  userId?: string;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

function formatStack(stack?: string): string {
  if (!stack) return "Sem stack trace disponível.";
  const lines = stack.split("\n").slice(0, 12);
  return truncate(lines.join("\n"), 1900);
}

function getTypeColor(type: string): number {
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
      return parseInt(brand.primaryColor.replace("#", ""), 16) || 0x38bdf8; // primary
  }
}

function getTypeEmoji(type: string): string {
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

export async function sendErrorWebhook(report: ErrorReport): Promise<void> {
  const webhookUrl = process.env.ERROR_WEBHOOK_URL || brand.errorWebhook?.url;
  if (!webhookUrl) return;

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

    const locationParts: string[] = [];
    if (report.guildId) locationParts.push(`Guild: \`${report.guildId}\``);
    if (report.channelId) locationParts.push(`Canal: <#${report.channelId}>`);
    if (report.userId) locationParts.push(`User: <@${report.userId}>`);

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
  } catch (err) {
    // Silently fail — error webhook itself should not crash the bot
    console.error("[ErrorWebhook] Falha ao enviar webhook de erro:", err);
  }
}

// Funções utilitárias para uso em todo o bot
export function reportError(type: string, error: any, context?: string): void {
  const message = error?.message || String(error) || "Erro desconhecido";
  const stack = error?.stack || "";

  sendErrorWebhook({
    type,
    message,
    stack,
    context,
  }).catch(() => {});
}

/**
 * Aviso de "bot iniciado", disparado no evento ready. Cobre reinícios por
 * QUALQUER motivo — crash, deploy manual, ou o Discloud matando e subindo
 * de novo por estourar o limite de RAM — já que todos passam por aqui,
 * mesmo os que o handler de uncaughtException/unhandledRejection não
 * consegue enxergar (kill externo do host não é um evento do processo).
 */
export async function sendStartupWebhook(client: any): Promise<void> {
  const webhookUrl = process.env.ERROR_WEBHOOK_URL || brand.errorWebhook?.url;
  if (!webhookUrl) return;

  try {
    const rawPing = Math.round(client.ws?.ping);
    const ping = isNaN(rawPing) || rawPing <= 0 ? 0 : rawPing;
    const guildsCount = client.guilds?.cache?.size || 0;
    const memoryMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const unixTime = Math.floor(Date.now() / 1000);

    const embed = {
      color: 0x22c55e,
      title: `🟢 ${brand.brandName} Online — Bot Iniciado`,
      description: "O bot foi inicializado (ou reiniciado) e está operando normalmente.",
      fields: [
        { name: "Servidores", value: `\`${guildsCount}\``, inline: true },
        { name: "Latência", value: `\`${ping}ms\``, inline: true },
        { name: "Memória (RSS)", value: `\`${memoryMB} MB\``, inline: true },
        { name: "Horário", value: `<t:${unixTime}:F> (<t:${unixTime}:R>)`, inline: false },
      ],
      footer: { text: `${brand.brandName} Bot • ${env.NODE_ENV || "production"}` },
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
  } catch (err) {
    console.error("[ErrorWebhook] Falha ao enviar webhook de inicialização:", err);
  }
}

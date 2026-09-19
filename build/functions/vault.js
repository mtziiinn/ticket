import { PermissionFlagsBits } from "discord.js";
const vaultWebhookCache = new Map();
export function cleanupVaultWebhookCache() {
    const size = vaultWebhookCache.size;
    vaultWebhookCache.clear();
    return size;
}
export async function getOrCreateVaultWebhook(vaultChannel, clientUser) {
    if (!vaultChannel || typeof vaultChannel.fetchWebhooks !== "function") {
        return null;
    }
    try {
        const cached = vaultWebhookCache.get(vaultChannel.id);
        if (cached && cached.token) {
            return cached;
        }
        const webhooks = await vaultChannel.fetchWebhooks().catch(() => null);
        if (webhooks) {
            const existing = webhooks.find((w) => Boolean(w.token) &&
                (w.owner?.id === clientUser?.id ||
                    w.name === "Cofre de Mídia" ||
                    w.name === "Ticket Media Vault"));
            if (existing) {
                vaultWebhookCache.set(vaultChannel.id, existing);
                return existing;
            }
        }
        if (vaultChannel.permissionsFor && vaultChannel.guild?.members?.me) {
            const perms = vaultChannel.permissionsFor(vaultChannel.guild.members.me);
            if (!perms?.has(PermissionFlagsBits.ManageWebhooks)) {
                return null;
            }
        }
        const created = await vaultChannel.createWebhook({
            name: "Cofre de Mídia",
            avatar: clientUser?.displayAvatarURL?.({ extension: "png" }),
            reason: "Webhook único para backup de imagens de tickets",
        });
        vaultWebhookCache.set(vaultChannel.id, created);
        return created;
    }
    catch (err) {
        console.error("[Vault Webhook] Erro ao buscar/criar webhook:", err);
        return null;
    }
}
// Reenviar um anexo por URL faz o discord.js baixar o arquivo INTEIRO pra
// memória (e o corpo do upload vira outra cópia) — um arquivo de 20MB custa
// ~40MB de pico, fora do heap. Sem limite, várias mensagens com anexo ao mesmo
// tempo estouravam o container (OOM). Por isso: um upload por vez no processo
// inteiro, e arquivos grandes demais nem são baixados (fica o link original).
const MAX_VAULT_FILE_BYTES = 8 * 1024 * 1024;
let vaultQueue = Promise.resolve();
function enqueueVault(task) {
    const run = vaultQueue.then(task, task);
    vaultQueue = run.catch(() => undefined);
    return run;
}
export async function sendMediaToVault(options) {
    const { vaultChannel, clientUser, author, ticketId, channelId, attachments } = options;
    if (!vaultChannel ||
        !vaultChannel.isTextBased() ||
        attachments.length === 0) {
        return [];
    }
    const webhook = await getOrCreateVaultWebhook(vaultChannel, clientUser);
    const channelRef = channelId ? `<#${channelId}>` : `Ticket #${ticketId}`;
    const backupUrls = [];
    for (const att of attachments) {
        const fileName = att.name || "arquivo";
        if (att.size && att.size > MAX_VAULT_FILE_BYTES) {
            console.warn(`[Vault] "${fileName}" tem ${(att.size / 1048576).toFixed(1)}MB — acima do limite, backup ignorado (mantém o link original).`);
            backupUrls.push(att.url);
            continue;
        }
        backupUrls.push(await enqueueVault(() => uploadOneToVault({ vaultChannel, clientUser, author, ticketId, channelRef, webhook, att, fileName })));
    }
    return backupUrls;
}
async function uploadOneToVault(params) {
    const { vaultChannel, clientUser, author, ticketId, channelRef, webhook, att, fileName } = params;
    let permanentUrl = att.url;
    // 1. Tentar via Webhook com identidade do autor
    if (webhook && webhook.token) {
        try {
            const backup = await webhook.send({
                username: author.displayName || author.username || "Usuário",
                avatarURL: author.avatarURL ||
                    clientUser?.displayAvatarURL?.({ extension: "png" }),
                content: `📁 **Backup de Mídia** • Ticket \`${ticketId}\` (${channelRef}) | Autor: <@${author.id}> (\`${author.id}\`)`,
                files: [
                    {
                        attachment: att.url,
                        name: fileName,
                    },
                ],
                wait: true,
            });
            const url = backup?.attachments?.first?.()?.url || backup?.attachments?.[0]?.url;
            if (url) {
                permanentUrl = url;
            }
        }
        catch (err) {
            console.warn("[Vault Webhook] Falha ao enviar via webhook, tentando envio direto:", err);
            try {
                const backup = await vaultChannel.send({
                    content: `📁 **Backup de Mídia** • Ticket \`${ticketId}\` (${channelRef}) | Autor: <@${author.id}> (\`${author.id}\`)`,
                    files: [
                        {
                            attachment: att.url,
                            name: fileName,
                        },
                    ],
                });
                const url = backup?.attachments?.first?.()?.url;
                if (url)
                    permanentUrl = url;
            }
            catch (e2) {
                console.error("[Vault] Erro ao enviar anexo direto para o canal do cofre:", e2);
            }
        }
    }
    else {
        // 2. Envio direto se não houver webhook
        try {
            const backup = await vaultChannel.send({
                content: `📁 **Backup de Mídia** • Ticket \`${ticketId}\` (${channelRef}) | Autor: <@${author.id}> (\`${author.id}\`)`,
                files: [
                    {
                        attachment: att.url,
                        name: fileName,
                    },
                ],
            });
            const url = backup?.attachments?.first?.()?.url;
            if (url)
                permanentUrl = url;
        }
        catch (err) {
            console.error("[Vault] Erro ao enviar anexo para o cofre:", err);
        }
    }
    return permanentUrl;
}

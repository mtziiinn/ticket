import { PermissionFlagsBits } from "discord.js";

const vaultWebhookCache = new Map<string, any>();

export function cleanupVaultWebhookCache(): number {
  const size = vaultWebhookCache.size;
  vaultWebhookCache.clear();
  return size;
}

export async function getOrCreateVaultWebhook(
  vaultChannel: any,
  clientUser?: any,
) {
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
      const existing = webhooks.find(
        (w: any) =>
          Boolean(w.token) &&
          (w.owner?.id === clientUser?.id ||
            w.name === "Cofre de Mídia" ||
            w.name === "Ticket Media Vault"),
      );
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
  } catch (err) {
    console.error("[Vault Webhook] Erro ao buscar/criar webhook:", err);
    return null;
  }
}

export async function sendMediaToVault(options: {
  vaultChannel: any;
  clientUser?: any;
  author: {
    id: string;
    username: string;
    displayName?: string;
    avatarURL?: string;
  };
  ticketId: string;
  channelId?: string;
  attachments: Array<{ url: string; name?: string; contentType?: string }>;
}): Promise<string[]> {
  const { vaultChannel, clientUser, author, ticketId, channelId, attachments } =
    options;
  if (
    !vaultChannel ||
    !vaultChannel.isTextBased() ||
    attachments.length === 0
  ) {
    return [];
  }

  const webhook = await getOrCreateVaultWebhook(vaultChannel, clientUser);
  const channelRef = channelId ? `<#${channelId}>` : `Ticket #${ticketId}`;
  const backupUrls: string[] = [];

  for (const att of attachments) {
    let permanentUrl = att.url;
    const fileName = att.name || "arquivo";

    // 1. Tentar via Webhook com identidade do autor
    if (webhook && webhook.token) {
      try {
        const backup = await webhook.send({
          username: author.displayName || author.username || "Usuário",
          avatarURL:
            author.avatarURL ||
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

        const url =
          backup?.attachments?.first?.()?.url || backup?.attachments?.[0]?.url;
        if (url) {
          permanentUrl = url;
        }
      } catch (err) {
        console.warn(
          "[Vault Webhook] Falha ao enviar via webhook, tentando envio direto:",
          err,
        );
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
          if (url) permanentUrl = url;
        } catch (e2) {
          console.error(
            "[Vault] Erro ao enviar anexo direto para o canal do cofre:",
            e2,
          );
        }
      }
    } else {
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
        if (url) permanentUrl = url;
      } catch (err) {
        console.error("[Vault] Erro ao enviar anexo para o cofre:", err);
      }
    }

    backupUrls.push(permanentUrl);
  }

  return backupUrls;
}

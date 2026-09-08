import { createEvent } from "#base";
import { PermissionFlagsBits } from "discord.js";
import { createContainer, createSection, Separator } from "@magicyan/discord";
import { db } from "#database";
import { getEmojiTag, sendBotLog, sendMediaToVault } from "#functions";
// Rastreador leve em memória de timestamps de menções
// Chave: "guildId:userId" -> Timestamps [timestamp1, timestamp2, ...]
const mentionTracker = new Map();
// Limpeza automática periódica para evitar qualquer retenção de memória
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of mentionTracker.entries()) {
        // Se o último registro tem mais de 60 segundos, descarta do Map
        const last = timestamps[timestamps.length - 1];
        if (!last || now - last > 60000) {
            mentionTracker.delete(key);
        }
    }
}, 60000);
createEvent({
    name: "messageCreate",
    event: "messageCreate",
    async run(message) {
        if (message.author.bot)
            return;
        if (!message.guild || !message.member)
            return;
        // ==========================================
        // 1. COFRE DE MÍDIA (VAULT) EM TEMPO REAL
        // ==========================================
        if (message.attachments.size > 0) {
            try {
                const ticket = await db.tickets.getByChannel(message.channelId);
                if (ticket && !ticket.closed) {
                    const guildData = await db.guilds.get(message.guild.id);
                    const vaultChannelId = guildData?.channels?.vault || guildData?.channels?.logs;
                    if (vaultChannelId) {
                        const vaultChannel = message.guild.channels.cache.get(vaultChannelId) ||
                            (await message.guild.channels
                                .fetch(vaultChannelId)
                                .catch(() => null));
                        if (vaultChannel?.isTextBased()) {
                            const atts = Array.from(message.attachments.values()).map((a) => ({
                                url: a.url,
                                name: a.name,
                                contentType: a.contentType || undefined,
                            }));
                            await sendMediaToVault({
                                vaultChannel,
                                clientUser: message.client.user,
                                author: {
                                    id: message.author.id,
                                    username: message.author.username,
                                    displayName: message.member?.displayName,
                                    avatarURL: message.author.displayAvatarURL({
                                        extension: "png",
                                        forceStatic: true,
                                    }),
                                },
                                ticketId: ticket.ticketId || "TICKET",
                                channelId: message.channelId,
                                attachments: atts,
                            });
                        }
                    }
                }
            }
            catch (err) {
                console.error("[Vault Realtime] Erro ao salvar anexo no cofre:", err);
            }
        }
        // Ignorar Administradores e quem tem permissão de gerenciar mensagens para anti-flood
        if (message.member.permissions.has(PermissionFlagsBits.Administrator) ||
            message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return;
        }
        try {
            const guildData = await db.guilds.get(message.guild.id);
            const af = guildData?.antiflood;
            // Se o anti-flood estiver desligado, ignora
            if (!af?.enabled)
                return;
            const staffRoleId = guildData.channels?.staffRole;
            // Se o próprio autor tiver o cargo da equipe, ignora
            if (staffRoleId && message.member.roles.cache.has(staffRoleId)) {
                return;
            }
            // 1. Verificar se houve menção ao cargo da staff
            const mentionedStaffRole = Boolean(staffRoleId) && message.mentions.roles.has(staffRoleId);
            // 2. Verificar se houve menção a membros que possuem o cargo da staff
            const mentionedStaffMember = message.mentions.members &&
                message.mentions.members.some((m) => {
                    if (m.id === message.author.id)
                        return false;
                    if (staffRoleId && m.roles.cache.has(staffRoleId))
                        return true;
                    return m.permissions.has(PermissionFlagsBits.ManageMessages);
                });
            // 3. Verificar se houve menção ao atendente que assumiu o ticket
            let mentionedClaimer = false;
            if (message.mentions.users.size > 0) {
                const ticket = await db.tickets.getByChannel(message.channelId);
                if (ticket?.claimedBy &&
                    ticket.claimedBy !== message.author.id &&
                    message.mentions.users.has(ticket.claimedBy)) {
                    mentionedClaimer = true;
                }
            }
            const hasStaffMention = mentionedStaffRole || mentionedStaffMember || mentionedClaimer;
            if (!hasStaffMention)
                return;
            // Controle de Flood / Janela de Tempo
            const now = Date.now();
            const key = `${message.guild.id}:${message.author.id}`;
            const windowSeconds = af.windowSeconds ?? 10;
            const windowMs = windowSeconds * 1000;
            const maxMentions = af.maxMentions ?? 3;
            const timeoutMinutes = af.timeoutMinutes ?? 5;
            let timestamps = mentionTracker.get(key) || [];
            // Manter apenas timestamps dentro da janela atual
            timestamps = timestamps.filter((t) => now - t < windowMs);
            timestamps.push(now);
            mentionTracker.set(key, timestamps);
            // Se atingiu o limite de menções dentro da janela
            if (timestamps.length >= maxMentions) {
                mentionTracker.delete(key); // Reset para evitar re-punições em cascata
                const timeoutMs = timeoutMinutes * 60 * 1000;
                // Tentar aplicar o timeout no membro
                const timeoutApplied = await message.member
                    .timeout(timeoutMs, `[Anti-Flood] Menções excessivas à equipe (${timestamps.length} em ${windowSeconds}s)`)
                    .then(() => true)
                    .catch((err) => {
                    console.error(`[Anti-Flood] Erro ao aplicar timeout em ${message.author.id}:`, err);
                    return false;
                });
                if (!timeoutApplied)
                    return;
                // Container de aviso no canal
                const warningContainer = createContainer("#ef4444", createSection({
                    content: `## ${getEmojiTag("shield")} Castigo Aplicado (Anti-Flood)\nO membro <@${message.author.id}> recebeu um timeout de **${timeoutMinutes} minutos** por marcar a equipe excessivamente.`,
                    thumbnail: message.author.displayAvatarURL(),
                }), Separator.Default, [
                    `| ${getEmojiTag("action_warning")} **Motivo:** Menções repetitivas à equipe (\`${maxMentions} menções\` em \`${windowSeconds}s\`).`,
                    `| ${getEmojiTag("clock")} **Duração:** \`${timeoutMinutes} minuto(s)\` de castigo.`,
                    `| ${getEmojiTag("folder")} **Canal:** <#${message.channelId}>`,
                ].join("\n"), Separator.Default, `*Por favor, aguarde o atendimento da equipe sem ficar marcando os membros repetidamente.*`);
                await message
                    .reply({
                    components: [warningContainer],
                    flags: ["IsComponentsV2"],
                })
                    .catch(() => { });
                // Log do evento
                await sendBotLog(message.guild, () => createContainer("#ef4444", createSection({
                    content: `## ${getEmojiTag("shield")} [Anti-Flood] Castigo Aplicado\nUm membro foi silenciado por marcar a equipe em excesso.`,
                    thumbnail: message.author.displayAvatarURL(),
                }), Separator.Default, [
                    `| ${getEmojiTag("user")} **Infrator:** <@${message.author.id}> (\`${message.author.tag}\` | \`${message.author.id}\`)`,
                    `| ${getEmojiTag("folder")} **Canal:** <#${message.channelId}>`,
                    `| ${getEmojiTag("clock")} **Duração do Castigo:** \`${timeoutMinutes} minutos\``,
                    `| ${getEmojiTag("action_warning")} **Menções Detectadas:** \`${maxMentions} menções\` em \`${windowSeconds} segundos\``,
                ].join("\n")));
            }
        }
        catch (err) {
            console.error("[Anti-Flood] Erro ao processar mensagem:", err);
        }
    },
});

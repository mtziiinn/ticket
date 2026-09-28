import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "guildScheduledEventCreate",
    event: "guildScheduledEventCreate",
    async run(event) {
        const guild = event.guild;
        if (!guild)
            return;
        try {
            const executor = await getAuditLogExecutor(guild, AuditLogEvent.GuildScheduledEventCreate, event.id);
            const container = createContainer(constants.colors.primary, `## ${getEmojiTag("calendar_add")} Evento Criado`, [
                `| ${getEmojiTag("calendar")} \`${event.name}\``,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(guild, container);
        }
        catch (err) {
            console.error("[guildScheduledEventCreate] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "guildScheduledEventDelete",
    event: "guildScheduledEventDelete",
    async run(event) {
        const guild = event.guild;
        if (!guild)
            return;
        try {
            const executor = await getAuditLogExecutor(guild, AuditLogEvent.GuildScheduledEventDelete, event.id);
            const container = createContainer("#ef4444", `## ${getEmojiTag("calendar_remove")} Evento Excluído`, [
                `| ${getEmojiTag("calendar")} \`${event.name}\``,
                executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(guild, container);
        }
        catch (err) {
            console.error("[guildScheduledEventDelete] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "guildScheduledEventUpdate",
    event: "guildScheduledEventUpdate",
    async run(oldEvent, newEvent) {
        const guild = newEvent.guild;
        if (!guild || !oldEvent)
            return;
        try {
            const changes = [];
            if (oldEvent.name !== newEvent.name) {
                changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldEvent.name}\` ➔ \`${newEvent.name}\``);
            }
            if (oldEvent.description !== newEvent.description) {
                changes.push(`• ${getEmojiTag("clipboard")} Descrição alterada`);
            }
            if (oldEvent.scheduledStartTimestamp !== newEvent.scheduledStartTimestamp) {
                changes.push(`• ${getEmojiTag("clock")} Início reagendado`);
            }
            if (oldEvent.scheduledEndTimestamp !== newEvent.scheduledEndTimestamp) {
                changes.push(`• ${getEmojiTag("clock")} Término reagendado`);
            }
            if (oldEvent.privacyLevel !== newEvent.privacyLevel) {
                changes.push(`• ${getEmojiTag("shield")} Privacidade alterada`);
            }
            if (oldEvent.status !== newEvent.status) {
                changes.push(`• ${getEmojiTag("action_info")} Status: \`${oldEvent.status}\` ➔ \`${newEvent.status}\``);
            }
            if (oldEvent.image !== newEvent.image) {
                changes.push(`• ${getEmojiTag("file")} Imagem de capa atualizada`);
            }
            if (changes.length === 0)
                return;
            const executor = await getAuditLogExecutor(guild, AuditLogEvent.GuildScheduledEventUpdate, newEvent.id);
            const container = createContainer("#eab308", `## ${getEmojiTag("calendar_check")} Evento Atualizado`, [
                `| ${getEmojiTag("calendar")} \`${newEvent.name}\``,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
                changes.join("\n"),
            ].filter(Boolean).join("\n"));
            await sendBotLog(guild, container);
        }
        catch (err) {
            console.error("[guildScheduledEventUpdate] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "guildScheduledEventUserAdd",
    event: "guildScheduledEventUserAdd",
    async run(event, user) {
        const guild = event.guild;
        if (!guild)
            return;
        try {
            const container = createContainer(constants.colors.primary, `## ${getEmojiTag("calendar_check")} Interesse em Evento`, [
                `| ${getEmojiTag("calendar")} \`${event.name}\``,
                `| ${getEmojiTag("user")} <@${user.id}> confirmou interesse`,
            ].join("\n"));
            await sendBotLog(guild, container);
        }
        catch (err) {
            console.error("[guildScheduledEventUserAdd] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "guildScheduledEventUserRemove",
    event: "guildScheduledEventUserRemove",
    async run(event, user) {
        const guild = event.guild;
        if (!guild)
            return;
        try {
            const container = createContainer("#eab308", `## ${getEmojiTag("calendar_x")} Interesse Removido de Evento`, [
                `| ${getEmojiTag("calendar")} \`${event.name}\``,
                `| ${getEmojiTag("user")} <@${user.id}> desmarcou interesse`,
            ].join("\n"));
            await sendBotLog(guild, container);
        }
        catch (err) {
            console.error("[guildScheduledEventUserRemove] Erro ao registrar log:", err);
        }
    },
});

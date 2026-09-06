import { createEvent } from "#base";
import { createContainer, Separator } from "@magicyan/discord";
import { AuditLogEvent, ChannelType } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
const channelTypeMap = {
    [ChannelType.GuildText]: "Texto",
    [ChannelType.GuildVoice]: "Voz",
    [ChannelType.GuildCategory]: "Categoria",
    [ChannelType.GuildAnnouncement]: "Anúncios",
    [ChannelType.GuildStageVoice]: "Palco",
    [ChannelType.GuildForum]: "Fórum",
};
createEvent({
    name: "channelCreate",
    event: "channelCreate",
    async run(channel) {
        if (!channel.guild)
            return;
        try {
            const executor = await getAuditLogExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
            const typeName = channelTypeMap[channel.type] || `Tipo ${channel.type}`;
            const parentName = channel.parent ? channel.parent.name : "Nenhuma";
            const timestamp = Math.floor(Date.now() / 1000);
            const container = createContainer("#22c55e", `## ${getEmojiTag("action_check")} Canal Criado`, Separator.Default, [
                `| ${getEmojiTag("folder")} **Canal:** <#${channel.id}> (\`${channel.name}\`)`,
                `| ${getEmojiTag("action_info")} **Tipo:** \`${typeName}\``,
                `| ${getEmojiTag("folder_open")} **Categoria:** \`${parentName}\``,
                `| ${getEmojiTag("user_check")} **Criado por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
                `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
            ].join("\n"));
            await sendBotLog(channel.guild, container);
        }
        catch (err) {
            console.error("[channelCreate] Erro ao registrar log:", err);
        }
    },
});

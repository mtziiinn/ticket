import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
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
            const container = createContainer("#38bdf8", `## ${getEmojiTag("action_check")} Canal Criado`, [
                `| <#${channel.id}> (\`${typeName}\`)`,
                executor ? `| Por: <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(channel.guild, container);
        }
        catch (err) {
            console.error("[channelCreate] Erro ao registrar log:", err);
        }
    },
});

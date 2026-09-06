import { createEvent } from "#base";
import { createContainer, Separator } from "@magicyan/discord";
import { AuditLogEvent, ChannelType, } from "discord.js";
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
    name: "channelDelete",
    event: "channelDelete",
    async run(channel) {
        if (channel.isDMBased() || !channel.guild)
            return;
        try {
            const executor = await getAuditLogExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
            const typeName = channelTypeMap[channel.type] || `Tipo ${channel.type}`;
            const timestamp = Math.floor(Date.now() / 1000);
            const container = createContainer("#ef4444", `## ${getEmojiTag("action_x")} Canal Excluído`, Separator.Default, [
                `| ${getEmojiTag("folder")} **Canal:** \`#${channel.name}\` (\`${channel.id}\`)`,
                `| ${getEmojiTag("action_info")} **Tipo:** \`${typeName}\``,
                `| ${getEmojiTag("user_remove")} **Excluído por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
                `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
            ].join("\n"));
            await sendBotLog(channel.guild, container);
        }
        catch (err) {
            console.error("[channelDelete] Erro ao registrar log:", err);
        }
    },
});

import { db } from "#database";
import { createContainer, createSection, Separator } from "@magicyan/discord";
export async function sendActionLog(guild, ticket, staff, actionName, details) {
    try {
        const guildData = await db.guilds.get(guild.id);
        const logChannelId = guildData.channels?.tickets;
        if (!logChannelId)
            return;
        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel?.isTextBased())
            return;
        const openedAtTimestamp = Math.floor(ticket.openedAt.getTime() / 1000);
        const logContainer = createContainer(constants.colors.primary, createSection({
            content: `## <:shield:1502789938532450304> Ação Administrativa: Atendimento ${ticket.ticketId}\nAbaixo estão as informações da ação realizada no ticket por um Staff.`,
            thumbnail: staff.displayAvatarURL(),
        }), Separator.Default, `**Informações do Evento**\n` +
            [
                `<:user_check:1502789974276178121> **Staff Responsável:** ${staff} (\`${staff.id}\`)`,
                `<:folder:1502789880214720533> **Ação Realizada:** \`${actionName.toUpperCase()}\``,
                `<:clipboard:1502789887907205293> **Detalhes:** ${details}`,
            ].join("\n"), Separator.Default, `**Detalhes do Atendimento**\n` +
            [
                `<:other_ticket:1502789959378145300> **Ticket ID:** \`${ticket.ticketId}\``,
                `<:user:1502789979229913268> **Dono do Ticket:** <@${ticket.ownerId}> (\`${ticket.ownerId}\`)`,
                `<:clock:1502789859960422502> **Aberto em:** <t:${openedAtTimestamp}:f>`,
            ].join("\n"));
        await logChannel.send({
            components: [logContainer],
            flags: ["IsComponentsV2"],
        }).catch((err) => console.error("[Action Log] Erro ao enviar:", err));
    }
    catch (error) {
        console.error("[Action Log] Erro na função sendActionLog:", error);
    }
}

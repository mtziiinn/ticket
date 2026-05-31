import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createSection, Separator, createRow, } from "@magicyan/discord";
import { UserSelectMenuBuilder, StringSelectMenuBuilder, } from "discord.js";
import { db } from "#database";
import { sendActionLog } from "./logger.js";
// Função para renderizar o painel de gerenciamento de membros
export async function renderMembersPanel(interaction, channel, ticket, guild) {
    // 1. Obter membros com permissões personalizadas de leitura/escrita no canal
    const membersWithAccess = [];
    const overwrites = channel.permissionOverwrites.cache;
    for (const [id, overwrite] of overwrites.entries()) {
        // Ignorar dono do ticket, o bot em si, e cargos (tipo 0 = Role)
        if (overwrite.type === 1 && id !== ticket.ownerId && id !== guild.client.user?.id) {
            const member = await guild.members.fetch(id).catch(() => null);
            if (member) {
                membersWithAccess.push(member);
            }
        }
    }
    const componentsList = [];
    // Dropdown 1: Adicionar Membro (Dropdown nativo do Discord para buscar usuários)
    componentsList.push(createRow(new UserSelectMenuBuilder({
        customId: "ticket/manage/members/add_select",
        placeholder: "🔍 Selecione o usuário para ADICIONAR...",
    })));
    // Dropdown 2: Remover Membro (Dropdown de string com os membros adicionados)
    if (membersWithAccess.length > 0) {
        componentsList.push(createRow(new StringSelectMenuBuilder({
            customId: "ticket/manage/members/remove_select",
            placeholder: "❌ Selecione o usuário para REMOVER...",
            options: membersWithAccess.map((m) => ({
                label: m.user.tag || m.user.username,
                value: m.id,
                description: `ID: ${m.id}`,
            })),
        })));
    }
    const container = createContainer(constants.colors.primary, createSection({
        content: `## <:user_add:1502789796278304800> Gerenciar Acessos ao Atendimento\nUse os menus abaixo para adicionar novos usuários ao atendimento ou para remover membros que já possuem acesso ao canal.`,
        thumbnail: interaction.user.displayAvatarURL(),
    }), Separator.Default, membersWithAccess.length > 0
        ? `<:user_check:1502789974276178121> **Membros com acesso atualmente:**\n` +
            membersWithAccess.map((m) => `> • ${m} (\`${m.id}\`)`).join("\n")
        : `*Nenhum membro adicional possui acesso a este atendimento no momento.*`);
    const payload = {
        components: [container, ...componentsList],
        flags: ["Ephemeral", "IsComponentsV2"],
    };
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => null);
    }
    else {
        await interaction.update(payload).catch(() => null);
    }
}
// Responder para ADICIONAR membro via User Select
createResponder({
    customId: "ticket/manage/members/add_select",
    types: [ResponderType.UserSelect],
    cache: "cached",
    async run(interaction) {
        const { guild, channel, values, user } = interaction;
        if (!channel?.isTextBased())
            return;
        await interaction.deferUpdate();
        const ticket = await db.tickets.getByChannel(channel.id);
        if (!ticket)
            return;
        const targetId = values[0];
        if (targetId === ticket.ownerId) {
            await interaction.followUp({
                content: "❌ Você não pode adicionar o dono do ticket como membro adicional.",
                flags: ["Ephemeral"],
            }).catch(() => null);
            return;
        }
        const targetMember = await guild.members.fetch(targetId).catch(() => null);
        if (!targetMember) {
            await interaction.followUp({
                content: "❌ Usuário não encontrado no servidor.",
                flags: ["Ephemeral"],
            }).catch(() => null);
            return;
        }
        // Adicionar permissões
        await channel.permissionOverwrites.edit(targetId, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true,
        });
        // Enviar mensagem no canal do ticket
        await channel.send({
            content: `<:user_add:1502789796278304800> ${targetMember} foi adicionado ao ticket por ${user}.`,
        }).catch(() => null);
        // Enviar Log de Ação
        await sendActionLog(guild, ticket, user, "Adicionar Membro", `Adicionou o membro ${targetMember} (\`${targetId}\`) ao canal do ticket.`);
        // Renderizar painel novamente com dados atualizados
        await renderMembersPanel(interaction, channel, ticket, guild);
    },
});
// Responder para REMOVER membro via String Select
createResponder({
    customId: "ticket/manage/members/remove_select",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        const { guild, channel, values, user } = interaction;
        if (!channel?.isTextBased())
            return;
        await interaction.deferUpdate();
        const ticket = await db.tickets.getByChannel(channel.id);
        if (!ticket)
            return;
        const targetId = values[0];
        const targetMember = await guild.members.fetch(targetId).catch(() => null);
        // Remover permissões
        await channel.permissionOverwrites.delete(targetId).catch(() => null);
        // Enviar mensagem no canal do ticket
        await channel.send({
            content: `<:user_remove:1502789800967536741> ${targetMember || `Usuário (\`${targetId}\`)`} foi removido do ticket por ${user}.`,
        }).catch(() => null);
        // Enviar Log de Ação
        await sendActionLog(guild, ticket, user, "Remover Membro", `Removeu o membro ${targetMember || `Usuário (\`${targetId}\`)`} do canal do ticket.`);
        // Renderizar painel novamente com dados atualizados
        await renderMembersPanel(interaction, channel, ticket, guild);
    },
});

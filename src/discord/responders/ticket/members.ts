import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { modalFieldsToRecord } from "@magicyan/discord";

// Função compartilhada para membros
async function processMembers(interaction: any) {
  const { channel, fields, guild } = interaction;
  if (!channel?.isTextBased()) return;

  try {
    const data = modalFieldsToRecord(fields);
    const memberIdRaw = data.member;

    // Em Modais V2, Select Menus podem retornar string[]
    const memberId = Array.isArray(memberIdRaw)
      ? memberIdRaw[0]
      : (memberIdRaw as string);

    if (!memberId) {
      await interaction.reply({
        content: "Nenhum usuário foi selecionado.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const targetMember = await guild.members.fetch(memberId).catch(() => null);
    if (!targetMember) {
      await interaction.reply({
        content: "Usuário não encontrado no servidor.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const hasPermission = channel.permissionOverwrites.cache.has(memberId);

    if (hasPermission) {
      await channel.permissionOverwrites.delete(memberId);
      await interaction.reply({
        content: `<:user_remove:1502789800967536741> ${targetMember} foi removido do ticket.`,
        flags: ["Ephemeral"],
      });
    } else {
      await channel.permissionOverwrites.edit(memberId, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
      });
      await interaction.reply({
        content: `<:user_add:1502789796278304800> ${targetMember} foi adicionado ao ticket.`,
        flags: ["Ephemeral"],
      });
    }
  } catch (error) {
    console.error("[Membros] Erro ao processar:", error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "Ocorreu um erro ao gerenciar o membro.",
        flags: ["Ephemeral"],
      });
    }
  }
}

// Responder Original
createResponder({
  customId: "ticket/manage/members/submit",
  types: [ResponderType.Modal, ResponderType.ModalComponent], // Adicionado ModalComponent
  cache: "cached",
  async run(interaction) {
    await processMembers(interaction);
  },
});

// Responder de Backup (Título)
createResponder({
  customId: "Gerenciar Membros",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction) {
    await processMembers(interaction);
  },
});

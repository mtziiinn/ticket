import { createCommand } from "#base";
import { ApplicationCommandType, PermissionFlagsBits } from "discord.js";
import {
  ActionRowBuilder,
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { db } from "#database";
import { getEmojiTag } from "#functions";

createCommand({
  name: "anunciar",
  description: "Cria e envia um comunicado oficial com formulário (canal e/ou DM)",
  type: ApplicationCommandType.ChatInput,
  async run(interaction) {
    if (!interaction.inCachedGuild()) return;

    const member = interaction.member;
    const isStaffOrAdmin =
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!isStaffOrAdmin) {
      const guildData = await db.guilds.get(interaction.guild.id);
      const staffRoleId = guildData?.channels?.staffRole;
      const hasStaffRole = Boolean(staffRoleId && member.roles.cache.has(staffRoleId));

      if (!hasStaffRole) {
        await interaction.reply({
          content: `${getEmojiTag("action_x")} Você não possui permissão para utilizar o comando \`/anunciar\`.`,
          flags: ["Ephemeral"],
        });
        return;
      }
    }

    const modal = new ModalBuilder()
      .setCustomId("anunciar/modal")
      .setTitle("Comunicado Oficial");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("assunto")
          .setLabel("Assunto do comunicado")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("mensagem")
          .setLabel("Mensagem do comunicado (opcional)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(2000),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("anexo")
          .setLabel("URL de imagem ou vídeo (opcional)")
          .setPlaceholder("Link de vídeo (YouTube, MP4, Streamable...) ou imagem")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(400),
      ),
      new LabelBuilder()
        .setLabel("Arquivo ou Vídeo para enviar (opcional)")
        .setDescription(
          "Anexe um arquivo ou vídeo real (MP4, imagem ou documento) para enviar junto com o comunicado.",
        )
        .setFileUploadComponent(
          new FileUploadBuilder()
            .setCustomId("arquivo_upload")
            .setRequired(false)
            .setMaxValues(1),
        ),
    );

    try {
      await interaction.showModal(modal);
    } catch {
      const fallbackModal = new ModalBuilder()
        .setCustomId("anunciar/modal")
        .setTitle("Comunicado Oficial");

      fallbackModal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("assunto")
            .setLabel("Assunto do comunicado")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("mensagem")
            .setLabel("Mensagem do comunicado (opcional)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(2000),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("anexo")
            .setLabel("URL de imagem ou vídeo (opcional)")
            .setPlaceholder("Link de vídeo (YouTube, MP4, Streamable...) ou imagem")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(400),
        ),
      );

      await interaction.showModal(fallbackModal);
    }
  },
});

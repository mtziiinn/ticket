import { createCommand } from "#base";
import { ApplicationCommandType, PermissionFlagsBits } from "discord.js";
import { ActionRowBuilder, FileUploadBuilder, LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, } from "discord.js";
createCommand({
    name: "anunciar",
    description: "Cria e envia um comunicado oficial com formulário (canal e/ou DM)",
    type: ApplicationCommandType.ChatInput,
    defaultMemberPermissions: PermissionFlagsBits.ManageChannels,
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        const modal = new ModalBuilder()
            .setCustomId("anunciar/modal")
            .setTitle("Comunicado Oficial Prism");
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("assunto")
            .setLabel("Assunto do comunicado")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200)), new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("mensagem")
            .setLabel("Mensagem do comunicado (opcional)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(2000)), new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("anexo")
            .setLabel("URL do anexo/imagem (opcional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(400)), new LabelBuilder()
            .setLabel("Arquivo para enviar (opcional)")
            .setDescription("Anexe um arquivo real para enviar junto com o comunicado (1 arquivo, imagem ou documento).")
            .setFileUploadComponent(new FileUploadBuilder()
            .setCustomId("arquivo_upload")
            .setRequired(false)
            .setMaxValues(1)));
        await interaction.showModal(modal);
    },
});

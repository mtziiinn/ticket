import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { FileUploadBuilder, LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, } from "discord.js";
import { db } from "#database";
import { renderTab } from "./panelView.js";
import { updatePanelResponse } from "./panelResponders.js";
import { parsePanelJson, SYSTEM_NAMES, getEmojiTag } from "#functions";
// 1. ABRIR MODAL DE CONFIGURAÇÃO JSON
createResponder({
    customId: "panel/:system/custom_json/open",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction, { system }) {
        const sysName = SYSTEM_NAMES[system] || system.toUpperCase();
        const modal = new ModalBuilder()
            .setCustomId(`panel/${system}/custom_json/submit`)
            .setTitle(`Personalizar Painel (${sysName})`.slice(0, 45));
        const textInput = new TextInputBuilder()
            .setCustomId("json_text")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Cole o código JSON aqui (ou anexe arquivo abaixo)...")
            .setRequired(false);
        const guildData = await db.guilds.get(interaction.guild.id);
        const existing = guildData?.customPanels?.[system];
        if (existing) {
            try {
                const jsonStr = JSON.stringify(existing.raw || existing, null, 2);
                if (jsonStr.length <= 4000) {
                    textInput.setValue(jsonStr);
                }
            }
            catch { }
        }
        const textLabel = new LabelBuilder()
            .setLabel("Código JSON do Painel (Texto):")
            .setDescription("Cole o JSON exportado do site embed.insidebots.com.br ou Components V2")
            .setTextInputComponent(textInput);
        const fileUpload = new FileUploadBuilder()
            .setCustomId("json_file")
            .setRequired(false)
            .setMaxValues(1);
        const fileLabel = new LabelBuilder()
            .setLabel("Ou Anexe o Arquivo (.txt / .json):")
            .setDescription("Envie o arquivo caso o JSON ultrapasse 4.000 caracteres.")
            .setFileUploadComponent(fileUpload);
        modal.addComponents(textLabel, fileLabel);
        await interaction.showModal(modal);
    },
});
// 2. PROCESSAR SUBMISSÃO DO MODAL JSON
createResponder({
    customId: "panel/:system/custom_json/submit",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction, { system }) {
        let rawContent = "";
        try {
            const uploadedFiles = interaction.fields.getUploadedFiles?.("json_file");
            const attachment = uploadedFiles?.first?.() ||
                (uploadedFiles?.values ? Array.from(uploadedFiles.values())[0] : null);
            if (attachment && attachment.url) {
                const res = await fetch(attachment.url);
                if (res.ok) {
                    rawContent = await res.text();
                }
            }
        }
        catch (err) {
            console.warn("[Panel Custom JSON] Erro ao baixar arquivo anexado:", err);
        }
        if (!rawContent || !rawContent.trim()) {
            try {
                rawContent = interaction.fields.getTextInputValue("json_text") || "";
            }
            catch { }
        }
        if (!rawContent || !rawContent.trim()) {
            await interaction.reply({
                flags: ["Ephemeral"],
                content: `${getEmojiTag("action_warning")} Nenhum código JSON foi fornecido nem via texto nem via arquivo.`,
            });
            return;
        }
        const parseResult = parsePanelJson(rawContent);
        if (!parseResult.success || !parseResult.data) {
            await interaction.reply({
                flags: ["Ephemeral"],
                content: `${getEmojiTag("action_x")} **Erro ao processar JSON:**\n\`\`\`\n${parseResult.error || "Formato inválido"}\n\`\`\``,
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.customPanels) {
            guildData.customPanels = {};
        }
        guildData.customPanels[system] = parseResult.data;
        guildData.markModified("customPanels");
        await guildData.save();
        const container = await renderTab(system === "ticket" || system === "verification" || system === "json" ? system : "json", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
        const sysName = SYSTEM_NAMES[system] || system;
        await interaction.followUp({
            flags: ["Ephemeral"],
            content: `${getEmojiTag("action_check")} O painel de **${sysName}** foi personalizado com sucesso via JSON! Ao enviar o painel no canal, o seu design visual configurado será exibido com os botões oficiais do sistema.`,
        });
    },
});
// 3. RESETAR PAINEL JSON PARA O PADRÃO
createResponder({
    customId: "panel/:system/custom_json/reset",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction, { system }) {
        const guildData = await db.guilds.get(interaction.guild.id);
        if (guildData?.customPanels && guildData.customPanels[system]) {
            delete guildData.customPanels[system];
            guildData.markModified("customPanels");
            await guildData.save();
        }
        const container = await renderTab(system === "ticket" || system === "verification" || system === "json" ? system : "json", interaction.guild, interaction.client, guildData);
        await updatePanelResponse(interaction, container);
        const sysName = SYSTEM_NAMES[system] || system;
        await interaction.followUp({
            flags: ["Ephemeral"],
            content: `${getEmojiTag("action_remove")} A personalização via JSON do painel de **${sysName}** foi removida e restaurada para o padrão oficial do bot.`,
        });
    },
});

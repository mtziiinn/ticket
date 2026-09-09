import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, FileUploadBuilder, LabelBuilder, } from "discord.js";
import { createContainer, Separator } from "@magicyan/discord";
import { db } from "#database";
import { renderAnunciosTab, formatHexColor, getBannerUrl } from "./panelView.js";
import { updatePanelResponse } from "./panelResponders.js";
import { sendChannelAnnouncement, sendDMAnnouncement, resolveRoleRecipients, parsePanelJson, buildCustomOrFallbackPayload, getEmojiTag, } from "#functions";
createResponder({
    customId: "panel/anuncios/select_channel",
    types: [ResponderType.ChannelSelect],
    cache: "cached",
    async run(interaction) {
        const channelId = interaction.values[0];
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.announcements)
            guildData.announcements = {};
        guildData.announcements.channelId = channelId;
        guildData.markModified("announcements");
        await guildData.save();
        const container = renderAnunciosTab(guildData);
        await updatePanelResponse(interaction, container);
    },
});
createResponder({
    customId: "panel/anuncios/select_role",
    types: [ResponderType.RoleSelect],
    cache: "cached",
    async run(interaction) {
        const roleIds = interaction.values.slice(0, 25);
        const guildData = await db.guilds.get(interaction.guild.id);
        if (!guildData.announcements)
            guildData.announcements = {};
        guildData.announcements.dmRoleIds = roleIds;
        guildData.markModified("announcements");
        await guildData.save();
        const container = renderAnunciosTab(guildData);
        await updatePanelResponse(interaction, container);
    },
});
createResponder({
    customId: "panel/anuncios/modal_canal",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Apenas administradores ou moderadores podem enviar comunicados.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId("panel/anuncios/modal_canal")
            .setTitle(`Anúncio em Canal (${brand.brandName})`);
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título do Comunicado")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)), new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("mensagem")
            .setLabel("Texto do Anúncio")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Use \\n para quebrar linhas")
            .setRequired(true)
            .setMaxLength(4000)), new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("mencionar")
            .setLabel("Mencionar @everyone? (sim/não)")
            .setValue("não")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(5)), new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("cor")
            .setLabel("Cor em HEX (Opcional - padrão #38bdf8)")
            .setPlaceholder("Ex: #38bdf8")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(9)), new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("imagem")
            .setLabel("URL da Imagem / Thumbnail (Opcional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(300)));
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/anuncios/modal_canal",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Apenas administradores ou moderadores podem enviar comunicados.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const titulo = interaction.fields.getTextInputValue("titulo").trim();
        const mensagem = interaction.fields.getTextInputValue("mensagem").trim();
        const mencionarInput = (interaction.fields.getTextInputValue("mencionar") || "").toLowerCase().trim();
        const mencionar = ["sim", "s", "yes", "1", "true"].includes(mencionarInput);
        const cor = (interaction.fields.getTextInputValue("cor") || "").trim() || undefined;
        const imagem = (interaction.fields.getTextInputValue("imagem") || "").trim() || undefined;
        const guildData = await db.guilds.get(interaction.guildId);
        const targetId = guildData.announcements?.channelId;
        let targetChannel = (targetId &&
            interaction.guild.channels.cache.get(targetId)) ||
            undefined;
        if (!targetChannel && interaction.channel && "send" in interaction.channel) {
            targetChannel = interaction.channel;
        }
        if (!targetChannel) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Selecione um canal de texto no menu da aba de Anúncios.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction.deferReply({ flags: ["Ephemeral"] });
        try {
            const barImage = getBannerUrl(guildData);
            const authorName = interaction.member.displayName || interaction.user.username;
            await sendChannelAnnouncement({
                channel: targetChannel,
                title: titulo,
                message: mensagem,
                color: cor,
                image: imagem,
                mentionEveryone: mencionar,
                authorName,
                authorId: interaction.user.id,
                barImage,
            });
            const successContainer = createContainer(formatHexColor("#38bdf8"), `## ${getEmojiTag("action_check")} Anúncio Publicado com Sucesso`, Separator.Default, `O comunicado oficial foi enviado com sucesso para <#${targetChannel.id}>!`);
            await interaction.editReply({
                components: [successContainer],
                flags: ["IsComponentsV2"],
            });
        }
        catch (err) {
            const errContainer = createContainer(formatHexColor("#ef4444"), `## ${getEmojiTag("action_x")} Falha ao Enviar Comunicado`, Separator.Default, `Ocorreu um erro ao enviar o anúncio: \`${err.message}\``);
            await interaction.editReply({
                components: [errContainer],
                flags: ["IsComponentsV2"],
            });
        }
    },
});
createResponder({
    customId: "panel/anuncios/modal_dm",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Apenas administradores ou moderadores podem disparar comunicados na DM.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId("panel/anuncios/modal_dm")
            .setTitle(`Disparo na DM (${brand.brandName})`);
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título do Comunicado")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)), new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("mensagem")
            .setLabel("Texto do Anúncio")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Use \\n para quebrar linhas")
            .setRequired(true)
            .setMaxLength(4000)), new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("cor")
            .setLabel("Cor em HEX (Opcional - padrão #38bdf8)")
            .setPlaceholder("Ex: #38bdf8")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(9)), new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("imagem")
            .setLabel("URL da Imagem / Thumbnail (Opcional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(300)));
        await interaction.showModal(modal);
    },
});
createResponder({
    customId: "panel/anuncios/modal_dm",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Apenas administradores ou moderadores podem disparar comunicados na DM.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const titulo = interaction.fields.getTextInputValue("titulo").trim();
        const mensagem = interaction.fields.getTextInputValue("mensagem").trim();
        const cor = (interaction.fields.getTextInputValue("cor") || "").trim() || undefined;
        const imagem = (interaction.fields.getTextInputValue("imagem") || "").trim() || undefined;
        const guildData = await db.guilds.get(interaction.guildId);
        const roleIds = guildData.announcements?.dmRoleIds;
        if (!roleIds || roleIds.length === 0) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Selecione ao menos um cargo-alvo no menu da aba de Anúncios para disparar por DM.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const roles = roleIds
            .map((id) => interaction.guild.roles.cache.get(id))
            .filter((role) => Boolean(role));
        if (roles.length === 0) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Nenhum dos cargos-alvo configurados foi encontrado no servidor.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction.deferReply({ flags: ["Ephemeral"] });
        try {
            const barImage = getBannerUrl(guildData);
            const authorName = interaction.member.displayName || interaction.user.username;
            const { recipients, success, failed } = await sendDMAnnouncement({
                guild: interaction.guild,
                role: roles,
                title: titulo,
                message: mensagem,
                color: cor,
                image: imagem,
                barImage,
                authorName,
                authorId: interaction.user.id,
            });
            if (recipients === 0) {
                const errContainer = createContainer(formatHexColor("#ef4444"), `## ${getEmojiTag("action_warning")} Nenhum Membro Encontrado`, Separator.Default, `Nenhum membro ativo possui algum dos cargos selecionados.`);
                await interaction.editReply({
                    components: [errContainer],
                    flags: ["IsComponentsV2"],
                });
                return;
            }
            const reportContainer = createContainer(formatHexColor("#38bdf8"), `## ${getEmojiTag("action_check")} Disparo de DM Finalizado`, Separator.Default, `O comunicado oficial foi processado para os membros dos cargos ${roles
                .map((r) => `<@&${r.id}>`)
                .join(", ")}:\n\n` +
                `• ${getEmojiTag("action_check")} **Entregues com Sucesso:** \`${success}\`\n` +
                `• ${getEmojiTag("action_x")} **DMs Fechadas / Bloqueadas:** \`${failed}\``);
            await interaction.editReply({
                components: [reportContainer],
                flags: ["IsComponentsV2"],
            });
        }
        catch (err) {
            const errContainer = createContainer(formatHexColor("#ef4444"), `## ${getEmojiTag("action_x")} Erro no Processamento`, Separator.Default, `Ocorreu um erro inesperado: \`${err.message}\``);
            await interaction.editReply({
                components: [errContainer],
                flags: ["IsComponentsV2"],
            });
        }
    },
});
async function extractJsonContent(interaction) {
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
            else {
                return {
                    ok: false,
                    content: "",
                    error: "Falha ao baixar o arquivo anexado.",
                };
            }
        }
    }
    catch (err) {
        console.warn("[Anuncios JSON] Erro ao baixar arquivo anexado:", err);
    }
    if (!rawContent || !rawContent.trim()) {
        try {
            rawContent = interaction.fields.getTextInputValue("json_text") || "";
        }
        catch { }
    }
    if (!rawContent || !rawContent.trim()) {
        return {
            ok: false,
            content: "",
            error: "Nenhum código JSON foi fornecido (via texto ou arquivo).",
        };
    }
    const parseResult = parsePanelJson(rawContent);
    if (!parseResult.success || !parseResult.data) {
        return {
            ok: false,
            content: "",
            error: `JSON inválido:\n${parseResult.error || "Formato inválido"}`,
        };
    }
    return { ok: true, content: rawContent };
}
createResponder({
    customId: "panel/anuncios/json_canal",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Apenas administradores ou moderadores podem enviar comunicados.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId("panel/anuncios/json_canal_modal")
            .setTitle("Anúncio em Canal por JSON");
        const textInput = new TextInputBuilder()
            .setCustomId("json_text")
            .setLabel("Código JSON do Anúncio (Texto):")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Cole o JSON exportado do site de embeds ou componentes")
            .setRequired(false);
        const textLabel = new LabelBuilder()
            .setLabel("Código JSON do Anúncio (Texto):")
            .setDescription("Cole o JSON exportado do site de embeds ou componentes")
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
createResponder({
    customId: "panel/anuncios/json_canal_modal",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Apenas administradores ou moderadores podem enviar comunicados.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const extracted = await extractJsonContent(interaction);
        if (!extracted.ok) {
            await interaction.reply({
                content: `${getEmojiTag("action_warning")} **Falha ao processar JSON:**\n\`\`\`\n${extracted.error}\n\`\`\``,
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guildId);
        const targetId = guildData.announcements?.channelId;
        let targetChannel = (targetId &&
            interaction.guild.channels.cache.get(targetId)) ||
            undefined;
        if (!targetChannel && interaction.channel && "send" in interaction.channel) {
            targetChannel = interaction.channel;
        }
        if (!targetChannel) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Selecione um canal de texto no menu da aba de Anúncios.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction.deferReply({ flags: ["Ephemeral"] });
        try {
            const parseResult = parsePanelJson(extracted.content);
            const payload = buildCustomOrFallbackPayload(parseResult.data, null, []);
            await targetChannel.send(payload);
            const successContainer = createContainer(formatHexColor("#38bdf8"), `## ${getEmojiTag("action_check")} Anúncio Publicado (JSON)`, Separator.Default, `O comunicado via JSON foi enviado com sucesso para <#${targetChannel.id}>!`);
            await interaction.editReply({
                components: [successContainer],
                flags: ["IsComponentsV2"],
            });
        }
        catch (err) {
            const errContainer = createContainer(formatHexColor("#ef4444"), `## ${getEmojiTag("action_x")} Falha no Envio`, Separator.Default, `Ocorreu um erro ao enviar o anúncio: \`${err.message}\``);
            await interaction.editReply({
                components: [errContainer],
                flags: ["IsComponentsV2"],
            });
        }
    },
});
createResponder({
    customId: "panel/anuncios/json_dm",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Apenas administradores ou moderadores podem disparar comunicados na DM.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId("panel/anuncios/json_dm_modal")
            .setTitle("Anúncio na DM por JSON");
        const textInput = new TextInputBuilder()
            .setCustomId("json_text")
            .setLabel("Código JSON do Anúncio (Texto):")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Cole o JSON exportado do site de embeds ou componentes")
            .setRequired(false);
        const textLabel = new LabelBuilder()
            .setLabel("Código JSON do Anúncio (Texto):")
            .setDescription("Cole o JSON exportado do site de embeds ou componentes")
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
createResponder({
    customId: "panel/anuncios/json_dm_modal",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Apenas administradores ou moderadores podem disparar comunicados na DM.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const extracted = await extractJsonContent(interaction);
        if (!extracted.ok) {
            await interaction.reply({
                content: `${getEmojiTag("action_warning")} **Falha ao processar JSON:**\n\`\`\`\n${extracted.error}\n\`\`\``,
                flags: ["Ephemeral"],
            });
            return;
        }
        const guildData = await db.guilds.get(interaction.guildId);
        const roleIds = guildData.announcements?.dmRoleIds;
        if (!roleIds || roleIds.length === 0) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Selecione ao menos um cargo-alvo no menu da aba de Anúncios.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const roles = roleIds
            .map((id) => interaction.guild.roles.cache.get(id))
            .filter((role) => Boolean(role));
        if (roles.length === 0) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Nenhum cargo-alvo configurado foi encontrado no servidor.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const roleIdSet = new Set(roles.map((r) => r.id));
        await interaction.deferReply({ flags: ["Ephemeral"] });
        try {
            const parseResult = parsePanelJson(extracted.content);
            const payload = buildCustomOrFallbackPayload(parseResult.data, null, []);
            const recipients = await resolveRoleRecipients(interaction.guild, roleIdSet);
            if (recipients.size === 0) {
                const errContainer = createContainer(formatHexColor("#ef4444"), `## ${getEmojiTag("action_warning")} Nenhum Membro Encontrado`, Separator.Default, `Nenhum membro ativo possui algum dos cargos selecionados.`);
                await interaction.editReply({
                    components: [errContainer],
                    flags: ["IsComponentsV2"],
                });
                return;
            }
            let success = 0;
            let failed = 0;
            for (const member of recipients.values()) {
                try {
                    await member.send(payload);
                    success++;
                    await new Promise((resolve) => setTimeout(resolve, 350));
                }
                catch {
                    failed++;
                }
            }
            // Limpeza de cache de membros
            const botId = interaction.guild.client?.user?.id;
            for (const [memberId] of interaction.guild.members.cache.entries()) {
                if (memberId !== botId) {
                    interaction.guild.members.cache.delete(memberId);
                }
            }
            const reportContainer = createContainer(formatHexColor("#38bdf8"), `## ${getEmojiTag("action_check")} Disparo de DM Finalizado (JSON)`, Separator.Default, `O comunicado via JSON foi processado para os membros dos cargos ${roles
                .map((r) => `<@&${r.id}>`)
                .join(", ")}:\n\n` +
                `• ${getEmojiTag("action_check")} **Entregues com Sucesso:** \`${success}\`\n` +
                `• ${getEmojiTag("action_x")} **DMs Fechadas / Bloqueadas:** \`${failed}\``);
            await interaction.editReply({
                components: [reportContainer],
                flags: ["IsComponentsV2"],
            });
        }
        catch (err) {
            const errContainer = createContainer(formatHexColor("#ef4444"), `## ${getEmojiTag("action_x")} Erro no Processamento`, Separator.Default, `Ocorreu um erro inesperado: \`${err.message}\``);
            await interaction.editReply({
                components: [errContainer],
                flags: ["IsComponentsV2"],
            });
        }
    },
});

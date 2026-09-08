import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createRow, Separator } from "@magicyan/discord";
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, FileUploadBuilder, LabelBuilder, ModalBuilder, RoleSelectMenuBuilder, TextInputBuilder, TextInputStyle, } from "discord.js";
import { db } from "#database";
import { getEmojiTag, sendChannelAnnouncement, sendDMAnnouncement, } from "#functions";
import { formatHexColor, getBannerUrl } from "../panel/panelView.js";
const pending = new Map();
function isValidUrl(raw) {
    try {
        const url = new URL(raw);
        return url.protocol === "http:" || url.protocol === "https:";
    }
    catch {
        return false;
    }
}
export function isVideoUrl(raw) {
    if (!raw)
        return false;
    const lower = raw.toLowerCase();
    return (lower.includes("youtube.com") ||
        lower.includes("youtu.be") ||
        lower.includes("twitch.tv") ||
        lower.includes("streamable.com") ||
        lower.includes("tiktok.com") ||
        lower.endsWith(".mp4") ||
        lower.endsWith(".webm") ||
        lower.endsWith(".mov") ||
        lower.endsWith(".mkv") ||
        lower.includes(".mp4?") ||
        lower.includes(".webm?") ||
        lower.includes(".mov?"));
}
function renderConfirm(userId, guild) {
    const state = pending.get(userId);
    if (!state) {
        return createContainer(formatHexColor("#38bdf8"), `${getEmojiTag("action_warning")} Este comunicado expirou. Use \`/anunciar\` novamente.`);
    }
    const channelName = state.channelId
        ? guild?.channels.cache.get(state.channelId)?.name ?? `cargo`
        : "Canal atual";
    const rolesText = state.roleIds.length
        ? state.roleIds.map((id) => `<@&${id}>`).join(" ")
        : "Nenhum cargo (sem DM)";
    const header = `## ${getEmojiTag("prism")} Confirmar Comunicado`;
    const lines = [
        `${getEmojiTag("file")} **Assunto:** ${state.assunto}`,
        `**Mensagem:** ${state.mensagem || "_(sem mensagem)_"}`,
        state.videoUrl
            ? `🎥 **Vídeo (Player):** [Assistir Vídeo](${state.videoUrl})`
            : "",
        state.anexo
            ? `${getEmojiTag("file")} **Imagem / Anexo:** [ver imagem](${state.anexo})`
            : "",
        state.fileName
            ? `📎 **Arquivo:** \`${state.fileName}\``
            : "",
        `**Canal de envio:** ${channelName === "cargo" ? `<#${state.channelId}>` : (state.channelId ? `<#${state.channelId}>` : channelName)}`,
        `**Cargos por DM:** ${rolesText}`,
    ].filter((line) => line !== "");
    return createContainer(formatHexColor("#38bdf8"), header, Separator.Default, lines.join("\n"), Separator.Default, new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder()
        .setCustomId("anunciar/canal")
        .setPlaceholder("Selecionar canal de envio...")
        .setChannelTypes(ChannelType.GuildText)), new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder()
        .setCustomId("anunciar/cargos")
        .setPlaceholder("Selecionar cargos para DM...")
        .setMinValues(1)
        .setMaxValues(20)), createRow(new ButtonBuilder()
        .setCustomId("anunciar/midia")
        .setLabel("Adicionar / Alterar Vídeo ou Arquivo")
        .setEmoji("🎬")
        .setStyle(ButtonStyle.Secondary)), createRow(new ButtonBuilder()
        .setCustomId("anunciar/enviar")
        .setLabel("Enviar Comunicado")
        .setEmoji("📨")
        .setStyle(ButtonStyle.Primary), new ButtonBuilder()
        .setCustomId("anunciar/cancelar")
        .setLabel("Cancelar")
        .setStyle(ButtonStyle.Danger)));
}
createResponder({
    customId: "anunciar/modal",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        const assunto = interaction.fields.getTextInputValue("assunto").trim();
        const mensagem = interaction.fields.getTextInputValue("mensagem").trim();
        const anexoRaw = interaction.fields.getTextInputValue("anexo").trim();
        if (!assunto) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} O assunto do comunicado não pode ser vazio.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        let file = null;
        let fileName;
        try {
            const uploadedFiles = interaction.fields.getUploadedFiles?.("arquivo_upload");
            const uploaded = uploadedFiles?.first?.() ||
                (uploadedFiles?.values
                    ? Array.from(uploadedFiles.values())[0]
                    : null);
            if (uploaded?.url) {
                const res = await fetch(uploaded.url);
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                const buf = Buffer.from(await res.arrayBuffer());
                if (buf.length === 0)
                    throw new Error("buffer vazio");
                file = new AttachmentBuilder(buf).setName(uploaded.name || "anexo");
                fileName = file.name ?? undefined;
            }
        }
        catch (err) {
            console.error("[anunciar] Erro ao processar arquivo enviado:", err);
        }
        const rawAnexo = isValidUrl(anexoRaw) ? anexoRaw : undefined;
        let videoUrl;
        let imageOrAnexo;
        if (rawAnexo) {
            if (isVideoUrl(rawAnexo)) {
                videoUrl = rawAnexo;
            }
            else {
                imageOrAnexo = rawAnexo;
            }
        }
        pending.set(interaction.user.id, {
            assunto,
            mensagem,
            anexo: imageOrAnexo,
            videoUrl,
            file: file ?? undefined,
            fileName,
            roleIds: [],
        });
        const container = renderConfirm(interaction.user.id, interaction.guild);
        await interaction.reply({
            components: [container],
            flags: ["Ephemeral", "IsComponentsV2"],
        });
    },
});
createResponder({
    customId: "anunciar/canal",
    types: [ResponderType.ChannelSelect],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        const state = pending.get(interaction.user.id);
        if (!state)
            return;
        state.channelId = interaction.values[0];
        const container = renderConfirm(interaction.user.id, interaction.guild);
        await interaction.update({
            components: [container],
            flags: ["IsComponentsV2"],
        });
    },
});
createResponder({
    customId: "anunciar/cargos",
    types: [ResponderType.RoleSelect],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        const state = pending.get(interaction.user.id);
        if (!state)
            return;
        state.roleIds = interaction.values;
        const container = renderConfirm(interaction.user.id, interaction.guild);
        await interaction.update({
            components: [container],
            flags: ["IsComponentsV2"],
        });
    },
});
// Botão para Adicionar / Editar Vídeo ou Arquivo
createResponder({
    customId: "anunciar/midia",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        const state = pending.get(interaction.user.id);
        if (!state) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Este comunicado expirou. Use \`/anunciar\` novamente.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId("anunciar/modal/midia")
            .setTitle("Vídeo ou Arquivo");
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("video_url")
            .setLabel("Link do Vídeo (YouTube, MP4, Streamable)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("https://youtube.com/watch?v=... ou link direto .mp4")
            .setValue(state.videoUrl || "")
            .setRequired(false)
            .setMaxLength(400)), new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId("arquivo_url")
            .setLabel("URL de Imagem ou Arquivo (opcional)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("https://exemplo.com/imagem.png ou .zip")
            .setValue(state.anexo || "")
            .setRequired(false)
            .setMaxLength(400)), new LabelBuilder()
            .setLabel("Novo Arquivo ou Vídeo (Upload opcional)")
            .setDescription("Anexe um arquivo ou vídeo real (MP4, documento, etc.)")
            .setFileUploadComponent(new FileUploadBuilder()
            .setCustomId("arquivo_upload")
            .setRequired(false)
            .setMaxValues(1)));
        try {
            await interaction.showModal(modal);
        }
        catch {
            const fallbackModal = new ModalBuilder()
                .setCustomId("anunciar/modal/midia")
                .setTitle("Vídeo ou Arquivo");
            fallbackModal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
                .setCustomId("video_url")
                .setLabel("Link do Vídeo (YouTube, MP4, Streamable)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("https://youtube.com/watch?v=... ou link direto .mp4")
                .setValue(state.videoUrl || "")
                .setRequired(false)
                .setMaxLength(400)), new ActionRowBuilder().addComponents(new TextInputBuilder()
                .setCustomId("arquivo_url")
                .setLabel("URL de Imagem ou Arquivo (opcional)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("https://exemplo.com/imagem.png ou .zip")
                .setValue(state.anexo || "")
                .setRequired(false)
                .setMaxLength(400)));
            await interaction.showModal(fallbackModal);
        }
    },
});
// Modal de Vídeo / Arquivo Submit
createResponder({
    customId: "anunciar/modal/midia",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        const state = pending.get(interaction.user.id);
        if (!state) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Este comunicado expirou. Use \`/anunciar\` novamente.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        const videoRaw = interaction.fields.getTextInputValue("video_url").trim();
        const arquivoRaw = interaction.fields.getTextInputValue("arquivo_url").trim();
        if (videoRaw) {
            if (isValidUrl(videoRaw)) {
                state.videoUrl = videoRaw;
            }
            else if (["remover", "none", "off", "limpar"].includes(videoRaw.toLowerCase())) {
                state.videoUrl = undefined;
            }
        }
        else {
            state.videoUrl = undefined;
        }
        if (arquivoRaw) {
            if (isValidUrl(arquivoRaw)) {
                if (isVideoUrl(arquivoRaw) && !state.videoUrl) {
                    state.videoUrl = arquivoRaw;
                }
                else {
                    state.anexo = arquivoRaw;
                }
            }
            else if (["remover", "none", "off", "limpar"].includes(arquivoRaw.toLowerCase())) {
                state.anexo = undefined;
            }
        }
        else {
            state.anexo = undefined;
        }
        try {
            const uploadedFiles = interaction.fields.getUploadedFiles?.("arquivo_upload");
            const uploaded = uploadedFiles?.first?.() ||
                (uploadedFiles?.values
                    ? Array.from(uploadedFiles.values())[0]
                    : null);
            if (uploaded?.url) {
                const res = await fetch(uploaded.url);
                if (res.ok) {
                    const buf = Buffer.from(await res.arrayBuffer());
                    if (buf.length > 0) {
                        state.file = new AttachmentBuilder(buf).setName(uploaded.name || "arquivo");
                        state.fileName = state.file.name ?? undefined;
                    }
                }
            }
        }
        catch (err) {
            console.error("[anunciar/midia] Erro ao processar upload:", err);
        }
        const container = renderConfirm(interaction.user.id, interaction.guild);
        if (interaction.isFromMessage()) {
            await interaction.update({
                components: [container],
                flags: ["IsComponentsV2"],
            });
        }
        else {
            await interaction.reply({
                components: [container],
                flags: ["Ephemeral", "IsComponentsV2"],
            });
        }
    },
});
createResponder({
    customId: "anunciar/enviar",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        const state = pending.get(interaction.user.id);
        if (!state) {
            await interaction.reply({
                content: `${getEmojiTag("action_x")} Este comunicado expirou. Use \`/anunciar\` novamente.`,
                flags: ["Ephemeral"],
            });
            return;
        }
        await interaction.deferUpdate();
        const guildData = await db.guilds.get(interaction.guild.id);
        const barImage = getBannerUrl(guildData);
        const authorName = interaction.member.displayName || interaction.user.username;
        const title = `• **${state.assunto}**`;
        const body = state.mensagem || "Comunicado oficial da equipe.";
        const headerEmoji = "prism";
        const parts = [];
        const roles = [];
        for (const id of state.roleIds) {
            const role = interaction.guild.roles.cache.get(id) ??
                (await interaction.guild.roles.fetch(id).catch(() => null));
            if (role)
                roles.push(role);
        }
        if (roles.length > 0) {
            try {
                const result = await sendDMAnnouncement({
                    guild: interaction.guild,
                    role: roles,
                    title,
                    message: body,
                    image: state.anexo,
                    barImage,
                    file: state.file,
                    authorName,
                    authorId: interaction.user.id,
                    headerEmoji,
                    videoUrl: state.videoUrl,
                });
                if (result.recipients === 0) {
                    parts.push(`${getEmojiTag("action_warning")} **DM:** nenhum membro encontrado nos cargos selecionados.`);
                }
                else {
                    parts.push(`${getEmojiTag("user_users")} **DM:** \`${result.success}/${result.recipients}\` entregues` +
                        (result.failed ? ` (\`${result.failed}\` falharam)` : ""));
                }
            }
            catch (err) {
                console.error("[anunciar] Erro no envio por DM:", err);
                parts.push(`${getEmojiTag("action_x")} **DM:** erro ao enviar.`);
            }
        }
        let channel = null;
        if (state.channelId) {
            const target = interaction.guild.channels.cache.get(state.channelId) ??
                (await interaction.guild.channels.fetch(state.channelId).catch(() => null));
            if (target && target.isTextBased() && "send" in target) {
                channel = target;
            }
        }
        else if (interaction.channel?.isTextBased() &&
            "send" in interaction.channel) {
            channel = interaction.channel;
        }
        if (channel) {
            try {
                await sendChannelAnnouncement({
                    channel,
                    title,
                    message: body,
                    image: state.anexo,
                    barImage,
                    file: state.file,
                    authorName,
                    authorId: interaction.user.id,
                    headerEmoji,
                    videoUrl: state.videoUrl,
                });
                parts.push(`${getEmojiTag("other_terminal")} **Canal:** <#${channel.id}>`);
            }
            catch (err) {
                console.error("[anunciar] Erro no envio ao canal:", err);
                parts.push(`${getEmojiTag("action_x")} **Canal:** erro ao enviar.`);
            }
        }
        else {
            parts.push(`${getEmojiTag("action_x")} **Canal:** nenhum canal válido selecionado.`);
        }
        if (state.videoUrl) {
            parts.push(`🎥 **Vídeo:** [Player integrado no chat](${state.videoUrl})`);
        }
        if (state.fileName) {
            parts.push(`📎 **Arquivo:** \`${state.fileName}\``);
        }
        pending.delete(interaction.user.id);
        await interaction.followUp({
            content: `${getEmojiTag("action_check")} **Comunicado enviado!**\n${parts.join("\n")}`,
            flags: ["Ephemeral"],
        });
    },
});
createResponder({
    customId: "anunciar/cancelar",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        pending.delete(interaction.user.id);
        const container = createContainer(formatHexColor("#38bdf8"), `${getEmojiTag("action_x")} Comunicado **cancelado**.`);
        await interaction.update({
            components: [container],
            flags: ["IsComponentsV2"],
        });
    },
});

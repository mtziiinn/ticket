import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createRow, Separator } from "@magicyan/discord";
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, RoleSelectMenuBuilder, } from "discord.js";
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
function renderConfirm(userId) {
    const state = pending.get(userId);
    if (!state) {
        return createContainer(formatHexColor("#38bdf8"), `| ${getEmojiTag("action_warning")} Este comunicado expirou. Use \`/anunciar\` novamente.`);
    }
    const channelName = state.channelId
        ? `<#${state.channelId}>`
        : "Canal atual";
    const rolesText = state.roleIds.length
        ? state.roleIds.map((id) => `<@&${id}>`).join(" ")
        : "Nenhum cargo (sem envio por DM)";
    const prismEmoji = getEmojiTag("prism") || "💎";
    const header = `## ${prismEmoji} Confirmar Comunicado Oficial (Prism)`;
    const lines = [
        `| ${getEmojiTag("folder")} **Assunto:** \`${state.assunto}\``,
        `| **Mensagem:** ${state.mensagem ? state.mensagem : "*(sem corpo de texto)*"}`,
        state.anexo
            ? `| ${getEmojiTag("file")} **Imagem/Anexo:** [Visualizar Link](${state.anexo})`
            : "",
        state.fileName
            ? `| ${getEmojiTag("file")} **Arquivo Anexado:** \`${state.fileName}\``
            : "",
        `| ${getEmojiTag("other_terminal")} **Canal de Envio:** ${channelName}`,
        `| ${getEmojiTag("user_users")} **Cargos para Disparo na DM:** ${rolesText}`,
    ].filter((line) => line !== "");
    return createContainer(formatHexColor("#38bdf8"), header, Separator.Default, lines.join("\n"), Separator.Default, new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder()
        .setCustomId("anunciar/canal")
        .setPlaceholder("Selecionar canal de envio do comunicado...")
        .setChannelTypes(ChannelType.GuildText)), new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder()
        .setCustomId("anunciar/cargos")
        .setPlaceholder("Selecionar cargos para disparo na DM...")
        .setMinValues(1)
        .setMaxValues(20)), createRow(new ButtonBuilder()
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
        pending.set(interaction.user.id, {
            assunto,
            mensagem,
            anexo: isValidUrl(anexoRaw) ? anexoRaw : undefined,
            file: file ?? undefined,
            fileName,
            roleIds: [],
        });
        const container = renderConfirm(interaction.user.id);
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
        const container = renderConfirm(interaction.user.id);
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
        const container = renderConfirm(interaction.user.id);
        await interaction.update({
            components: [container],
            flags: ["IsComponentsV2"],
        });
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
        const title = state.assunto;
        const body = state.mensagem || "Comunicado oficial da equipe.";
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
                });
                if (result.recipients === 0) {
                    parts.push(`${getEmojiTag("action_warning")} **DM:** Nenhum membro encontrado nos cargos selecionados.`);
                }
                else {
                    parts.push(`${getEmojiTag("user_users")} **DM:** \`${result.success}/${result.recipients}\` entregues` +
                        (result.failed ? ` (\`${result.failed}\` falharam / DMs fechadas)` : ""));
                }
            }
            catch (err) {
                console.error("[anunciar] Erro no envio por DM:", err);
                parts.push(`${getEmojiTag("action_x")} **DM:** Erro ao disparar mensagens.`);
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
                });
                parts.push(`${getEmojiTag("folder")} **Canal:** <#${channel.id}>`);
            }
            catch (err) {
                console.error("[anunciar] Erro no envio ao canal:", err);
                parts.push(`${getEmojiTag("action_x")} **Canal:** Erro ao enviar comunicado.`);
            }
        }
        else {
            parts.push(`${getEmojiTag("action_x")} **Canal:** Nenhum canal de texto válido selecionado.`);
        }
        pending.delete(interaction.user.id);
        await interaction.followUp({
            content: `${getEmojiTag("action_check")} **Comunicado Oficial enviado com sucesso!**\n${parts.join("\n")}`,
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
        const container = createContainer(formatHexColor("#38bdf8"), `| ${getEmojiTag("action_x")} Comunicado **cancelado**.`);
        await interaction.update({
            components: [container],
            flags: ["IsComponentsV2"],
        });
    },
});

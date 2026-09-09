import { createContainer, createSection, Separator, createMediaGallery, } from "@magicyan/discord";
import { AttachmentBuilder, } from "discord.js";
import { getEmojiTag } from "./index.js";
import { formatHexColor } from "../discord/responders/panel/panelView.js";
export function announcementContainer(options) {
    const finalColor = options.color && /^#?[0-9a-fA-F]{3,8}$/.test(options.color)
        ? formatHexColor(options.color)
        : formatHexColor("#38bdf8");
    const prismEmoji = getEmojiTag(options.headerEmoji || "prism") || "💎";
    const descFormatted = (options.message || "").replace(/\\n/g, "\n");
    const authorLine = options.authorName ? ` | Enviado por: **${options.authorName}**` : "";
    const items = [];
    if (options.image || options.thumbnail) {
        items.push(createSection({
            content: `## ${prismEmoji} ${options.title}`,
            thumbnail: (options.thumbnail || options.image),
        }));
    }
    else {
        items.push(`## ${prismEmoji} ${options.title}`);
    }
    if (descFormatted.trim()) {
        items.push(Separator.Default, descFormatted);
    }
    if (options.videoUrl) {
        items.push(Separator.Default, `🎥 **Vídeo:** [Assistir / Reproduzir Vídeo](${options.videoUrl})`);
    }
    if (options.fileLink || options.fileDisplayName) {
        const fileName = options.fileDisplayName ||
            decodeURIComponent(options.fileLink?.split("/").pop() || "arquivo").split("?")[0] ||
            "arquivo";
        items.push(Separator.Default, options.fileLink
            ? `${getEmojiTag("file")} **Arquivo Anexado:** [${fileName}](${options.fileLink})`
            : `${getEmojiTag("file")} **Arquivo Anexado:** \`${fileName}\``);
    }
    if (options.barImage) {
        items.push(Separator.Default, createMediaGallery(options.barImage));
    }
    items.push(Separator.Default, `- # Comunicado Oficial • ${brand.brandName}${authorLine} | <t:${Math.floor(Date.now() / 1000)}:f>`);
    return createContainer(finalColor, ...items);
}
export function announcementDMContainer(options) {
    const finalColor = options.color && /^#?[0-9a-fA-F]{3,8}$/.test(options.color)
        ? formatHexColor(options.color)
        : formatHexColor("#38bdf8");
    const prismEmoji = getEmojiTag(options.headerEmoji || "prism") || "💎";
    const descFormatted = (options.message || "").replace(/\\n/g, "\n");
    const authorLine = options.authorName ? ` | Enviado por: **${options.authorName}**` : "";
    const items = [];
    if (options.image || options.thumbnail) {
        items.push(createSection({
            content: `## ${prismEmoji} ${options.title}\n*Recebido de **${options.guildName}***`,
            thumbnail: (options.thumbnail || options.image),
        }));
    }
    else {
        items.push(`## ${prismEmoji} ${options.title}\n*Recebido de **${options.guildName}***`);
    }
    if (descFormatted.trim()) {
        items.push(Separator.Default, descFormatted);
    }
    if (options.videoUrl) {
        items.push(Separator.Default, `🎥 **Vídeo:** [Assistir / Reproduzir Vídeo](${options.videoUrl})`);
    }
    if (options.fileLink || options.fileDisplayName) {
        const fileName = options.fileDisplayName ||
            decodeURIComponent(options.fileLink?.split("/").pop() || "arquivo").split("?")[0] ||
            "arquivo";
        items.push(Separator.Default, options.fileLink
            ? `${getEmojiTag("file")} **Arquivo Anexado:** [${fileName}](${options.fileLink})`
            : `${getEmojiTag("file")} **Arquivo Anexado:** \`${fileName}\``);
    }
    if (options.barImage) {
        items.push(Separator.Default, createMediaGallery(options.barImage));
    }
    items.push(Separator.Default, `- # Comunicado Oficial • ${brand.brandName}${authorLine} | <t:${Math.floor(Date.now() / 1000)}:f>`);
    return createContainer(finalColor, ...items);
}
export async function resolveRoleRecipients(guild, roleIds) {
    const roleSet = roleIds instanceof Set ? roleIds : new Set([...roleIds]);
    const fromCache = guild.members.cache.filter((m) => !m.user.bot && [...roleSet].some((id) => m.roles.cache.has(id)));
    if (guild.members.cache.size >= (guild.memberCount ?? 0)) {
        return fromCache;
    }
    const allMembers = await guild.members.fetch();
    const recipients = allMembers.filter((m) => !m.user.bot && [...roleSet].some((id) => m.roles.cache.has(id)));
    if (fromCache.size >= recipients.size) {
        return fromCache;
    }
    return recipients;
}
export async function sendChannelAnnouncement(options) {
    const { channel, title, message, color, image, thumbnail, mentionEveryone, authorName, barImage, file, headerEmoji, videoUrl, } = options;
    const container = announcementContainer({
        title,
        message,
        color,
        image,
        thumbnail,
        authorName,
        barImage,
        headerEmoji,
        videoUrl,
        fileLink: typeof file === "string" ? file : undefined,
        fileDisplayName: file instanceof AttachmentBuilder ? (file.name ?? undefined) : undefined,
    });
    const payload = {
        components: [container],
        flags: ["IsComponentsV2"],
    };
    let content = "";
    if (mentionEveryone) {
        content = "@everyone";
    }
    if (videoUrl) {
        content = content ? `${content}\n${videoUrl}` : videoUrl;
    }
    if (content) {
        payload.content = content;
    }
    if (file) {
        try {
            payload.files = [
                typeof file === "string" ? new AttachmentBuilder(file) : file,
            ];
        }
        catch {
            console.error("[Anunciar] Arquivo inválido:", file);
        }
    }
    await channel.send(payload);
    return channel;
}
export async function sendDMAnnouncement(options) {
    const { guild, role, title, message, color, image, thumbnail, authorName, barImage, file, headerEmoji, videoUrl, } = options;
    const roles = Array.isArray(role) ? role : [role];
    const roleIds = new Set(roles.map((r) => r.id));
    const recipients = await resolveRoleRecipients(guild, roleIds);
    if (recipients.size === 0) {
        return { recipients: 0, success: 0, failed: 0 };
    }
    const container = announcementDMContainer({
        guildName: guild.name,
        title,
        message,
        color,
        image,
        thumbnail,
        authorName,
        barImage,
        headerEmoji,
        videoUrl,
        fileLink: typeof file === "string" ? file : undefined,
        fileDisplayName: file instanceof AttachmentBuilder ? (file.name ?? undefined) : undefined,
    });
    const payload = {
        components: [container],
        flags: ["IsComponentsV2"],
    };
    if (videoUrl) {
        payload.content = videoUrl;
    }
    if (file) {
        try {
            payload.files = [
                typeof file === "string" ? new AttachmentBuilder(file) : file,
            ];
        }
        catch {
            console.error("[Anunciar] Arquivo inválido (DM):", file);
        }
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
    // Limpeza de cache de membros para não estourar RAM na Discloud
    const botId = guild.client?.user?.id;
    for (const [memberId] of guild.members.cache.entries()) {
        if (memberId !== botId) {
            guild.members.cache.delete(memberId);
        }
    }
    return { recipients: recipients.size, success, failed };
}

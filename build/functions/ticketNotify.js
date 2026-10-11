import { createContainer, createRow, createSection, Separator, } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { safeSendDM } from "./index.js";
// Cor do container por status do ticket (queda para a cor da marca quando
// o status não estiver mapeado).
export const TICKET_STATUS_COLORS = {
    open: "#3b82f6",
    payment: "#f59e0b",
    production: "#f97316",
    completed: "#22c55e",
    queue: "#a855f7",
};
function getBrandColor() {
    try {
        if (typeof constants !== "undefined" && constants.colors?.primary) {
            return constants.colors.primary;
        }
        if (typeof brand !== "undefined" && brand.primaryColor) {
            return brand.primaryColor;
        }
    }
    catch {
        // fallback
    }
    return "#5865F2";
}
// Monta o container padrão das notificações de atendimento enviadas na DM.
export function buildTicketDM(data) {
    const buttons = [];
    if (data.guildId && data.channelId) {
        buttons.push(new ButtonBuilder({
            label: "Ir para o atendimento",
            style: ButtonStyle.Link,
            url: `https://discord.com/channels/${data.guildId}/${data.channelId}`,
        }));
    }
    for (const button of data.buttons ?? []) {
        buttons.push(new ButtonBuilder({
            label: button.label,
            style: ButtonStyle.Link,
            url: button.url,
            ...(button.emoji ? { emoji: button.emoji } : {}),
        }));
    }
    const items = [
        createSection({
            content: `### ${data.emoji} ${data.title}\n${data.description}`,
            ...(data.thumbnail ? { thumbnail: data.thumbnail } : {}),
        }),
    ];
    if (data.fields?.length) {
        items.push(Separator.Default, data.fields.join("\n"));
    }
    if (data.footerNote) {
        items.push(Separator.Default, data.footerNote);
    }
    if (buttons.length) {
        items.push(Separator.Default, createRow(...buttons));
    }
    return createContainer(data.color ?? getBrandColor(), ...items);
}
export async function sendTicketDM(target, data) {
    if (!target)
        return false;
    const container = buildTicketDM(data);
    return safeSendDM(target, { components: [container], flags: ["IsComponentsV2"] }, data.context ?? "Ticket DM");
}

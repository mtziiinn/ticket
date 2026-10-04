import { PermissionFlagsBits } from "discord.js";

// Converte uma Message do discord.js em dados simples pro transcript web.
// Além de texto, anexos e embeds, captura os componentes V2 (container,
// section, text display, galeria, separador, botões...) — os painéis do bot
// são todos V2, e sem isso apareciam vazios no transcript.

// Tipos numéricos de componente da API do Discord
const C = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  UserSelect: 5,
  RoleSelect: 6,
  MentionableSelect: 7,
  ChannelSelect: 8,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  File: 13,
  Separator: 14,
  Container: 17,
} as const;

const SELECT_TYPES: number[] = [
  C.StringSelect,
  C.UserSelect,
  C.RoleSelect,
  C.MentionableSelect,
  C.ChannelSelect,
];

// Remove a query string (as URLs de anexo do Discord são assinadas e os
// parâmetros mudam) pra comparar se dois links apontam pro mesmo arquivo.
function urlKey(url: string) {
  return (url || "").split("?")[0];
}

function resolveMediaUrl(url: string | undefined, msg: any, used: Set<string>) {
  if (!url) return undefined;
  if (url.startsWith("attachment://")) {
    const name = url.slice("attachment://".length);
    const att = msg.attachments?.find?.((a: any) => a.name === name);
    if (!att) return undefined;
    used.add(urlKey(att.url));
    return att.url as string;
  }
  used.add(urlKey(url));
  return url;
}

function serializeEmoji(emoji: any) {
  if (!emoji || (!emoji.id && !emoji.name)) return undefined;
  return {
    id: emoji.id || undefined,
    name: emoji.name || undefined,
    animated: Boolean(emoji.animated),
  };
}

function serializeComponent(raw: any, msg: any, used: Set<string>): any {
  if (!raw || typeof raw.type !== "number") return null;
  const children = (list: any[] | undefined) =>
    (list || []).map((c) => serializeComponent(c, msg, used)).filter(Boolean);

  switch (raw.type) {
    case C.Container:
      return {
        type: "container",
        accentColor: typeof raw.accent_color === "number" ? raw.accent_color : undefined,
        spoiler: Boolean(raw.spoiler),
        components: children(raw.components),
      };
    case C.Section:
      return {
        type: "section",
        components: children(raw.components),
        accessory: serializeComponent(raw.accessory, msg, used) || undefined,
      };
    case C.TextDisplay:
      return { type: "text", content: raw.content || "" };
    case C.Thumbnail: {
      const url = resolveMediaUrl(raw.media?.url, msg, used);
      return url
        ? { type: "thumbnail", url, description: raw.description || undefined }
        : null;
    }
    case C.MediaGallery: {
      const items = (raw.items || [])
        .map((item: any) => {
          const url = resolveMediaUrl(item.media?.url, msg, used);
          return url ? { url, description: item.description || undefined } : null;
        })
        .filter(Boolean);
      return items.length > 0 ? { type: "gallery", items } : null;
    }
    case C.File: {
      const url = resolveMediaUrl(raw.file?.url, msg, used);
      return url
        ? { type: "file", url, name: raw.name || url.split("/").pop()?.split("?")[0] }
        : null;
    }
    case C.Separator:
      return {
        type: "separator",
        divider: raw.divider !== false,
        spacing: raw.spacing === 2 ? "large" : "small",
      };
    case C.ActionRow:
      return { type: "row", components: children(raw.components) };
    case C.Button:
      return {
        type: "button",
        style: raw.style || 2,
        label: raw.label || undefined,
        emoji: serializeEmoji(raw.emoji),
        url: raw.url || undefined,
        disabled: Boolean(raw.disabled),
      };
    default:
      if (SELECT_TYPES.includes(raw.type)) {
        return {
          type: "select",
          placeholder: raw.placeholder || undefined,
          disabled: Boolean(raw.disabled),
        };
      }
      return null;
  }
}

function collectTexts(components: any[], out: string[]) {
  for (const c of components) {
    if (c.type === "text") out.push(c.content);
    if (c.components) collectTexts(c.components, out);
    if (c.accessory) collectTexts([c.accessory], out);
  }
}

// Menções (<@id>, <@&id>, <#id>) viram nomes legíveis no site. Só usa o cache
// (sem fetch) pra não pesar no fechamento de tickets longos.
function resolveMentions(msg: any, texts: string[]) {
  const guild = msg.guild;
  const client = msg.client;
  const users: Record<string, string> = {};
  const roles: Record<string, string> = {};
  const channels: Record<string, string> = {};

  for (const text of texts) {
    if (!text) continue;
    for (const [, kind, id] of text.matchAll(/<(@!?|@&|#)(\d{15,25})>/g)) {
      if (kind === "@&") {
        const role = guild?.roles?.cache?.get(id);
        if (role) roles[id] = role.name;
      } else if (kind === "#") {
        const channel = guild?.channels?.cache?.get(id) || client?.channels?.cache?.get(id);
        if (channel?.name) channels[id] = channel.name;
      } else {
        const member = guild?.members?.cache?.get(id);
        const user = member?.user || client?.users?.cache?.get(id);
        const name = member?.displayName || user?.globalName || user?.username;
        if (name) users[id] = name;
      }
    }
  }

  const hasAny =
    Object.keys(users).length + Object.keys(roles).length + Object.keys(channels).length > 0;
  return hasAny ? { users, roles, channels } : undefined;
}

export function toTranscriptMessage(msg: any) {
  // Arquivos referenciados por componentes (ex.: QR code na galeria da
  // cobrança) já aparecem dentro do componente — não repete como anexo solto.
  const usedUrls = new Set<string>();
  const components = (msg.components || [])
    .map((c: any) => serializeComponent(c?.toJSON ? c.toJSON() : c, msg, usedUrls))
    .filter(Boolean);

  const attachments = [];
  if (msg.attachments?.size > 0) {
    for (const att of msg.attachments.values()) {
      if (usedUrls.has(urlKey(att.url))) continue;
      attachments.push({
        url: att.url,
        filename: att.name,
        contentType: att.contentType || undefined,
        width: att.width || undefined,
        height: att.height || undefined,
      });
    }
  }

  const embeds = (msg.embeds || []).map((emb: any) => ({
    title: emb.title || undefined,
    description: emb.description || undefined,
    url: emb.url || undefined,
    color: typeof emb.color === "number" ? emb.color : undefined,
    image: emb.image?.url || undefined,
    thumbnail: emb.thumbnail?.url || undefined,
    timestamp: emb.timestamp || undefined,
    author: emb.author
      ? {
          name: emb.author.name,
          url: emb.author.url || undefined,
          iconURL: emb.author.iconURL || undefined,
        }
      : undefined,
    footer: emb.footer
      ? {
          text: emb.footer.text,
          iconURL: emb.footer.iconURL || undefined,
        }
      : undefined,
    fields: (emb.fields || []).map((f: any) => ({
      name: f.name,
      value: f.value,
      inline: Boolean(f.inline),
    })),
  }));

  const texts: string[] = [msg.content || ""];
  collectTexts(components, texts);
  for (const emb of embeds) {
    texts.push(emb.description || "");
    for (const f of emb.fields) texts.push(f.value);
  }

  return {
    createdTimestamp: msg.createdTimestamp as number,
    messageId: msg.id,
    authorId: msg.author?.id || "0",
    authorUsername: msg.author?.username || "Desconhecido",
    authorAvatar:
      msg.author?.displayAvatarURL?.({ extension: "png", forceStatic: true }) ||
      "https://cdn.discordapp.com/embed/avatars/0.png",
    authorBot: Boolean(msg.author?.bot),
    isStaff: Boolean(
      msg.member?.permissions?.has?.(PermissionFlagsBits.ManageChannels),
    ),
    content: msg.content || "",
    timestamp: msg.createdAt
      ? msg.createdAt.toISOString()
      : new Date().toISOString(),
    attachments,
    embeds,
    components: components.length > 0 ? components : undefined,
    mentions: resolveMentions(msg, texts),
  };
}

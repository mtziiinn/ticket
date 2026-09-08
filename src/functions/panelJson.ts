import { ComponentType } from "discord.js";

export const SYSTEM_NAMES: Record<string, string> = {
  ticket: "Tickets (Central de Atendimento)",
  verification: "Verificação de Segurança",
  anuncios: "Anúncios e Comunicados",
};

interface ParsedPanelData {
  content?: string;
  embeds?: any[];
  containers?: any[];
  raw?: any;
}

export function parsePanelJson(rawInput: string): {
  success: boolean;
  data?: ParsedPanelData;
  error?: string;
} {
  if (!rawInput || typeof rawInput !== "string") {
    return { success: false, error: "Nenhum código JSON foi fornecido." };
  }

  // Remove blocos de código markdown (```json ... ``` ou ``` ... ```)
  let clean = rawInput.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(clean);
  } catch (err: any) {
    return {
      success: false,
      error: `JSON inválido: ${err.message || "Erro de sintaxe"}`,
    };
  }

  // Formato de componentes v2 (mockup): { version, containers: [...] }
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Array.isArray(parsed.containers)
  ) {
    if (parsed.containers.length === 0) {
      return {
        success: false,
        error: "O JSON fornecido contém um array de 'containers' vazio.",
      };
    }
    const invalid = parsed.containers.find(
      (container: any) =>
        !container ||
        typeof container !== "object" ||
        !Array.isArray(container.items),
    );
    if (invalid) {
      return {
        success: false,
        error:
          "O JSON de 'containers' é inválido: cada container precisa ter um array 'items'.",
      };
    }
    return {
      success: true,
      data: { containers: parsed.containers, raw: parsed },
    };
  }

  let content: string | undefined = undefined;
  let embeds: any[] = [];

  // Se for um array direto de embeds
  if (Array.isArray(parsed)) {
    embeds = parsed;
  } else if (parsed && typeof parsed === "object") {
    // Suporte a encapsulamento de mensagem { message: { content, embeds } }
    if (parsed.message && typeof parsed.message === "object") {
      content = parsed.message.content || parsed.content;
      embeds = Array.isArray(parsed.message.embeds)
        ? parsed.message.embeds
        : Array.isArray(parsed.embeds)
          ? parsed.embeds
          : [];
    } else {
      content = parsed.content;
      if (Array.isArray(parsed.embeds)) {
        embeds = parsed.embeds;
      } else if (parsed.title || parsed.description || parsed.fields) {
        // Objeto único de embed
        embeds = [parsed];
      }
    }
  }

  // Validação: precisa ter pelo menos content ou embed
  if ((!content || !content.trim()) && (!embeds || embeds.length === 0)) {
    return {
      success: false,
      error:
        "O JSON fornecido não contém nenhuma mensagem de texto ('content') ou embeds ('embeds').",
    };
  }

  // Normalizar embeds (cores hexadecimais, estrutura limpa)
  const normalizedEmbeds = embeds.map((emb: any) => {
    const copy = { ...emb };
    if (copy.color !== undefined && copy.color !== null) {
      if (typeof copy.color === "string") {
        const hex = copy.color.replace(/^#|^0x/, "").trim();
        const num = parseInt(hex, 16);
        if (!isNaN(num)) {
          copy.color = num;
        } else {
          delete copy.color;
        }
      }
    }
    return copy;
  });

  return {
    success: true,
    data: {
      content: content ? content.trim() : undefined,
      embeds: normalizedEmbeds,
      raw: parsed,
    },
  };
}

const BUTTON_STYLE_MAP: Record<string, number> = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
  link: 5,
};

function parseMockupEmoji(emoji: any): any {
  if (!emoji) return undefined;
  if (typeof emoji === "string") {
    const match = emoji.match(/^<a?:(\w+):(\d+)>$/);
    if (match) {
      return { id: match[2], name: match[1], animated: emoji.startsWith("<a:") };
    }
    if (/^[^\s:]+$/.test(emoji)) return { name: emoji };
    return undefined;
  }
  if (typeof emoji === "object") {
    const out: Record<string, any> = {};
    if (emoji.id != null) out.id = String(emoji.id);
    if (emoji.name != null) out.name = String(emoji.name);
    if (emoji.animated != null) out.animated = Boolean(emoji.animated);
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return undefined;
}

function convertMockupButton(button: any): any {
  if (!button) return null;
  const wire: Record<string, any> = { type: ComponentType.Button };
  if (button.style != null) {
    wire.style =
      typeof button.style === "string"
        ? BUTTON_STYLE_MAP[button.style.toLowerCase()] ?? button.style
        : button.style;
  }
  if (button.label != null) wire.label = String(button.label);
  const customId = button.custom_id ?? button.customId;
  if (customId) wire.custom_id = String(customId);
  if (button.url) wire.url = String(button.url);
  if (typeof button.disabled === "boolean") wire.disabled = button.disabled;
  const emoji = parseMockupEmoji(button.emoji);
  if (emoji) wire.emoji = emoji;
  return wire;
}

function convertMockupAccessory(accessory: any): any {
  if (!accessory) return undefined;
  if (accessory.type === "thumbnail" || (accessory.type === undefined && accessory.url)) {
    const wire: Record<string, any> = {
      type: ComponentType.Thumbnail,
      media: { url: String(accessory.url) },
    };
    if (accessory.description != null) wire.description = String(accessory.description);
    return wire;
  }
  if (accessory.type === "button") return convertMockupButton(accessory);
  return undefined;
}

function convertMockupSection(item: any): any {
  const children = Array.isArray(item.children) ? item.children : [];
  const textDisplays = children
    .filter(
      (child: any) =>
        child && (child.type === undefined || child.type === "text_display") && child.content != null,
    )
    .map((child: any) => ({
      type: ComponentType.TextDisplay,
      content: String(child.content),
    }));

  const wire: Record<string, any> = { type: ComponentType.Section };
  wire.components =
    textDisplays.length > 0
      ? textDisplays
      : [{ type: ComponentType.TextDisplay, content: "" }];
  const accessory = convertMockupAccessory(item.accessory);
  if (accessory) wire.accessory = accessory;
  return wire;
}

function convertMockupMediaGallery(item: any): any {
  const wire: Record<string, any> = { type: ComponentType.MediaGallery, items: [] };
  const items = Array.isArray(item.items) ? item.items : [];
  for (const mediaItem of items) {
    const url = typeof mediaItem?.url === "string" ? mediaItem.url : undefined;
    if (!url) continue;
    const media: Record<string, any> = { media: { url } };
    if (mediaItem.description != null) media.description = String(mediaItem.description);
    if (typeof mediaItem.spoiler === "boolean") media.spoiler = mediaItem.spoiler;
    wire.items.push(media);
  }
  return wire;
}

function convertMockupActionRow(
  item: any,
  officialRowQueue: any[],
): any {
  const buttons = Array.isArray(item.buttons) ? item.buttons : [];
  const wire: Record<string, any> = { type: ComponentType.ActionRow, components: [] };

  if (buttons.length > 0) {
    wire.components = buttons.map(convertMockupButton).filter(Boolean);
  } else if (officialRowQueue.length > 0) {
    const official = officialRowQueue.shift();
    wire.components = Array.isArray(official?.components) ? official.components : [];
  }

  return wire.components.length > 0 ? wire : null;
}

function convertContainersMockupToWire(
  mockContainers: any[],
  officialActionRows: any[],
): any[] {
  const officialRowQueue = (officialActionRows || []).map((row) =>
    row?.toJSON ? row.toJSON() : row,
  );

  const containers = mockContainers.map((mock: any) => {
    const wire: Record<string, any> = { type: ComponentType.Container };
    if (mock.accent_color != null) wire.accent_color = mock.accent_color;
    if (typeof mock.spoiler === "boolean") wire.spoiler = mock.spoiler;

    const items = (Array.isArray(mock.items) ? mock.items : [])
      .map((item: any) => {
        switch (item?.type) {
          case "text_display":
            return { type: ComponentType.TextDisplay, content: String(item.content ?? "") };
          case "separator": {
            const separator: Record<string, any> = { type: ComponentType.Separator };
            if (typeof item.divider === "boolean") separator.divider = item.divider;
            else if (typeof item.visible === "boolean") separator.divider = item.visible;
            if (item.spacing != null) separator.spacing = Number(item.spacing);
            return separator;
          }
          case "section":
            return convertMockupSection(item);
          case "media_gallery":
            return convertMockupMediaGallery(item);
          case "action_row":
            return convertMockupActionRow(item, officialRowQueue);
          case "file":
            return { type: ComponentType.File, file: { url: String(item.url ?? "") } };
          default:
            return null;
        }
      })
      .filter(Boolean);

    wire.components = items;
    return wire;
  });

  return [...containers, ...officialRowQueue];
}

export function buildCustomOrFallbackPayload(
  customJson: any,
  fallbackContainer: any,
  actionRows: any[] = [],
): any {
  if (customJson && Array.isArray(customJson.containers) && customJson.containers.length > 0) {
    return {
      components: convertContainersMockupToWire(customJson.containers, actionRows),
      flags: ["IsComponentsV2"],
    };
  }

  if (customJson && (customJson.content || (customJson.embeds && customJson.embeds.length > 0))) {
    return {
      content: customJson.content || undefined,
      embeds: customJson.embeds || [],
      components: actionRows,
    };
  }

  return {
    components: [fallbackContainer],
    flags: ["IsComponentsV2"],
  };
}

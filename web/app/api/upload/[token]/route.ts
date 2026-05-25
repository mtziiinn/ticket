import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

const DISCORD_API = "https://discord.com/api/v10";

async function discordFetch(endpoint: string, options: RequestInit = {}) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  const res = await fetch(`${DISCORD_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[Discord API] ${res.status} ${endpoint}: ${text}`);
    return null;
  }
  return res.json();
}

async function sendDiscordMessage(
  channelId: string,
  content: string,
  components?: unknown[],
) {
  const body: Record<string, unknown> = { content };
  if (components) body.components = components;
  return discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function createDM(userId: string) {
  return discordFetch("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: userId }),
  });
}

async function getUserAvatar(userId: string): Promise<string | null> {
  const user = await discordFetch(`/users/${userId}`);
  if (!user?.avatar || !user?.discriminator) return null;
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.${ext}`;
}

function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

function getContainer(
  color: string,
  ...components: unknown[]
) {
  return {
    type: 17,
    accent_color: hexToInt(color),
    components,
  };
}

function getSection(content: string, thumbnailUrl?: string) {
  const section: Record<string, unknown> = {
    type: 18,
    components: [{ type: 20, content }],
  };
  if (thumbnailUrl) {
    section.accessory = { type: 21, media: { url: thumbnailUrl } };
  }
  return section;
}

function getSeparator() {
  return { type: 19 };
}

function getTextDisplay(content: string) {
  return { type: 20, content };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const db = await getDatabase();
    const pending = await db.collection("pending_deliveries").findOne({ token });

    if (!pending) {
      return NextResponse.json({ error: "Token inválido" }, { status: 404 });
    }

    if (pending.status === "completed") {
      return NextResponse.json({ error: "Upload já realizado" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = file.name;
    const contentType = file.type || "application/octet-stream";

    const baseUrl = process.env.WEB_URL || request.nextUrl.origin;
    const downloadUrl = `${baseUrl}/api/file/${token}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db.collection("delivery_files").updateOne(
      { token },
      {
        $set: {
          token,
          filename,
          contentType,
          fileData: buffer,
          createdAt: now,
          expiresAt,
        },
      },
      { upsert: true },
    );

    await db.collection("delivery_files").createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60, background: true },
    ).catch(() => null);

    const ticket = await db.collection("tickets").findOne({ ticketId: pending.ticketId });

    if (ticket) {
      if (!ticket.deliveries) ticket.deliveries = [];
      ticket.deliveries.push({
        url: downloadUrl,
        filename,
        description: pending.description || "Mídia entregue",
        deliveredBy: pending.staffId,
        deliveredAt: new Date(),
      });
      await db.collection("tickets").updateOne(
        { _id: ticket._id },
        { $set: { deliveries: ticket.deliveries } },
      );
    }

    await db.collection("pending_deliveries").deleteOne({ _id: pending._id });

    const staffMention = pending.staffId ? `<@${pending.staffId}>` : "Staff";
    const channelMsg = `<:action_check:1502789797821939752> ${staffMention} entregou a mídia!\n<:file_add:1502789905112105071> **Arquivo:** \`${filename}\`\n<:clipboard:1502789887907205293> **Descrição:** ${pending.description || "Mídia entregue"}\n<:cloud_check:1502789867355115690> **Link:** ${downloadUrl}`;
    await sendDiscordMessage(pending.channelId, channelMsg);

    if (ticket?.ownerId) {
      const staffAvatar = await getUserAvatar(pending.staffId);
      const dmContainer = getContainer(
        "#3b82f6",
        getSection(
          `### <:file_check:1502789906122936431> Mídia Entregue!\nOlá <@${ticket.ownerId}>, o arquivo final do seu pedido foi entregue!`,
          staffAvatar || undefined,
        ),
        getSeparator(),
        getTextDisplay(`<:file_add:1502789905112105071> **Arquivo:** \`${filename}\``),
        getTextDisplay(`<:clipboard:1502789887907205293> **Descrição:** ${pending.description || "Mídia entregue"}`),
        getTextDisplay(`<:cloud_check:1502789867355115690> **Link:** ${downloadUrl}`),
      );

      const dm = await createDM(ticket.ownerId);
      if (dm?.id) {
        await sendDiscordMessage(dm.id, "", [dmContainer]);
      }
    }

    return NextResponse.json({ success: true, url: downloadUrl, filename });
  } catch (error) {
    console.error("[Upload API] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

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

    await db.collection("delivery_files").updateOne(
      { token },
      {
        $set: {
          token,
          filename,
          contentType,
          fileData: buffer,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

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

    const channelMsg = `<:action_check:1502789797821939752> **Mídia Entregue!**\n<:file_add:1502789905112105071> **Arquivo:** \`${filename}\`\n<:clipboard:1502789887907205293> **Descrição:** ${pending.description || "Mídia entregue"}\n<:cloud_check:1502789867355115690> **Link:** ${downloadUrl}`;
    await sendDiscordMessage(pending.channelId, channelMsg);

    if (ticket?.ownerId) {
      const dm = await createDM(ticket.ownerId);
      if (dm?.id) {
        const dmMsg = `### <:file_check:1502789906122936431> Mídia Entregue!\nOlá <@${ticket.ownerId}>, o arquivo final do seu pedido foi entregue!\n\n📁 **Arquivo:** \`${filename}\`\n📝 **Descrição:** ${pending.description || "Mídia entregue"}\n🔗 **Link:** ${downloadUrl}`;
        await sendDiscordMessage(dm.id, dmMsg);
      }
    }

    return NextResponse.json({ success: true, url: downloadUrl, filename });
  } catch (error) {
    console.error("[Upload API] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

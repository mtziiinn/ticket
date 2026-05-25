import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver") as any;

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

async function sendDiscordMessage(channelId: string, content: string) {
  return discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
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
    const fileEntries = formData.getAll("file") as File[];

    if (!fileEntries || fileEntries.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const baseUrl = process.env.WEB_URL || request.nextUrl.origin;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let zipFilename: string;
    let zipBuffer: Buffer;

    if (fileEntries.length === 1) {
      const file = fileEntries[0];
      const bytes = await file.arrayBuffer();
      zipBuffer = Buffer.from(bytes);
      zipFilename = file.name;
    } else {
      zipFilename = `entregaveis_${token}.zip`;

      const fileData = await Promise.all(
        fileEntries.map(async (f) => ({
          name: f.name,
          buffer: Buffer.from(await f.arrayBuffer()),
        })),
      );

      const buffers: Buffer[] = [];
      const archive = new ZipArchive({ zlib: { level: 5 } });

      archive.on("data", (chunk: Buffer) => buffers.push(chunk));

      await new Promise<void>((resolve, reject) => {
        archive.on("end", resolve);
        archive.on("error", reject);

        for (const f of fileData) {
          archive.append(f.buffer, { name: f.name });
        }

        archive.finalize();
      });

      zipBuffer = Buffer.concat(buffers);
    }

    const downloadUrl = `${baseUrl}/api/file/${token}`;

    await db.collection("delivery_files").updateOne(
      { token },
      {
        $set: {
          token,
          filename: zipFilename,
          contentType: "application/zip",
          fileData: zipBuffer,
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
        filename: zipFilename,
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

    const isMulti = fileEntries.length > 1;
    const fileList = fileEntries.map((f) => f.name).join(", ");
    const sizeInfo = isMulti
      ? ` (${fileEntries.length} arquivos compactados em ZIP)`
      : "";
    const staffMention = pending.staffId ? `<@${pending.staffId}>` : "Staff";
    const channelMsg = [
      `<:action_check:1502789797821939752> ${staffMention} entregou a mídia!${sizeInfo}`,
      `<:file_add:1502789905112105071> **Arquivo:** \`${zipFilename}\``,
      `<:file_add:1502789905112105071> **Arquivos:** ${fileList}`,
      `<:clipboard:1502789887907205293> **Descrição:** ${pending.description || "Mídia entregue"}`,
      `<:cloud_check:1502789867355115690> **Link:** ${downloadUrl}`,
      `<:action_warning:1502789801949265990> O link expira em **7 dias**.`,
    ].join("\n");
    await sendDiscordMessage(pending.channelId, channelMsg);

    if (ticket?.ownerId) {
      await db.collection("dm_queue").insertOne({
        ownerId: ticket.ownerId,
        staffId: pending.staffId,
        filename: zipFilename,
        description: pending.description || "Mídia entregue",
        downloadUrl,
        channelId: pending.channelId,
        fileCount: fileEntries.length,
        fileList,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ success: true, url: downloadUrl, filename: zipFilename });
  } catch (error) {
    console.error("[Upload API] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

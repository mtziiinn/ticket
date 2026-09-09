import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { resolveTenant } from "@/lib/tenant";
import { createRequire } from "node:module";
import type { ObjectId } from "mongodb";

type ZipArchiveInstance = {
  on(event: "data", listener: (chunk: Buffer) => void): ZipArchiveInstance;
  on(event: "end", listener: () => void): ZipArchiveInstance;
  on(event: "error", listener: (error: Error) => void): ZipArchiveInstance;
  append(source: Buffer, data: { name: string }): void;
  finalize(): void;
};

type ZipArchiveConstructor = new (options: { zlib: { level: number } }) => ZipArchiveInstance;

const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver") as { ZipArchive: ZipArchiveConstructor };

const DISCORD_API = "https://discord.com/api/v10";
const MAX_FILES = 10;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type PendingDelivery = {
  _id: ObjectId;
  token: string;
  channelId: string;
  staffId: string;
  description?: string;
  ticketId: string;
  status: "pending" | "processing" | "completed";
  expiresAt: Date;
};

type Delivery = {
  url: string;
  filename: string;
  description: string;
  deliveredBy: string;
  deliveredAt: Date;
};

type Ticket = {
  _id: ObjectId;
  ownerId?: string;
  deliveries?: Delivery[];
};

async function discordFetch(
  token: string | undefined,
  endpoint: string,
  options: RequestInit = {},
) {
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
  token: string | undefined,
  channelId: string,
  content: string,
) {
  return discordFetch(token, `/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tenant = resolveTenant(request);
  let pendingId: ObjectId | undefined;

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Upload excede o limite de 25 MB" }, { status: 413 });
    }

    const db = await getDatabase(tenant.dbName);
    const now = new Date();
    const formData = await request.formData();
    const fileEntries = formData.getAll("file") as File[];

    if (!fileEntries || fileEntries.length === 0 || fileEntries.length > MAX_FILES) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const totalSize = fileEntries.reduce((total, file) => total + file.size, 0);
    if (totalSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Upload excede o limite de 25 MB" }, { status: 413 });
    }

    const pending = await db.collection<PendingDelivery>("pending_deliveries").findOneAndUpdate(
      { token, status: "pending", expiresAt: { $gt: now } },
      { $set: { status: "processing" } },
      { returnDocument: "after" },
    );

    if (!pending) {
      return NextResponse.json({ error: "Link inválido, expirado ou já utilizado" }, { status: 404 });
    }
    pendingId = pending._id;

    // Usa o domínio da própria requisição (tenant correto), não o WEB_URL global.
    const reqHost =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    const reqProto = request.headers.get("x-forwarded-proto") || "https";
    const baseUrl = reqHost
      ? `${reqProto}://${reqHost}`
      : process.env.WEB_URL || request.nextUrl.origin;
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
          contentType: fileEntries.length > 1
            ? "application/zip"
            : fileEntries[0].type || "application/octet-stream",
          fileData: zipBuffer,
          createdAt: now,
          expiresAt,
        },
      },
      { upsert: true },
    );

    const ticket = await db.collection<Ticket>("tickets").findOne(
      { ticketId: pending.ticketId },
      { projection: { ownerId: 1 } },
    );

    if (!ticket) {
      throw new Error("Ticket não encontrado para a entrega pendente");
    }

    await db.collection<Ticket>("tickets").updateOne(
      { _id: ticket._id },
      {
        $push: {
          deliveries: {
            url: downloadUrl,
            filename: zipFilename,
            description: pending.description || "Mídia entregue",
            deliveredBy: pending.staffId,
            deliveredAt: now,
          },
        },
      },
    );

    await db.collection("pending_deliveries").deleteOne({ _id: pending._id });

    const isMulti = fileEntries.length > 1;
    const fileList = fileEntries.map((f) => f.name).join(", ");
    const sizeInfo = isMulti
      ? ` (${fileEntries.length} arquivos compactados em ZIP)`
      : "";
    const staffMention = pending.staffId ? `<@${pending.staffId}>` : "Staff";
    const channelMsg = [
      `✅ ${staffMention} entregou a mídia!${sizeInfo}`,
      `📎 **Arquivo:** \`${zipFilename}\``,
      `📎 **Arquivos:** ${fileList}`,
      `📋 **Descrição:** ${pending.description || "Mídia entregue"}`,
      `🔗 **Link:** ${downloadUrl}`,
      `⚠️ O link expira em **7 dias**.`,
    ].join("\n");
    await sendDiscordMessage(tenant.botToken, pending.channelId, channelMsg).catch((error) => {
      console.error("[Upload API] Não foi possível avisar o canal:", error);
    });

    if (ticket.ownerId) {
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
      }).catch((error) => {
        console.error("[Upload API] Não foi possível enfileirar a DM:", error);
      });
    }

    return NextResponse.json({ success: true, url: downloadUrl, filename: zipFilename });
  } catch (error) {
    if (pendingId) {
      await getDatabase(tenant.dbName)
        .then((db) => db.collection<PendingDelivery>("pending_deliveries").updateOne(
          { _id: pendingId, status: "processing" },
          { $set: { status: "pending" } },
        ))
        .catch(() => null);
    }
    console.error("[Upload API] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

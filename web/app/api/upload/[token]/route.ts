import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getDatabase } from "@/lib/mongodb";
import { resolveTenant, emojiTag } from "@/lib/tenant";
import type { ObjectId } from "mongodb";

const DISCORD_API = "https://discord.com/api/v10";
// O upload agora vai direto do navegador para o Vercel Blob (não passa mais
// pela função serverless), então o teto real deixou de ser os ~4,5 MB de
// corpo de requisição da Vercel. 100 MB dá folga para vídeos/pacotes maiores
// sem deixar o link aceitar qualquer coisa.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

type PendingDelivery = {
  _id: ObjectId;
  token: string;
  channelId: string;
  staffId: string;
  description?: string;
  ticketId: string;
  status: "pending" | "completed";
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
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // Só confirma que o link ainda é válido; quem grava os dados de fato
      // é onUploadCompleted, chamado pela Vercel depois que os bytes já
      // estão salvos no Blob (o link só é consumido em caso de sucesso real).
      onBeforeGenerateToken: async () => {
        const db = await getDatabase(tenant.dbName);
        const pending = await db.collection<PendingDelivery>("pending_deliveries").findOne({
          token,
          status: "pending",
          expiresAt: { $gt: new Date() },
        });
        if (!pending) {
          throw new Error("Link inválido, expirado ou já utilizado");
        }
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const db = await getDatabase(tenant.dbName);
        const now = new Date();

        // Atômico: garante que um retry do webhook da Vercel não processe a
        // mesma entrega duas vezes (duas mensagens no Discord, dois pushes).
        const pending = await db.collection<PendingDelivery>("pending_deliveries").findOneAndUpdate(
          { token, status: "pending", expiresAt: { $gt: now } },
          { $set: { status: "completed" } },
          { returnDocument: "after" },
        );
        if (!pending) return;

        let fileNames: string[] = [blob.pathname];
        try {
          if (tokenPayload) {
            const parsed = JSON.parse(tokenPayload) as { fileNames?: string[] };
            if (Array.isArray(parsed.fileNames) && parsed.fileNames.length > 0) {
              fileNames = parsed.fileNames;
            }
          }
        } catch {
          /* payload ausente ou inválido: usa o nome do blob mesmo */
        }

        const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const reqProto = request.headers.get("x-forwarded-proto") || "https";
        const baseUrl = reqHost
          ? `${reqProto}://${reqHost}`
          : process.env.WEB_URL || request.nextUrl.origin;
        const downloadUrl = `${baseUrl}/api/file/${token}`;
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        await db.collection("delivery_files").updateOne(
          { token },
          {
            $set: {
              token,
              filename: blob.pathname,
              contentType: blob.contentType,
              blobUrl: blob.url,
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
          console.error("[Upload API] Ticket não encontrado para a entrega pendente", pending.ticketId);
          return;
        }

        await db.collection<Ticket>("tickets").updateOne(
          { _id: ticket._id },
          {
            $push: {
              deliveries: {
                url: downloadUrl,
                filename: blob.pathname,
                description: pending.description || "Mídia entregue",
                deliveredBy: pending.staffId,
                deliveredAt: now,
              },
            },
          },
        );

        await db.collection("pending_deliveries").deleteOne({ _id: pending._id });

        const isMulti = fileNames.length > 1;
        const sizeInfo = isMulti ? ` (${fileNames.length} arquivos compactados em ZIP)` : "";
        const staffMention = pending.staffId ? `<@${pending.staffId}>` : "Staff";
        const emo = (n: string, f: string) => emojiTag(tenant, n, f);
        const channelMsg = [
          `${emo("action_check", "✅")} ${staffMention} entregou a mídia!${sizeInfo}`,
          `${emo("file_add", "📎")} **Arquivo:** \`${blob.pathname}\``,
          `${emo("file_add", "📎")} **Arquivos:** ${fileNames.join(", ")}`,
          `${emo("clipboard", "📋")} **Descrição:** ${pending.description || "Mídia entregue"}`,
          `${emo("cloud_check", "🔗")} **Link:** ${downloadUrl}`,
          `${emo("action_warning", "⚠️")} O link expira em **7 dias**.`,
        ].join("\n");
        await sendDiscordMessage(tenant.botToken, pending.channelId, channelMsg).catch((error) => {
          console.error("[Upload API] Não foi possível avisar o canal:", error);
        });

        if (ticket.ownerId) {
          await db.collection("dm_queue").insertOne({
            ownerId: ticket.ownerId,
            staffId: pending.staffId,
            filename: blob.pathname,
            description: pending.description || "Mídia entregue",
            downloadUrl,
            channelId: pending.channelId,
            fileCount: fileNames.length,
            fileList: fileNames.join(", "),
            createdAt: now,
          }).catch((error) => {
            console.error("[Upload API] Não foi possível enfileirar a DM:", error);
          });
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[Upload API] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 400 },
    );
  }
}

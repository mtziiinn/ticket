import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getDatabase } from "@/lib/mongodb";
import { resolveTenant, resolveTenantByDbName, emojiTag, type Tenant } from "@/lib/tenant";
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

// IS_COMPONENTS_V2 — obrigatória para mandar um Container (o mesmo formato
// visual usado no embed de DM em src/index.ts de cada bot).
const IS_COMPONENTS_V2 = 1 << 15;

function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

/** Avatar "limpo" (PNG estático) do usuário, com fallback pro avatar padrão do Discord. */
async function getDiscordAvatarUrl(
  botToken: string | undefined,
  userId: string,
): Promise<string> {
  const user = await discordFetch(botToken, `/users/${userId}`).catch(() => null);
  if (user?.avatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png?size=256`;
  }
  // Sistema de username novo: índice do avatar padrão = (id >> 22) % 6.
  const defaultIndex = Number((BigInt(userId) >> BigInt(22)) % BigInt(6));
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

/**
 * Monta o mesmo container (Components V2) usado na DM de entrega de mídia
 * (src/index.ts de cada bot), pra a mensagem no canal do ticket sair
 * visualmente idêntica — só troca a saudação de "Olá {cliente}" continua
 * igual, já que o canal do ticket também pertence ao cliente.
 */
function buildDeliveryContainer(params: {
  tenant: Tenant;
  ownerId?: string;
  staffAvatarUrl: string;
  fileNames: string[];
  filename: string;
  description: string;
  downloadUrl: string;
}) {
  const { tenant, ownerId, staffAvatarUrl, fileNames, filename, description, downloadUrl } = params;
  const emo = (n: string, f: string) => emojiTag(tenant, n, f);
  const isMulti = fileNames.length > 1;
  const fileLine = isMulti
    ? `${emo("file_add", "📎")} **${fileNames.length} arquivos compactados em ZIP:** \`${filename}\``
    : `${emo("file_add", "📎")} **Arquivo:** \`${filename}\``;
  const greeting = ownerId
    ? `Olá <@${ownerId}>, o arquivo final do seu pedido foi entregue!`
    : "O arquivo final do pedido foi entregue!";

  return {
    type: 17, // Container
    accent_color: hexToInt(tenant.primaryColor || "#38bdf8"),
    components: [
      {
        type: 9, // Section
        components: [
          { type: 10, content: `### ${emo("prism", "📦")} Mídia Entregue!\n${greeting}` },
        ],
        accessory: { type: 11, media: { url: staffAvatarUrl } },
      },
      { type: 14, divider: true, spacing: 1 }, // Separator.Default
      { type: 10, content: fileLine },
      { type: 10, content: `${emo("clipboard", "📋")} **Descrição:** ${description}` },
      { type: 10, content: `${emo("cloud_check", "🔗")} **Link:** ${downloadUrl}` },
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: `${emo("action_warning", "⚠️")} O link expira em **7 dias**.` },
      {
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 5, // Link
            label: "Baixar Arquivo",
            emoji: tenant.emojis?.download ? { id: tenant.emojis.download } : { name: "⬇️" },
            url: downloadUrl,
          },
        ],
      },
    ],
  };
}

async function sendDeliveryContainerMessage(
  botToken: string | undefined,
  channelId: string,
  container: ReturnType<typeof buildDeliveryContainer>,
) {
  return discordFetch(botToken, `/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ components: [container], flags: IS_COMPONENTS_V2 }),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // Só confirma que o link ainda é válido; quem grava os dados de fato
      // é onUploadCompleted, chamado pela Vercel depois que os bytes já
      // estão salvos no Blob (o link só é consumido em caso de sucesso real).
      //
      // IMPORTANTE: a chamada de onUploadCompleted é um webhook feito pelo
      // backend do Vercel Blob, não pelo navegador — na prática ela pode
      // chegar por um domínio diferente do que o usuário realmente usou
      // (já observado batendo no domínio "canônico" de produção em vez do
      // domínio do tenant), o que quebraria resolveTenant(request) ali
      // dentro. Por isso o tenant (dbName) e a baseUrl são resolvidos AQUI,
      // onde o host ainda é confiável, e viajam dentro do tokenPayload
      // assinado — não recalculados a partir da segunda requisição.
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const tenant = resolveTenant(request);
        const db = await getDatabase(tenant.dbName);
        const pending = await db.collection<PendingDelivery>("pending_deliveries").findOne({
          token,
          status: "pending",
          expiresAt: { $gt: new Date() },
        });
        if (!pending) {
          throw new Error("Link inválido, expirado ou já utilizado");
        }

        const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const reqProto = request.headers.get("x-forwarded-proto") || "https";
        const baseUrl = reqHost
          ? `${reqProto}://${reqHost}`
          : process.env.WEB_URL || request.nextUrl.origin;

        let fileNames: string[] = [];
        try {
          const parsed = clientPayload ? (JSON.parse(clientPayload) as { fileNames?: string[] }) : null;
          if (Array.isArray(parsed?.fileNames)) fileNames = parsed.fileNames;
        } catch {
          /* payload do cliente ausente ou inválido */
        }

        return {
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          tokenPayload: JSON.stringify({ dbName: tenant.dbName, baseUrl, fileNames }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let dbName = resolveTenant(request).dbName;
        let baseUrl: string | undefined;
        let fileNames: string[] = [blob.pathname];
        try {
          if (tokenPayload) {
            const parsed = JSON.parse(tokenPayload) as {
              dbName?: string;
              baseUrl?: string;
              fileNames?: string[];
            };
            if (parsed.dbName) dbName = parsed.dbName;
            if (parsed.baseUrl) baseUrl = parsed.baseUrl;
            if (Array.isArray(parsed.fileNames) && parsed.fileNames.length > 0) {
              fileNames = parsed.fileNames;
            }
          }
        } catch {
          /* payload ausente ou inválido: cai no fallback do host desta chamada */
        }

        const tenant = resolveTenantByDbName(dbName);
        const db = await getDatabase(dbName);
        const now = new Date();

        // Atômico: garante que um retry do webhook da Vercel não processe a
        // mesma entrega duas vezes (duas mensagens no Discord, dois pushes).
        const pending = await db.collection<PendingDelivery>("pending_deliveries").findOneAndUpdate(
          { token, status: "pending", expiresAt: { $gt: now } },
          { $set: { status: "completed" } },
          { returnDocument: "after" },
        );
        if (!pending) return;

        if (!baseUrl) {
          const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
          const reqProto = request.headers.get("x-forwarded-proto") || "https";
          baseUrl = reqHost ? `${reqProto}://${reqHost}` : process.env.WEB_URL || request.nextUrl.origin;
        }
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

        // Mesmo container (Components V2) da DM de entrega — só troca o
        // "Olá {cliente}" continua igual, já que o canal do ticket também é do cliente.
        const staffAvatarUrl = await getDiscordAvatarUrl(tenant.botToken, pending.staffId);
        const container = buildDeliveryContainer({
          tenant,
          ownerId: ticket.ownerId,
          staffAvatarUrl,
          fileNames,
          filename: blob.pathname,
          description: pending.description || "Mídia entregue",
          downloadUrl,
        });
        await sendDeliveryContainerMessage(tenant.botToken, pending.channelId, container).catch((error) => {
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

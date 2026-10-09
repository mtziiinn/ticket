import { NextRequest, NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { isDiscordAttachmentUrl, refreshDiscordUrls, uploadUrlToVercelBlob } from "@/lib/blob-media";
import { getDatabase } from "@/lib/mongodb";
import type { Transcript } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl || !isDiscordAttachmentUrl(targetUrl)) {
    return NextResponse.json({ error: "URL inválida ou não suportada" }, { status: 400 });
  }

  const tenant = resolveTenant(request);

  try {
    // 1. Tentar renovar a URL pelo Discord usando o botToken
    let fetchUrl = targetUrl;
    if (tenant.botToken) {
      const refreshedMap = await refreshDiscordUrls(tenant.botToken, [targetUrl]);
      if (refreshedMap.has(targetUrl)) {
        fetchUrl = refreshedMap.get(targetUrl)!;
      }
    }

    // 2. Baixar a imagem do Discord
    const discordRes = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "Ticket-Transcript-Proxy/1.0",
      },
    });

    if (!discordRes.ok) {
      return NextResponse.json(
        { error: `Imagem indisponível no Discord (${discordRes.status})` },
        { status: 404 },
      );
    }

    const contentType = discordRes.headers.get("content-type") || "image/png";
    const imageBuffer = Buffer.from(await discordRes.arrayBuffer());

    // 3. Em segundo plano: subir para o Vercel Blob se o token estiver configurado
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      (async () => {
        try {
          const filename = targetUrl.split("/").pop()?.split("?")[0] || "imagem.png";
          const blobUrl = await uploadUrlToVercelBlob(fetchUrl, filename, "transcripts/recovered");
          if (blobUrl && tenant.dbName) {
            const db = await getDatabase(tenant.dbName);
            await db.collection<Transcript>("transcripts").updateMany(
              { "messages.attachments.url": targetUrl },
              { $set: { "messages.$[].attachments.$[att].url": blobUrl } },
              { arrayFilters: [{ "att.url": targetUrl }] },
            );
          }
        } catch (err) {
          console.warn("[Image Proxy] Falha ao persistir no Blob em segundo plano:", err);
        }
      })();
    }

    // 4. Retornar os bytes da imagem com cache
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("[Image Proxy] Erro:", error);
    return NextResponse.json({ error: "Erro interno no proxy de imagem" }, { status: 500 });
  }
}

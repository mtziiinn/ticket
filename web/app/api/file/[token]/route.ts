import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { resolveTenant } from "@/lib/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tenant = resolveTenant(request);

  try {
    const db = await getDatabase(tenant.dbName);
    const file = await db.collection("delivery_files").findOne(
      { token },
      { projection: { fileData: 1, blobUrl: 1, filename: 1, contentType: 1, expiresAt: 1 } },
    );

    if (!file || (!file.blobUrl && !file.fileData)) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }

    if (file.expiresAt && new Date() > new Date(file.expiresAt)) {
      return NextResponse.json({ error: "Link expirado" }, { status: 410 });
    }

    // Entregas novas: os bytes moram no Vercel Blob, só redireciona (evita o
    // limite de ~4,5 MB de resposta das funções serverless da Vercel).
    if (file.blobUrl) {
      const downloadName = encodeURIComponent(file.filename || "download");
      return NextResponse.redirect(`${file.blobUrl}?download=${downloadName}`);
    }

    // Compat: entregas feitas antes da migração para o Blob, com os bytes
    // salvos direto no documento. Continuam servindo do jeito antigo até expirar.
    const buffer = file.fileData.buffer
      ? Buffer.from(file.fileData.buffer)
      : Buffer.from(file.fileData);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename || "download")}`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[File API] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const db = await getDatabase();
    const file = await db.collection("delivery_files").findOne(
      { token },
      { projection: { fileData: 1, filename: 1, contentType: 1, expiresAt: 1 } },
    );

    if (!file?.fileData) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }

    if (file.expiresAt && new Date() > new Date(file.expiresAt)) {
      return NextResponse.json({ error: "Link expirado" }, { status: 410 });
    }

    const buffer = file.fileData.buffer
      ? Buffer.from(file.fileData.buffer)
      : Buffer.from(file.fileData);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[File API] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

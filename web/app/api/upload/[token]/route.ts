import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

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

    const uploadDir = path.join(process.cwd(), "public", "uploads", token);
    await mkdir(uploadDir, { recursive: true });

    const filename = file.name;
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const baseUrl = process.env.WEB_URL || request.nextUrl.origin;
    const fileUrl = `${baseUrl}/uploads/${token}/${filename}`;

    await db.collection("pending_deliveries").updateOne(
      { token },
      {
        $set: {
          status: "completed",
          url: fileUrl,
          filename,
          completedAt: new Date(),
        },
      },
    );

    return NextResponse.json({ success: true, url: fileUrl, filename });
  } catch (error) {
    console.error("[Upload API] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

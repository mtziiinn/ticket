import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { resolveTenant } from "@/lib/tenant";
import { syncTranscriptMedia } from "@/lib/blob-media";
import type { Transcript } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tenant = resolveTenant(request);

  try {
    const db = await getDatabase(tenant.dbName);
    const collection = db.collection<Transcript>("transcripts");
    const cleanId = (id || "").trim();

    const transcript = await collection.findOne({
      $or: [
        { id: cleanId },
        { id: cleanId.toUpperCase() },
        { id: cleanId.toLowerCase() },
      ],
    });

    if (!transcript) {
      return NextResponse.json({ error: "Transcript não encontrado" }, { status: 404 });
    }

    const { updated } = await syncTranscriptMedia(transcript, tenant.botToken, tenant.dbName);

    return NextResponse.json({
      success: true,
      updated,
      id: transcript.id,
    });
  } catch (error) {
    console.error("[Media API] Erro ao sincronizar mídias:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

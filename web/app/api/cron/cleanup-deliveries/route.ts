import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getDatabase } from "@/lib/mongodb";
import { listAllDbNames } from "@/lib/tenant";

// Chamada pelo cron da Vercel (vercel.json). Sem índice TTL no Mongo para
// delivery_files: apagar só o documento e deixar o blob órfão custaria
// armazenamento pra sempre, então essa rota apaga os dois juntos, em ordem
// (blob primeiro — se falhar, o documento continua e tenta de novo amanhã).
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();
  let removed = 0;
  const errors: string[] = [];

  for (const dbName of listAllDbNames()) {
    const db = await getDatabase(dbName);
    const expired = await db
      .collection("delivery_files")
      .find({ expiresAt: { $lte: now } }, { projection: { token: 1, blobUrl: 1 } })
      .toArray();

    for (const doc of expired) {
      try {
        if (doc.blobUrl) await del(doc.blobUrl);
        await db.collection("delivery_files").deleteOne({ _id: doc._id });
        removed++;
      } catch (error) {
        errors.push(`${dbName}/${doc.token}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  if (errors.length > 0) console.error("[Cron cleanup-deliveries] Falhas:", errors);
  return NextResponse.json({ removed, errors: errors.length });
}

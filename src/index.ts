import { env } from "#env";
import { bootstrap } from "@constatic/base";
import { db } from "#database";
import "./constants.js";

console.log("------------------------------------------");
console.log("BOT INICIANDO - SISTEMA DE TICKETS ATIVO");
console.log("------------------------------------------");

async function cleanupOldTranscripts() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.transcripts.deleteMany({
      createdAt: { $lt: thirtyDaysAgo.toISOString() },
    });

    if (result.deletedCount > 0) {
      console.log(`[Cleanup] ${result.deletedCount} transcripts antigos removidos`);
    }
  } catch (error) {
    console.error("[Cleanup] Erro ao limpar transcripts:", error);
  }
}

async function cleanupOldDeliveries() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.tickets.updateMany(
      {},
      { $pull: { deliveries: { deliveredAt: { $lt: thirtyDaysAgo } } } },
    );

    if (result.modifiedCount > 0) {
      console.log(`[Cleanup] ${result.modifiedCount} tickets tiveram entregas antigas removidas`);
    }
  } catch (error) {
    console.error("[Cleanup] Erro ao limpar entregas:", error);
  }
}

async function cleanupPendingDeliveries() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await db.pendingDeliveries.deleteMany({
      createdAt: { $lt: sevenDaysAgo },
    });

    if (result.deletedCount > 0) {
      console.log(`[Cleanup] ${result.deletedCount} pending deliveries expirados removidos`);
    }
  } catch (error) {
    console.error("[Cleanup] Erro ao limpar pending deliveries:", error);
  }
}

await bootstrap({ meta: import.meta, env });
await cleanupOldTranscripts();
await cleanupOldDeliveries();
await cleanupPendingDeliveries();
setInterval(cleanupOldTranscripts, 6 * 60 * 60 * 1000);
setInterval(cleanupOldDeliveries, 6 * 60 * 60 * 1000);
setInterval(cleanupPendingDeliveries, 6 * 60 * 60 * 1000);

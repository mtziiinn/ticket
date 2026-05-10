import { db } from "#database";

async function clear() {
    console.log("------------------------------------------");
    console.log("INICIANDO LIMPEZA DO BANCO DE DADOS");
    console.log("------------------------------------------");

    try {
        const tRes = await db.tickets.deleteMany({});
        const trRes = await db.transcripts.deleteMany({});

        console.log("✅ Limpeza concluída com sucesso!");
        console.log(`- Tickets removidos: ${tRes.deletedCount}`);
        console.log(`- Transcripts removidos: ${trRes.deletedCount}`);
        console.log("------------------------------------------");
    } catch (e) {
        console.error("❌ Erro ao limpar o banco:", e);
    } finally {
        process.exit(0);
    }
}

clear();

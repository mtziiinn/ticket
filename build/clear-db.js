import { db } from "#database";
async function clear() {
    console.log("------------------------------------------");
    console.log("INICIANDO LIMPEZA DO BANCO DE DADOS");
    console.log("------------------------------------------");
    try {
        const [tickets, transcripts, guilds, members, deliveries, giveaways, dmQueue] = await Promise.all([
            db.tickets.deleteMany({}),
            db.transcripts.deleteMany({}),
            db.guilds.deleteMany({}),
            db.members.deleteMany({}),
            db.pendingDeliveries.deleteMany({}),
            db.giveaways.deleteMany({}),
            db.dmQueue.deleteMany({}),
        ]);
        console.log("✅ Banco de dados limpo com sucesso!");
        console.log(`- Tickets removidos: ${tickets.deletedCount}`);
        console.log(`- Transcripts removidos: ${transcripts.deletedCount}`);
        console.log(`- Guilds (Servidores) removidos: ${guilds.deletedCount}`);
        console.log(`- Members (Membros) removidos: ${members.deletedCount}`);
        console.log(`- Pending Deliveries removidas: ${deliveries.deletedCount}`);
        console.log(`- Sorteios (Giveaways) removidos: ${giveaways.deletedCount}`);
        console.log(`- Fila DM removida: ${dmQueue.deletedCount}`);
        console.log("------------------------------------------");
    }
    catch (e) {
        console.error("❌ Erro ao limpar o banco:", e);
    }
    finally {
        process.exit(0);
    }
}
clear();

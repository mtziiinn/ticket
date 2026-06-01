import { createEvent } from "#base";
import { db } from "#database";
createEvent({
    name: "guildDelete",
    event: "guildDelete",
    async run(guild) {
        await db.guilds.deleteOne({ id: guild.id });
        await db.tickets.deleteMany({ guildId: guild.id });
        await db.transcripts.deleteMany({ guildId: guild.id });
        await db.members.deleteMany({ guildId: guild.id });
        console.log(`[Guild Leave] Saiu do servidor: ${guild.name} (${guild.id})`);
    },
});

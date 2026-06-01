import { createEvent } from "#base";
import { db } from "#database";

createEvent({
  name: "guildCreate",
  event: "guildCreate",
  async run(guild) {
    await db.guilds.get(guild.id);
    console.log(`[Guild Join] Entrou no servidor: ${guild.name} (${guild.id})`);
  },
});

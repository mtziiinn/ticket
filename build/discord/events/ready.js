import { createEvent } from "#base";
import { ActivityType } from "discord.js";
import { db } from "#database";
import { finishGiveaway } from "../commands/staff/giveaway.js";
createEvent({
    name: "ready",
    event: "ready",
    once: true,
    async run(client) {
        const statuses = [
            "💻 Desenvolvido por Mts",
            "💫 Transformando comunidades",
            "🚨 Desenvolvendo soluções profissionais",
        ];
        let i = 0;
        client.user?.setPresence({
            status: "dnd",
            activities: [{ name: statuses[0], type: ActivityType.Custom }],
        });
        setInterval(() => {
            i = (i + 1) % statuses.length;
            client.user?.setPresence({
                status: "dnd",
                activities: [{ name: statuses[i], type: ActivityType.Custom }],
            });
        }, 10000);
        // Verificação automática de sorteios a cada 30 segundos
        setInterval(async () => {
            try {
                const expiredGiveaways = await db.giveaways.find({
                    ended: false,
                    endsAt: { $lte: new Date() },
                });
                for (const g of expiredGiveaways) {
                    await finishGiveaway(g, client);
                }
            }
            catch (err) {
                console.error("[Giveaway Sweep] Erro:", err);
            }
        }, 30000);
        // Sincronizar apelido configurado nas guilds
        try {
            for (const guild of client.guilds.cache.values()) {
                const guildData = await db.guilds.get(guild.id);
                if (guildData?.identity?.botName &&
                    guild.members.me?.displayName !== guildData.identity.botName) {
                    await guild.members.me
                        ?.setNickname(guildData.identity.botName)
                        .catch(() => { });
                }
            }
        }
        catch (err) {
            console.error("[Ready] Erro ao sincronizar apelido do bot:", err);
        }
        // Sincronizar bio padrão da aplicação do bot
        try {
            const defaultBio = "<:as_bot:1207073701137485845>・Desenvolvido por One Network";
            await client.application?.fetch();
            if (client.application && client.application.description !== defaultBio) {
                await client.application
                    .edit({ description: defaultBio })
                    .catch(() => { });
            }
        }
        catch (err) {
            console.error("[Ready] Erro ao sincronizar bio do bot:", err);
        }
    },
});

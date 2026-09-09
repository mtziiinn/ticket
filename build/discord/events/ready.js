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
            "💻 Desenvolvido para Prism",
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
        }, 60000); // Rotação a cada 1 minuto (economiza ciclos de CPU e conexões de Gateway)
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
        // Sincronizar bio (descrição da aplicação) do bot
        try {
            const defaultBio = "<:robo2:1424614987644801045>・Desenvolvido por <@1061397602916126771>";
            await client.application?.fetch();
            if (client.application && client.application.description !== defaultBio) {
                await client.application.edit({ description: defaultBio }).catch(() => { });
            }
        }
        catch (err) {
            console.error("[Ready] Erro ao sincronizar bio do bot:", err);
        }
    },
});

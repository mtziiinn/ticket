import { createEvent } from "#base";
import { db } from "#database";
import { createContainer } from "@magicyan/discord";
import { getEmojiTag } from "#functions";
createEvent({
    name: "guildMemberAdd",
    event: "guildMemberAdd",
    async run(member) {
        try {
            const guildData = await db.guilds.get(member.guild.id);
            const w = guildData.welcome;
            if (!w)
                return;
            // 1. Verificação de idade mínima da conta
            const minAge = w.minAccountAgeDays ?? 0;
            if (minAge > 0) {
                const createdMs = member.user.createdTimestamp;
                const ageDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);
                if (ageDays < minAge) {
                    // Conta muito nova (possível fake/raid)
                    if (guildData.botLogsChannel) {
                        const logChan = member.guild.channels.cache.get(guildData.botLogsChannel);
                        if (logChan && logChan.isTextBased()) {
                            const alertContainer = createContainer("#ED4245", `| ${getEmojiTag("action_warning")} **Alerta de Segurança (Anti-Fake):**\nO usuário <@${member.id}> (\`${member.user.tag}\`) entrou no servidor com conta criada há apenas \`${Math.floor(ageDays)}\` dia(s) (mínimo exigido: \`${minAge}\` dias).`);
                            await logChan.send({
                                components: [alertContainer],
                                flags: ["IsComponentsV2"],
                            }).catch(() => { });
                        }
                    }
                }
            }
            // 2. Entrega de Cargo Automático (Autorole)
            if (w.autoRole) {
                await member.roles.add(w.autoRole).catch((err) => {
                    console.error("[Autorole] Falha ao entregar cargo:", err);
                });
            }
            // 3. Envio de Boas-vindas
            if (w.channelEntry) {
                const entryChan = member.guild.channels.cache.get(w.channelEntry);
                if (entryChan && entryChan.isTextBased()) {
                    const welcomeContainer = createContainer("#22c55e", `## ${getEmojiTag("user_add")} Bem-vindo(a) ao servidor, <@${member.id}>!`, `Você é o membro de número **#${member.guild.memberCount}**!\nEsperamos que aproveite a sua estadia conosco.`);
                    await entryChan.send({
                        components: [welcomeContainer],
                        flags: ["IsComponentsV2"],
                    }).catch(() => { });
                }
            }
        }
        catch (err) {
            console.error("[guildMemberAdd] Erro:", err);
        }
    },
});

import { createEvent } from "#base";
import { db } from "#database";
import { createContainer } from "@magicyan/discord";
import { getEmojiTag } from "#functions";
createEvent({
    name: "guildMemberRemove",
    event: "guildMemberRemove",
    async run(member) {
        try {
            const guildData = await db.guilds.get(member.guild.id);
            const w = guildData.welcome;
            if (!w || !w.channelExit)
                return;
            const exitChan = member.guild.channels.cache.get(w.channelExit);
            if (exitChan && exitChan.isTextBased()) {
                const exitContainer = createContainer("#ED4245", `## ${getEmojiTag("user_remove")} Um membro saiu do servidor`, `<@${member.id}> (\`${member.user?.tag || "Desconhecido"}\`) saiu do servidor.\nAgora somos **${member.guild.memberCount}** membros.`);
                await exitChan.send({
                    components: [exitContainer],
                    flags: ["IsComponentsV2"],
                }).catch(() => { });
            }
        }
        catch (err) {
            console.error("[guildMemberRemove] Erro:", err);
        }
    },
});

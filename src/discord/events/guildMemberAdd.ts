import { createEvent } from "#base";
import { db } from "#database";
import { createContainer } from "@magicyan/discord";
import { getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "guildMemberAdd",
  event: "guildMemberAdd",
  async run(member) {
    try {
      const guildData = await db.guilds.get(member.guild.id);
      const w = guildData.welcome;
      if (!w) return;

      // Verificação de idade mínima da conta
      const minAge = w.minAccountAgeDays ?? 0;
      if (minAge > 0) {
        const createdMs = member.user.createdTimestamp;
        const ageDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);

        if (ageDays < minAge) {
          if (guildData.botLogsChannel) {
            const logChan = member.guild.channels.cache.get(guildData.botLogsChannel);
            if (logChan && logChan.isTextBased()) {
              const alertContainer = createContainer(
                "#ED4245",
                `| ${getEmojiTag("action_warning")} **Anti-Fake:** <@${member.id}> entrou com conta de \`${Math.floor(ageDays)}\` dia(s) (mínimo: \`${minAge}\`)`,
              );
              await (logChan as any).send({
                components: [alertContainer],
                flags: ["IsComponentsV2"],
              }).catch(() => {});
            }
          }
        }
      }

      // Autorole
      if (w.autoRole) {
        await member.roles.add(w.autoRole).catch(() => {});
      }

      // Boas-vindas
      if (w.channelEntry) {
        const entryChan = member.guild.channels.cache.get(w.channelEntry);
        if (entryChan && entryChan.isTextBased()) {
          const welcomeContainer = createContainer(
            "#38bdf8",
            `## ${getEmojiTag("prism")} Bem-vindo(a), <@${member.id}>!`,
            `Você é o membro de número **#${member.guild.memberCount}**!`,
          );
          await (entryChan as any).send({
            components: [welcomeContainer],
            flags: ["IsComponentsV2"],
          }).catch(() => {});
        }
      }

      // Log
      const createdTs = Math.floor(member.user.createdTimestamp / 1000);

      const logContainer = createContainer(
        "#38bdf8",
        `## ${getEmojiTag("user_add")} Novo Membro`,
        [
          `| <@${member.id}> (\`${member.user.tag}\`)`,
          `| Conta criada: <t:${createdTs}:R>`,
          `| Total: \`${member.guild.memberCount}\``,
        ].join("\n"),
      );

      await sendBotLog(member.guild, logContainer);
    } catch (err) {
      console.error("[guildMemberAdd] Erro:", err);
    }
  },
});

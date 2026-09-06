import { createEvent } from "#base";
import { db } from "#database";
import { createContainer, createSection, Separator } from "@magicyan/discord";
import { AuditLogEvent } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "guildMemberRemove",
  event: "guildMemberRemove",
  async run(member) {
    try {
      const guildData = await db.guilds.get(member.guild.id);

      // 1. Verificar se foi expulsão (Kick)
      const kickExecutor = await getAuditLogExecutor(
        member.guild,
        AuditLogEvent.MemberKick,
        member.id,
      );

      const timestamp = Math.floor(Date.now() / 1000);
      const user = member.user;
      const avatar =
        user?.displayAvatarURL() ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      const isKick = !!kickExecutor;
      const title = isKick
        ? `## ${getEmojiTag("user_remove")} Membro Expulso (Kick)`
        : `## ${getEmojiTag("user_remove")} Membro Saiu do Servidor`;

      const responsibleLine = isKick
        ? `| ${getEmojiTag("user_check")} **Staff Responsável:** <@${kickExecutor.id}> (\`${kickExecutor.tag}\`)\n`
        : "";

      const logContainer = createContainer(
        "#ef4444",
        createSection({
          content: `${title}\nO usuário <@${member.id}> não está mais no servidor.`,
          thumbnail: avatar as any,
        }),
        Separator.Default,
        [
          `| ${getEmojiTag("user")} **Usuário:** <@${member.id}> (\`${user?.tag || "Desconhecido"}\` | \`${member.id}\`)`,
          responsibleLine,
          `| ${getEmojiTag("user_users")} **Membros Restantes:** \`${member.guild.memberCount}\``,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ]
          .filter(Boolean)
          .join("\n"),
      );

      await sendBotLog(member.guild, logContainer);

      // 2. Notificação no Canal de Saída configurado
      const w = guildData.welcome;
      if (w?.channelExit) {
        const exitChan = member.guild.channels.cache.get(w.channelExit);
        if (exitChan && exitChan.isTextBased()) {
          const exitContainer = createContainer(
            "#ED4245",
            `## ${getEmojiTag("user_remove")} Um membro saiu do servidor`,
            `<@${member.id}> (\`${member.user?.tag || "Desconhecido"}\`) saiu do servidor.\nAgora somos **${member.guild.memberCount}** membros.`,
          );
          await (exitChan as any).send({
            components: [exitContainer],
            flags: ["IsComponentsV2"],
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("[guildMemberRemove] Erro:", err);
    }
  },
});


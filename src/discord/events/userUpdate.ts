import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { PartialUser, User } from "discord.js";
import { getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "userUpdate",
  event: "userUpdate",
  async run(oldUser: User | PartialUser, newUser: User) {
    if (newUser.bot) return;
    if (oldUser.partial) return; // sem estado antigo confiável, não dá pra comparar

    const changes: string[] = [];
    if (oldUser.username !== newUser.username) {
      changes.push(`• ${getEmojiTag("action_info")} Nome de usuário: \`${oldUser.username}\` ➔ \`${newUser.username}\``);
    }
    if (oldUser.avatar !== newUser.avatar) {
      changes.push(`• ${getEmojiTag("user")} Avatar global atualizado`);
    }
    if (changes.length === 0) return;

    try {
      // userUpdate é global (não amarrado a um servidor) — só loga nos
      // servidores onde esse usuário está em cache como membro.
      for (const guild of newUser.client.guilds.cache.values()) {
        if (!guild.members.cache.has(newUser.id)) continue;

        const container = createContainer(
          "#eab308",
          `## ${getEmojiTag("action_info")} Usuário Atualizado`,
          [
            `| ${getEmojiTag("user")} <@${newUser.id}> (\`${newUser.id}\`)`,
            changes.join("\n"),
          ].join("\n"),
        );

        await sendBotLog(guild, container);
      }
    } catch (err) {
      console.error("[userUpdate] Erro ao registrar log:", err);
    }
  },
});

import { createEvent } from "#base";
import { createContainer, createSection, Separator } from "@magicyan/discord";
import { VoiceState } from "discord.js";
import { getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "voiceStateUpdate",
  event: "voiceStateUpdate",
  async run(oldState: VoiceState, newState: VoiceState) {
    if (oldState.channelId === newState.channelId) return;

    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;
    if (!guild || !member) return;

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const avatar =
        member.user.displayAvatarURL() ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      let actionTitle = "";
      let actionDetails = "";
      let color: `#${string}` = "#3b82f6";

      if (!oldState.channelId && newState.channelId) {
        // Entrou na sala
        color = "#22c55e";
        actionTitle = `## ${getEmojiTag("action_check")} Entrou em Canal de Voz`;
        actionDetails = `| ${getEmojiTag("folder")} **Canal Conectado:** <#${newState.channelId}> (\`${newState.channel?.name}\`)`;
      } else if (oldState.channelId && !newState.channelId) {
        // Saiu da sala
        color = "#ef4444";
        actionTitle = `## ${getEmojiTag("action_x")} Desconectou da Voz`;
        actionDetails = `| ${getEmojiTag("folder")} **Canal Desconectado:** <#${oldState.channelId}> (\`${oldState.channel?.name}\`)`;
      } else if (oldState.channelId && newState.channelId) {
        // Trocou de sala
        color = "#eab308";
        actionTitle = `## ${getEmojiTag("action_info")} Moveu de Canal de Voz`;
        actionDetails = [
          `| ${getEmojiTag("folder")} **Canal Anterior:** <#${oldState.channelId}> (\`${oldState.channel?.name}\`)`,
          `| ${getEmojiTag("folder_open")} **Novo Canal:** <#${newState.channelId}> (\`${newState.channel?.name}\`)`,
        ].join("\n");
      }

      const container = createContainer(
        color,
        createSection({
          content: `${actionTitle}\nMovimentação de áudio registrada para <@${member.id}>.`,
          thumbnail: avatar as any,
        }),
        Separator.Default,
        [
          `| ${getEmojiTag("user")} **Membro:** <@${member.id}> (\`${member.user.tag}\` | \`${member.id}\`)`,
          actionDetails,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
      );

      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[voiceStateUpdate] Erro ao registrar log:", err);
    }
  },
});

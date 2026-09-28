import { createEvent } from "#base";
import { createContainer, Separator } from "@magicyan/discord";
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
      const ts = Math.floor(Date.now() / 1000);
      let title = "";
      let details = "";

      if (!oldState.channelId && newState.channelId) {
        title = `## ${getEmojiTag("action_check")} Entrou na Voz`;
        details = `| ${getEmojiTag("folder")} <#${newState.channelId}>`;
      } else if (oldState.channelId && !newState.channelId) {
        title = `## ${getEmojiTag("action_x")} Saiu da Voz`;
        details = `| ${getEmojiTag("folder")} <#${oldState.channelId}>`;
      } else {
        title = `## ${getEmojiTag("action_info")} Trocou de Canal`;
        details = `| ${getEmojiTag("folder")} <#${oldState.channelId}> ${getEmojiTag("arrow_right")} <#${newState.channelId}>`;
      }

      const container = createContainer(
        !oldState.channelId ? "#22c55e" : oldState.channelId && !newState.channelId ? "#ef4444" : "#eab308",
        title,
        Separator.Default,
        [
          `| ${getEmojiTag("user")} <@${member.id}>`,
          details,
          `| ${getEmojiTag("clock")} <t:${ts}:f> (<t:${ts}:R>)`,
        ].join("\n"),
      );

      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[voiceStateUpdate] Erro ao registrar log:", err);
    }
  },
});

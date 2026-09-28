import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, StageInstance } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "stageInstanceCreate",
  event: "stageInstanceCreate",
  async run(stageInstance: StageInstance) {
    const guild = stageInstance.guild;
    if (!guild) return;
    try {
      const executor = await getAuditLogExecutor(guild, AuditLogEvent.StageInstanceCreate, stageInstance.id);
      const container = createContainer(
        constants.colors.primary,
        `## ${getEmojiTag("bell_add")} Palco Iniciado`,
        [
          `| ${getEmojiTag("folder")} <#${stageInstance.channelId}>`,
          `| ${getEmojiTag("clipboard")} \`${stageInstance.topic}\``,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[stageInstanceCreate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "stageInstanceDelete",
  event: "stageInstanceDelete",
  async run(stageInstance: StageInstance) {
    const guild = stageInstance.guild;
    if (!guild) return;
    try {
      const executor = await getAuditLogExecutor(guild, AuditLogEvent.StageInstanceDelete, stageInstance.id);
      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("bell_remove")} Palco Encerrado`,
        [
          `| ${getEmojiTag("folder")} <#${stageInstance.channelId}>`,
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[stageInstanceDelete] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "stageInstanceUpdate",
  event: "stageInstanceUpdate",
  async run(oldStageInstance: StageInstance | null, newStageInstance: StageInstance) {
    const guild = newStageInstance.guild;
    if (!guild || !oldStageInstance) return;
    try {
      const changes: string[] = [];

      if (oldStageInstance.topic !== newStageInstance.topic) {
        changes.push(`• ${getEmojiTag("clipboard")} Tópico: \`${oldStageInstance.topic}\` ➔ \`${newStageInstance.topic}\``);
      }
      if (oldStageInstance.privacyLevel !== newStageInstance.privacyLevel) {
        changes.push(`• ${getEmojiTag("shield")} Privacidade alterada`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(guild, AuditLogEvent.StageInstanceUpdate, newStageInstance.id);
      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("bell")} Palco Atualizado`,
        [
          `| ${getEmojiTag("folder")} <#${newStageInstance.channelId}>`,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[stageInstanceUpdate] Erro ao registrar log:", err);
    }
  },
});

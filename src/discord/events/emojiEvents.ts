import { createEvent } from "#base";
import { createContainer, Separator } from "@magicyan/discord";
import { AuditLogEvent, GuildEmoji } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

// 1. Emoji Criado
createEvent({
  name: "emojiCreate",
  event: "emojiCreate",
  async run(emoji: GuildEmoji) {
    try {
      const executor = await getAuditLogExecutor(
        emoji.guild,
        AuditLogEvent.EmojiCreate,
        emoji.id,
      );

      const timestamp = Math.floor(Date.now() / 1000);
      const emojiDisplay = emoji.animated
        ? `<a:${emoji.name}:${emoji.id}>`
        : `<:${emoji.name}:${emoji.id}>`;

      const container = createContainer(
        "#22c55e",
        `## ${getEmojiTag("action_check")} Emoji Adicionado`,
        Separator.Default,
        [
          `| ${getEmojiTag("apps_figma")} **Emoji:** ${emojiDisplay} \`:${emoji.name}:\` (\`${emoji.id}\`)`,
          `| ${getEmojiTag("action_info")} **Tipo:** \`${emoji.animated ? "Animado (GIF)" : "Estático (PNG)"}\``,
          `| ${getEmojiTag("user_check")} **Criado por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
      );

      await sendBotLog(emoji.guild, container);
    } catch (err) {
      console.error("[emojiCreate] Erro ao registrar log:", err);
    }
  },
});

// 2. Emoji Excluído
createEvent({
  name: "emojiDelete",
  event: "emojiDelete",
  async run(emoji: GuildEmoji) {
    try {
      const executor = await getAuditLogExecutor(
        emoji.guild,
        AuditLogEvent.EmojiDelete,
        emoji.id,
      );

      const timestamp = Math.floor(Date.now() / 1000);

      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("action_x")} Emoji Excluído`,
        Separator.Default,
        [
          `| ${getEmojiTag("apps_figma")} **Nome:** \`:${emoji.name}:\` (\`${emoji.id}\`)`,
          `| ${getEmojiTag("user_remove")} **Excluído por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
      );

      await sendBotLog(emoji.guild, container);
    } catch (err) {
      console.error("[emojiDelete] Erro ao registrar log:", err);
    }
  },
});

// 3. Emoji Renomeado
createEvent({
  name: "emojiUpdate",
  event: "emojiUpdate",
  async run(oldEmoji: GuildEmoji, newEmoji: GuildEmoji) {
    if (oldEmoji.name === newEmoji.name) return;

    try {
      const executor = await getAuditLogExecutor(
        newEmoji.guild,
        AuditLogEvent.EmojiUpdate,
        newEmoji.id,
      );

      const timestamp = Math.floor(Date.now() / 1000);
      const emojiDisplay = newEmoji.animated
        ? `<a:${newEmoji.name}:${newEmoji.id}>`
        : `<:${newEmoji.name}:${newEmoji.id}>`;

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Emoji Renomeado`,
        Separator.Default,
        [
          `| ${getEmojiTag("apps_figma")} **Emoji:** ${emojiDisplay}`,
          `| **Nome Anterior:** \`:${oldEmoji.name}:\``,
          `| **Novo Nome:** \`:${newEmoji.name}:\``,
          `| ${getEmojiTag("user_check")} **Alterado por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
      );

      await sendBotLog(newEmoji.guild, container);
    } catch (err) {
      console.error("[emojiUpdate] Erro ao registrar log:", err);
    }
  },
});

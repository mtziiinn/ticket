import { createEvent } from "#base";
import { createContainer, Separator } from "@magicyan/discord";
import {
  AuditLogEvent,
  DMChannel,
  NonThreadGuildBasedChannel,
} from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "channelUpdate",
  event: "channelUpdate",
  async run(
    oldChannel: DMChannel | NonThreadGuildBasedChannel,
    newChannel: DMChannel | NonThreadGuildBasedChannel,
  ) {
    if (oldChannel.isDMBased() || newChannel.isDMBased() || !newChannel.guild) {
      return;
    }

    try {
      const changes: string[] = [];

      // 1. Mudança de Nome
      if (oldChannel.name !== newChannel.name) {
        changes.push(
          `• **Nome:** \`#${oldChannel.name}\` ➔ \`#${newChannel.name}\``,
        );
      }

      // 2. Mudança de Categoria Pai
      if (oldChannel.parentId !== newChannel.parentId) {
        const oldParent = oldChannel.parent?.name || "Nenhuma";
        const newParent = newChannel.parent?.name || "Nenhuma";
        changes.push(
          `• **Categoria:** \`${oldParent}\` ➔ \`${newParent}\``,
        );
      }

      // 3. Mudança de Tópico (para canais de texto)
      const oldTopic = (oldChannel as any).topic || "*Nenhum*";
      const newTopic = (newChannel as any).topic || "*Nenhum*";
      if (oldTopic !== newTopic) {
        changes.push(
          `• **Tópico Alterado:**\n  - Antes: \`${oldTopic.slice(0, 100)}\`\n  - Depois: \`${newTopic.slice(0, 100)}\``,
        );
      }

      // 4. Mudança de NSFW
      if ((oldChannel as any).nsfw !== (newChannel as any).nsfw) {
        changes.push(
          `• **NSFW:** \`${(oldChannel as any).nsfw ? "Ativado" : "Desativado"}\` ➔ \`${(newChannel as any).nsfw ? "Ativado" : "Desativado"}\``,
        );
      }

      // 5. Modo Lento (Slowmode / rateLimitPerUser)
      const oldRate = (oldChannel as any).rateLimitPerUser ?? 0;
      const newRate = (newChannel as any).rateLimitPerUser ?? 0;
      if (oldRate !== newRate) {
        changes.push(
          `• **Modo Lento:** \`${oldRate}s\` ➔ \`${newRate}s\``,
        );
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newChannel.guild,
        AuditLogEvent.ChannelUpdate,
        newChannel.id,
      );

      const timestamp = Math.floor(Date.now() / 1000);

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Canal Atualizado`,
        Separator.Default,
        [
          `| ${getEmojiTag("folder")} **Canal:** <#${newChannel.id}> (\`${newChannel.name}\`)`,
          `| ${getEmojiTag("user_check")} **Alterado por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
        Separator.Default,
        `### Alterações Detectadas:\n${changes.join("\n")}`,
      );

      await sendBotLog(newChannel.guild, container);
    } catch (err) {
      console.error("[channelUpdate] Erro ao registrar log:", err);
    }
  },
});

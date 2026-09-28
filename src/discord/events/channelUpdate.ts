import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, DMChannel, NonThreadGuildBasedChannel } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

const VIDEO_QUALITY_LABELS: Record<number, string> = { 1: "Automático", 2: "720p" };

function diffPermissionOverwrites(oldChannel: any, newChannel: any): number {
  const oldMap = oldChannel.permissionOverwrites?.cache as Map<string, any> | undefined;
  const newMap = newChannel.permissionOverwrites?.cache as Map<string, any> | undefined;
  if (!oldMap || !newMap) return 0;

  let diffCount = 0;
  const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
  for (const id of ids) {
    const before = oldMap.get(id);
    const after = newMap.get(id);
    if (!before || !after) {
      diffCount++;
      continue;
    }
    if (before.allow.bitfield !== after.allow.bitfield || before.deny.bitfield !== after.deny.bitfield) {
      diffCount++;
    }
  }
  return diffCount;
}

createEvent({
  name: "channelUpdate",
  event: "channelUpdate",
  async run(
    oldChannel: DMChannel | NonThreadGuildBasedChannel,
    newChannel: DMChannel | NonThreadGuildBasedChannel,
  ) {
    if (oldChannel.isDMBased() || newChannel.isDMBased() || !newChannel.guild) return;

    try {
      const changes: string[] = [];
      const oldAny = oldChannel as any;
      const newAny = newChannel as any;

      if (oldChannel.name !== newChannel.name) {
        changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldChannel.name}\` ➔ \`${newChannel.name}\``);
      }

      if (oldChannel.parentId !== newChannel.parentId) {
        const oldParent = oldChannel.parent?.name || "Nenhuma";
        const newParent = newChannel.parent?.name || "Nenhuma";
        changes.push(`• ${getEmojiTag("folder_open")} Categoria: \`${oldParent}\` ➔ \`${newParent}\``);
      }

      const oldTopic = oldAny.topic || "";
      const newTopic = newAny.topic || "";
      if (oldTopic !== newTopic) {
        changes.push(`• ${getEmojiTag("clipboard")} Tópico alterado`);
      }

      if (oldChannel.type !== newChannel.type) {
        changes.push(`• ${getEmojiTag("action_info")} Tipo de canal alterado`);
      }

      if (typeof oldAny.nsfw === "boolean" && oldAny.nsfw !== newAny.nsfw) {
        changes.push(`• ${getEmojiTag("action_warning")} NSFW: \`${oldAny.nsfw ? "Sim" : "Não"}\` ➔ \`${newAny.nsfw ? "Sim" : "Não"}\``);
      }

      if (typeof oldAny.bitrate === "number" && oldAny.bitrate !== newAny.bitrate) {
        changes.push(`• ${getEmojiTag("action_info")} Bitrate: \`${oldAny.bitrate}\` ➔ \`${newAny.bitrate}\``);
      }

      if (typeof oldAny.userLimit === "number" && oldAny.userLimit !== newAny.userLimit) {
        changes.push(`• ${getEmojiTag("user_users")} Limite de usuários: \`${oldAny.userLimit || "sem limite"}\` ➔ \`${newAny.userLimit || "sem limite"}\``);
      }

      if (typeof oldAny.rateLimitPerUser === "number" && oldAny.rateLimitPerUser !== newAny.rateLimitPerUser) {
        changes.push(`• ${getEmojiTag("clock")} Slowmode: \`${oldAny.rateLimitPerUser}s\` ➔ \`${newAny.rateLimitPerUser}s\``);
      }

      if ("rtcRegion" in oldAny && oldAny.rtcRegion !== newAny.rtcRegion) {
        changes.push(`• ${getEmojiTag("action_info")} Região de voz: \`${oldAny.rtcRegion || "Automático"}\` ➔ \`${newAny.rtcRegion || "Automático"}\``);
      }

      if ("videoQualityMode" in oldAny && oldAny.videoQualityMode !== newAny.videoQualityMode) {
        changes.push(`• ${getEmojiTag("action_info")} Qualidade de vídeo: \`${VIDEO_QUALITY_LABELS[oldAny.videoQualityMode] || "Automático"}\` ➔ \`${VIDEO_QUALITY_LABELS[newAny.videoQualityMode] || "Automático"}\``);
      }

      if ("defaultAutoArchiveDuration" in oldAny && oldAny.defaultAutoArchiveDuration !== newAny.defaultAutoArchiveDuration) {
        changes.push(`• ${getEmojiTag("clock")} Arquivamento padrão de threads: \`${oldAny.defaultAutoArchiveDuration}min\` ➔ \`${newAny.defaultAutoArchiveDuration}min\``);
      }

      if ("defaultThreadRateLimitPerUser" in oldAny && oldAny.defaultThreadRateLimitPerUser !== newAny.defaultThreadRateLimitPerUser) {
        changes.push(`• ${getEmojiTag("clock")} Slowmode padrão de threads: \`${oldAny.defaultThreadRateLimitPerUser ?? 0}s\` ➔ \`${newAny.defaultThreadRateLimitPerUser ?? 0}s\``);
      }

      if ("defaultReactionEmoji" in oldAny) {
        const oldEmoji = oldAny.defaultReactionEmoji?.name || null;
        const newEmoji = newAny.defaultReactionEmoji?.name || null;
        if (oldEmoji !== newEmoji) {
          changes.push(`• ${getEmojiTag("action_info")} Emoji de reação padrão: \`${oldEmoji || "nenhum"}\` ➔ \`${newEmoji || "nenhum"}\``);
        }
      }

      if ("defaultSortOrder" in oldAny && oldAny.defaultSortOrder !== newAny.defaultSortOrder) {
        changes.push(`• ${getEmojiTag("action_info")} Ordenação padrão do fórum alterada`);
      }

      if ("defaultForumLayout" in oldAny && oldAny.defaultForumLayout !== newAny.defaultForumLayout) {
        changes.push(`• ${getEmojiTag("action_info")} Layout do fórum alterado`);
      }

      if (Array.isArray(oldAny.availableTags)) {
        const oldTags = oldAny.availableTags.map((t: any) => t.name).sort().join(",");
        const newTags = (newAny.availableTags || []).map((t: any) => t.name).sort().join(",");
        if (oldTags !== newTags) {
          changes.push(`• ${getEmojiTag("clipboard")} Tags do fórum alteradas`);
        }
      }

      if ("status" in oldAny && oldAny.status !== newAny.status) {
        changes.push(`• ${getEmojiTag("action_info")} Status de voz: \`${oldAny.status || "nenhum"}\` ➔ \`${newAny.status || "nenhum"}\``);
      }

      const overwriteDiffs = diffPermissionOverwrites(oldChannel, newChannel);
      if (overwriteDiffs > 0) {
        changes.push(`• ${getEmojiTag("lock")} Permissões: \`${overwriteDiffs}\` alvo(s) modificado(s)`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newChannel.guild,
        AuditLogEvent.ChannelUpdate,
        newChannel.id,
      );

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Canal Atualizado`,
        [
          `| ${getEmojiTag("folder")} <#${newChannel.id}>`,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(newChannel.guild, container);
    } catch (err) {
      console.error("[channelUpdate] Erro ao registrar log:", err);
    }
  },
});

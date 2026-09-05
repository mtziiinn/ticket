import { Client } from "discord.js";
import { cleanupGuildCache } from "#database";
import { cleanupCooldowns } from "../discord/responders/ticket/submit.js";

export interface CacheCleanupResult {
  heapUsedBeforeMB: number;
  heapUsedAfterMB: number;
  heapDiffMB: number;
  rssBeforeMB: number;
  rssAfterMB: number;
  rssDiffMB: number;
  messagesSwept: number;
  usersSwept: number;
  membersSwept: number;
}

export function clearBotCache(client: Client): CacheCleanupResult {
  const memBefore = process.memoryUsage();

  let messagesSwept = 0;
  let usersSwept = 0;
  let membersSwept = 0;

  // 1. Limpar mensagens de todos os canais de texto em cache
  for (const channel of client.channels.cache.values()) {
    if (channel.isTextBased() && "messages" in channel) {
      messagesSwept += (channel as any).messages.cache.size;
      (channel as any).messages.cache.clear();
    }
  }

  // 2. Limpar membros das guildas mantendo apenas o próprio bot
  const botId = client.user?.id;
  for (const guild of client.guilds.cache.values()) {
    for (const [memberId] of guild.members.cache.entries()) {
      if (memberId !== botId) {
        guild.members.cache.delete(memberId);
        membersSwept++;
      }
    }
  }

  // 3. Limpar usuários globais em cache mantendo apenas o bot
  for (const [userId] of client.users.cache.entries()) {
    if (userId !== botId) {
      client.users.cache.delete(userId);
      usersSwept++;
    }
  }

  // 4. Limpar caches internos expirados (Guild TTL e Cooldowns)
  cleanupGuildCache();
  cleanupCooldowns();

  // 5. Acionar Garbage Collection do V8 se exposto
  const globalAny = global as any;
  if (typeof globalAny.gc === "function") {
    try {
      globalAny.gc();
    } catch {
      /* ignore */
    }
  }

  const memAfter = process.memoryUsage();

  const toMB = (bytes: number) => Number((bytes / 1024 / 1024).toFixed(2));

  const heapUsedBeforeMB = toMB(memBefore.heapUsed);
  const heapUsedAfterMB = toMB(memAfter.heapUsed);
  const heapDiffMB = Number((heapUsedBeforeMB - heapUsedAfterMB).toFixed(2));

  const rssBeforeMB = toMB(memBefore.rss);
  const rssAfterMB = toMB(memAfter.rss);
  const rssDiffMB = Number((rssBeforeMB - rssAfterMB).toFixed(2));

  return {
    heapUsedBeforeMB,
    heapUsedAfterMB,
    heapDiffMB: heapDiffMB > 0 ? heapDiffMB : 0,
    rssBeforeMB,
    rssAfterMB,
    rssDiffMB: rssDiffMB > 0 ? rssDiffMB : 0,
    messagesSwept,
    usersSwept,
    membersSwept,
  };
}

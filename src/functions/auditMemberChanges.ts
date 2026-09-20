import { AuditLogEvent, Guild } from "discord.js";

export interface MemberAuditChanges {
  added: { id: string; name: string }[];
  removed: { id: string; name: string }[];
  nick?: { before: string | null; after: string | null };
  executor: { id: string } | null;
}

// Guarda só ids de entradas já usadas (teto fixo) para não logar a mesma
// entrada do audit log duas vezes.
const usedEntryIds = new Set<string>();
const MAX_USED_ENTRIES = 100;

function markUsed(id: string): void {
  usedEntryIds.add(id);
  if (usedEntryIds.size > MAX_USED_ENTRIES) {
    const oldest = usedEntryIds.values().next().value;
    if (oldest !== undefined) usedEntryIds.delete(oldest);
  }
}

function newestEntry(logs: any, memberId: string, now: number, maxAgeMs: number, wantsKey?: string): any | null {
  if (!logs?.entries) return null;
  let best: any = null;
  for (const entry of logs.entries.values()) {
    if (entry.targetId !== memberId) continue;
    if (now - entry.createdTimestamp >= maxAgeMs) continue;
    if (usedEntryIds.has(entry.id)) continue;
    if (wantsKey && !entry.changes?.some((c: any) => c.key === wantsKey)) continue;
    if (!best || entry.createdTimestamp > best.createdTimestamp) best = entry;
  }
  return best;
}

// Usado quando o membro antigo não está no cache (diff indisponível): remonta
// o que mudou (cargos e apelido) a partir do audit log, sem guardar nada em cache.
export async function getMemberChangesFromAuditLog(
  guild: Guild,
  memberId: string,
  { maxAgeMs = 15_000, waitMs = 1_200 }: { maxAgeMs?: number; waitMs?: number } = {},
): Promise<MemberAuditChanges | null> {
  try {
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

    const [roleLogs, updateLogs] = await Promise.all([
      guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 10 }).catch(() => null),
      guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 10 }).catch(() => null),
    ]);

    const now = Date.now();
    const result: MemberAuditChanges = { added: [], removed: [], executor: null };
    let found = false;

    const roleEntry = newestEntry(roleLogs, memberId, now, maxAgeMs);
    if (roleEntry) {
      for (const change of roleEntry.changes ?? []) {
        const roles = Array.isArray(change.new) ? change.new : [];
        for (const r of roles) {
          const item = { id: String(r.id), name: String(r.name ?? r.id) };
          if (change.key === "$add") result.added.push(item);
          else if (change.key === "$remove") result.removed.push(item);
        }
      }
      markUsed(roleEntry.id);
      result.executor = roleEntry.executor ?? null;
      found = result.added.length > 0 || result.removed.length > 0;
    }

    const nickEntry = newestEntry(updateLogs, memberId, now, maxAgeMs, "nick");
    if (nickEntry) {
      const change = nickEntry.changes.find((c: any) => c.key === "nick");
      result.nick = { before: change?.old ?? null, after: change?.new ?? null };
      markUsed(nickEntry.id);
      result.executor ??= nickEntry.executor ?? null;
      found = true;
    }

    return found ? result : null;
  } catch {
    return null;
  }
}

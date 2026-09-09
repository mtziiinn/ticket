import { headers } from "next/headers";

/**
 * Um "tenant" = um cliente do bot. Vários clientes compartilham o mesmo cluster
 * MongoDB e o mesmo deploy do web na Vercel; o que muda é o banco (DATABASE_NAME
 * de cada cópia do bot) e as credenciais que o web usa para agir como aquele bot.
 *
 * A resolução é feita pelo host da requisição: cada cópia do bot aponta seu
 * WEB_URL para um domínio diferente, e a env var TENANTS mapeia domínio -> tenant.
 */
export interface Tenant {
  dbName: string;
  botToken?: string;
  apiKey?: string;
  mpAccessToken?: string;
  /** Emojis customizados da aplicação daquele bot: nome -> id do emoji. */
  emojis?: Record<string, string>;
}

/**
 * Emojis embutidos por domínio (fallback quando o TENANTS não traz `emojis`).
 * São emojis da APLICAÇÃO de cada bot — só renderizam no bot dono deles, por
 * isso ficam por tenant. Domínios sem entrada aqui usam o unicode de fallback.
 */
const BUILTIN_TENANT_EMOJIS: Record<string, Record<string, string>> = {
  "ticket-dusk.vercel.app": {
    action_check: "1547357156079050935",
    action_warning: "1547357165423956081",
    action_info: "1547357158126002229",
    file_add: "1547357362527015042",
    file_files: "1547357367035887778",
    clipboard: "1547357300073697300",
    cloud_check: "1547357321422835744",
    clock_check: "1547357333837979689",
    user_check: "1547357523881754665",
    database: "1547357311717220442",
  },
};

/** `<:nome:id>` se o tenant tiver o emoji custom; senão o fallback unicode. */
export function emojiTag(tenant: Tenant, name: string, fallback: string): string {
  const id = tenant.emojis?.[name];
  return id ? `<:${name}:${id}>` : fallback;
}

function envFallback(): Tenant {
  return {
    dbName: process.env.DATABASE_NAME || "database",
    botToken: process.env.BOT_TOKEN,
    apiKey: process.env.API_KEY,
    mpAccessToken: process.env.MP_ACCESS_TOKEN,
  };
}

function parseTenants(): Record<string, Partial<Tenant>> {
  let raw = process.env.TENANTS;
  if (!raw) return {};
  raw = raw.trim();
  // Tolera um par extra de aspas caso tenha sido colado com aspas no dashboard.
  if (
    raw.length >= 2 &&
    ((raw[0] === '"' && raw[raw.length - 1] === '"') ||
      (raw[0] === "'" && raw[raw.length - 1] === "'"))
  ) {
    raw = raw.slice(1, -1);
  }
  try {
    return JSON.parse(raw) as Record<string, Partial<Tenant>>;
  } catch {
    console.error("[tenant] TENANTS inválido (JSON) — usando fallback do env");
    return {};
  }
}

function pickByHost(host: string | null | undefined): Tenant {
  const fallback = envFallback();
  if (!host) return fallback;

  const full = host.toLowerCase().trim();
  const noPort = full.split(":")[0];
  const map = parseTenants();
  const match = map[full] || map[noPort];

  if (!match) {
    console.log(
      `[tenant] host "${noPort}" sem entrada em TENANTS — usando fallback (db=${fallback.dbName})`,
    );
    return fallback;
  }

  const resolved: Tenant = {
    dbName: match.dbName || fallback.dbName,
    botToken: match.botToken ?? fallback.botToken,
    apiKey: match.apiKey ?? fallback.apiKey,
    mpAccessToken: match.mpAccessToken ?? fallback.mpAccessToken,
    emojis:
      match.emojis ??
      BUILTIN_TENANT_EMOJIS[full] ??
      BUILTIN_TENANT_EMOJIS[noPort],
  };
  console.log(`[tenant] host "${noPort}" -> db=${resolved.dbName}`);
  return resolved;
}

function hostFrom(get: (k: string) => string | null): string | null {
  // Em proxies/Vercel o host externo pode vir em x-forwarded-host.
  return get("x-forwarded-host") || get("host");
}

/** Para route handlers (têm acesso ao Request). */
export function resolveTenant(request: { headers: Headers }): Tenant {
  return pickByHost(hostFrom((k) => request.headers.get(k)));
}

/** Para server components / páginas. */
export async function resolveTenantFromHeaders(): Promise<Tenant> {
  const h = await headers();
  return pickByHost(hostFrom((k) => h.get(k)));
}

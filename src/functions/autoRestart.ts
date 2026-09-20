import { readFileSync } from "node:fs";
import { env } from "#env";
import { log } from "./logger.js";

const API_BASE = "https://api.discloud.app/v2";
const DEFAULT_RESTART_MINUTES = 6 * 60;
const REQUEST_TIMEOUT_MS = 60_000;

function readFileValue(file: string, key: string): string | undefined {
  try {
    const lines = readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/);
    for (const line of lines) {
      const i = line.indexOf("=");
      if (i < 0 || line.slice(0, i).trim() !== key) continue;
      const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (value) return value;
    }
  } catch {
    /* arquivo ausente: cai no valor do ambiente */
  }
  return undefined;
}

async function restartSelf(appId: string, token: string): Promise<void> {
  try {
    log.info("AutoRestart", `Reiniciando o app ${appId} via API da Discloud...`);
    const res = await fetch(`${API_BASE}/app/${appId}/restart`, {
      method: "PUT",
      headers: { "api-token": token },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      log.warn("AutoRestart", `Discloud recusou o restart (status ${res.status}).`);
    }
  } catch (err: any) {
    log.warn("AutoRestart", `Falha ao chamar a API da Discloud: ${err?.message || err}`);
  }
}

// O restart derruba o processo, então o timer recomeça a cada boot.
export function startAutoRestart(): void {
  // A Discloud pode injetar variáveis no ambiente que o --env-file não
  // sobrescreve (ex.: DISCLOUD_APP_ID de outro app). O ID vem do discloud.config,
  // que é a identidade do próprio app, e o token do .env.
  const appId = readFileValue("discloud.config", "ID") ?? env.DISCLOUD_APP_ID;
  const token = readFileValue(".env", "DISCLOUD_TOKEN") ?? env.DISCLOUD_TOKEN;

  if (!token || !appId) {
    log.warn("AutoRestart", "Token ou ID do app ausentes — reinício automático desativado.");
    return;
  }

  if (env.DISCLOUD_APP_ID && env.DISCLOUD_APP_ID !== appId) {
    log.warn(
      "AutoRestart",
      `DISCLOUD_APP_ID do ambiente (${env.DISCLOUD_APP_ID}) difere do ID deste app (${appId}); usando o do discloud.config.`,
    );
  }

  const minutes = Number(process.env.AUTO_RESTART_MINUTES);
  const intervalMinutes = Number.isFinite(minutes) && minutes >= 1 ? minutes : DEFAULT_RESTART_MINUTES;

  setInterval(() => void restartSelf(appId, token), intervalMinutes * 60 * 1000);
  log.info("AutoRestart", `Reinício automático ativado (a cada ${intervalMinutes} min) para o app ${appId}.`);
}

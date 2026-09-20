import { env } from "#env";
import { log } from "./logger.js";
const API_BASE = "https://api.discloud.app/v2";
const RESTART_INTERVAL_MS = 6 * 60 * 60 * 1000;
async function restartSelf() {
    try {
        const res = await fetch(`${API_BASE}/app/${env.DISCLOUD_APP_ID}/restart`, {
            method: "PUT",
            headers: { "api-token": env.DISCLOUD_TOKEN },
        });
        if (!res.ok) {
            log.warn("AutoRestart", `Discloud recusou o restart (status ${res.status}).`);
        }
    }
    catch (err) {
        log.warn("AutoRestart", `Falha ao chamar a API da Discloud: ${err?.message || err}`);
    }
}
// O restart derruba o processo, então o timer recomeça a cada boot (ciclo de 6h).
export function startAutoRestart() {
    if (!env.DISCLOUD_TOKEN || !env.DISCLOUD_APP_ID) {
        log.warn("AutoRestart", "DISCLOUD_TOKEN/DISCLOUD_APP_ID ausentes — reinício automático desativado.");
        return;
    }
    setInterval(restartSelf, RESTART_INTERVAL_MS);
    log.info("AutoRestart", "Reinício automático ativado (a cada 6 horas).");
}

// Aplica os valores de brand.config.json no discloud.config.
// Uso: node scripts/apply-brand.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const brand = JSON.parse(readFileSync(join(root, "brand.config.json"), "utf8"));
const configPath = join(root, "discloud.config");
let config = readFileSync(configPath, "utf8");

const slug = brand.brandName
  .toLowerCase()
  .normalize("NFD")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

function setLine(key, value) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(config)) {
    config = config.replace(re, `${key}=${value}`);
  } else {
    config += `\n${key}=${value}`;
  }
}

setLine("NAME", slug || "bot");
setLine("AVATAR", brand.avatarUrl);

writeFileSync(configPath, config.trimEnd() + "\n");

console.log(`[apply-brand] discloud.config atualizado:`);
console.log(`  NAME=${slug || "bot"}`);
console.log(`  AVATAR=${brand.avatarUrl}`);
console.log("");
console.log("Lembretes:");
console.log("  1. Zere a linha ID= do discloud.config para a Discloud criar um app novo");
console.log("     (a primeira publicacao e com `discloud app upload`, depois `discloud app commit`).");
console.log("  2. Confira o .env: BOT_TOKEN, MONGO_URI, DATABASE_NAME, WEB_URL.");
console.log("  3. Convide o bot novo para o servidor que hospeda os emojis customizados.");

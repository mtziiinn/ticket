export function getEmojiId(name: keyof typeof emojis.static): string {
  const url = (emojis.static as any)[name];
  if (!url) return "";
  const match = url.match(/\/(\d+)\.png/);
  return match ? match[1] : "";
}

export function getEmojiTag(name: keyof typeof emojis.static): string {
  const id = getEmojiId(name);
  return id ? `<:${name}:${id}>` : "";
}

export function formatEmoji(emojiRaw: string | null | undefined): any {
  if (!emojiRaw) return undefined;
  if (/^\d+$/.test(emojiRaw)) {
    return { id: emojiRaw };
  }
  // Tag completa (ex: <:nome:id> ou <a:nome:id>), como fica salvo quando o
  // usuário cola o emoji direto no modal — .setEmoji() do discord.js não
  // entende essa string, só um objeto {id, name, animated} ou um emoji
  // unicode puro. Sem isso, categorias salvas com a tag completa mostravam
  // um ícone genérico/quebrado no menu de abertura de ticket.
  const tagMatch = emojiRaw.match(/^<(a)?:(\w+):(\d+)>$/);
  if (tagMatch) {
    return { animated: Boolean(tagMatch[1]), name: tagMatch[2], id: tagMatch[3] };
  }
  return emojiRaw;
}

export function getCleanAvatarURL(user: any): string {
  try {
    if (!user) return emojis.static.prism || emojis.static.other_ticket;
    if (typeof user.displayAvatarURL === "function") {
      return user.displayAvatarURL({ extension: "png", forceStatic: true });
    }
    if (typeof user.avatarURL === "function") {
      return (
        user.avatarURL({ extension: "png", forceStatic: true }) ||
        user.defaultAvatarURL ||
        emojis.static.prism ||
        emojis.static.other_ticket
      );
    }
    if (typeof user === "string" && user.startsWith("http")) {
      return user;
    }
    return emojis.static.prism || emojis.static.other_ticket;
  } catch {
    return emojis.static.prism || emojis.static.other_ticket;
  }
}

export async function safeSendDM(
  target: any,
  options: any,
  contextLabel: string = "DM",
): Promise<boolean> {
  if (!target || typeof target.send !== "function") return false;
  try {
    await target.send(options);
    return true;
  } catch (err: any) {
    if (err?.code === 50278 || err?.code === 50007 || err?.code === 50001) {
      console.warn(
        `[${contextLabel}] Mensagem não pôde ser enviada para a DM do usuário (DMs desativadas ou sem servidor mútuo - código ${err.code}).`,
      );
    } else {
      console.error(`[${contextLabel}] Erro ao enviar DM:`, err);
    }
    return false;
  }
}

export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Normaliza a chave PIX conforme o TIPO dela.
 *
 * Antes isso era um `.replace(/-/g, "")` cego em cima de qualquer chave, o
 * que gerava um copia e cola que o banco recusa como invalido em dois casos:
 * chave aleatoria (os hifens do UUID fazem parte da chave) e e-mail com
 * hifen no endereco. Cada tipo tem sua regra propria:
 *
 * - e-mail: vai como esta (so minusculo, sem espacos ao redor);
 * - aleatoria (EVP/UUID): mantem os hifens;
 * - telefone: so digitos, sempre com +55 na frente;
 * - CPF/CNPJ: so digitos.
 */
export function normalizePixKey(rawKey: string): string {
  const key = rawKey.trim().replace(/\s+/g, " ");

  if (key.includes("@")) {
    return key.replace(/\s+/g, "").toLowerCase();
  }

  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const compact = key.replace(/\s+/g, "");
  if (uuid.test(compact)) {
    return compact.toLowerCase();
  }

  const digits = compact.replace(/\D/g, "");

  // Telefone: so conta como telefone quando veio explicito (+55...) ou quando
  // o tamanho so fecha como telefone. 11 digitos secos ficam como CPF, que e
  // o caso muito mais comum aqui (celular como chave PIX exige o +55).
  const isPhone =
    compact.startsWith("+") ||
    (digits.length === 13 && digits.startsWith("55")) ||
    (digits.length === 12 && digits.startsWith("55"));
  if (isPhone) {
    return `+${digits}`;
  }

  return digits || compact;
}

export function generatePixPayload(
  key: string,
  name: string = "TICKETS",
  city: string = "SAO PAULO",
  amount?: number,
) {
  const cleanKey = normalizePixKey(key);

  // Merchant Account Information - Pix
  const gui = "br.gov.bcb.pix";
  const keyField = `01${cleanKey.length.toString().padStart(2, "0")}${cleanKey}`;
  const merchantAccount = `00${gui.length.toString().padStart(2, "0")}${gui}${keyField}`;

  // Additional Data Field Template (TXID) - Obrigatório em muitos bancos
  const txid = "***"; // TXID padrão
  const additionalData = `05${txid.length.toString().padStart(2, "0")}${txid}`;

  const sanitizedName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .substring(0, 25);

  let payload = "000201"; // Payload Format Indicator
  payload += `26${merchantAccount.length.toString().padStart(2, "0")}${merchantAccount}`;
  payload += "52040000"; // Merchant Category Code
  payload += "5303986"; // Transaction Currency (986 = Real)
  if (amount && amount > 0) {
    const formattedAmount = amount.toFixed(2);
    payload += `54${formattedAmount.length.toString().padStart(2, "0")}${formattedAmount}`;
  }
  payload += "5802BR"; // Country Code
  payload += `59${sanitizedName.length.toString().padStart(2, "0")}${sanitizedName}`; // Merchant Name
  payload += `60${city.length.toString().padStart(2, "0")}${city}`; // Merchant City
  payload += `62${additionalData.length.toString().padStart(2, "0")}${additionalData}`; // Additional Data
  payload += "6304"; // CRC16

  return payload + crc16(payload);
}

export * from "./cacheCleaner.js";
export * from "./mercadopago.js";
export * from "./botLogs.js";
export * from "./announcements.js";
export * from "./panelJson.js";
export * from "./vault.js";
export * from "./errorWebhook.js";
export * from "./logger.js";
export * from "./monthlyBilling.js";


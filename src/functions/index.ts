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
  return emojiRaw;
}

export function getCleanAvatarURL(user: any): string {
  try {
    if (!user) return emojis.static.other_ticket;
    if (typeof user.displayAvatarURL === "function") {
      return user.displayAvatarURL({ extension: "png", forceStatic: true });
    }
    if (typeof user.avatarURL === "function") {
      return (
        user.avatarURL({ extension: "png", forceStatic: true }) ||
        user.defaultAvatarURL ||
        emojis.static.other_ticket
      );
    }
    if (typeof user === "string" && user.startsWith("http")) {
      return user;
    }
    return emojis.static.other_ticket;
  } catch {
    return emojis.static.other_ticket;
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

export function generatePixPayload(
  key: string,
  name: string = "MTS TICKETS",
  city: string = "SAO PAULO",
) {
  // Limpar a chave (remover espaços, traços, etc)
  const cleanKey = key
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "");

  // Merchant Account Information - Pix
  const gui = "br.gov.bcb.pix";
  const keyField = `01${cleanKey.length.toString().padStart(2, "0")}${cleanKey}`;
  const merchantAccount = `00${gui.length.toString().padStart(2, "0")}${gui}${keyField}`;

  // Additional Data Field Template (TXID) - Obrigatório em muitos bancos
  const txid = "***"; // TXID padrão
  const additionalData = `05${txid.length.toString().padStart(2, "0")}${txid}`;

  let payload = "000201"; // Payload Format Indicator
  payload += `26${merchantAccount.length.toString().padStart(2, "0")}${merchantAccount}`;
  payload += "52040000"; // Merchant Category Code
  payload += "5303986"; // Transaction Currency (986 = Real)
  payload += "5802BR"; // Country Code
  payload += `59${name.length.toString().padStart(2, "0")}${name}`; // Merchant Name
  payload += `60${city.length.toString().padStart(2, "0")}${city}`; // Merchant City
  payload += `62${additionalData.length.toString().padStart(2, "0")}${additionalData}`; // Additional Data
  payload += "6304"; // CRC16

  return payload + crc16(payload);
}

export * from "./cacheCleaner.js";
export * from "./mercadopago.js";
export * from "./botLogs.js";

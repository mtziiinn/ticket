export function formatEmoji(emojiRaw: string | null | undefined): any {
  if (!emojiRaw) return undefined;
  if (/^\d+$/.test(emojiRaw)) {
    return { id: emojiRaw };
  }
  return emojiRaw;
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

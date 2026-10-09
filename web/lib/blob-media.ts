import { put } from "@vercel/blob";
import { getDatabase } from "@/lib/mongodb";
import type { Transcript, TranscriptComponent, TranscriptEmbed, TranscriptMessage } from "@/lib/types";

/**
 * Verifica se a URL é um anexo do Discord que expira após 24h.
 * Emojis e avatares não caem aqui (não expiram).
 */
export function isDiscordAttachmentUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes("cdn.discordapp.com/attachments/") ||
    url.includes("media.discordapp.net/attachments/")
  );
}

/**
 * Renova URLs de anexos expiradas do Discord usando o endpoint oficial da API Discord.
 * Suporta lotes de até 50 URLs por chamada.
 */
export async function refreshDiscordUrls(
  botToken: string,
  urls: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!botToken || urls.length === 0) return map;

  const unique = Array.from(new Set(urls.filter(Boolean)));
  const batchSize = 50;

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    try {
      const res = await fetch("https://discord.com/api/v10/attachments/refresh-urls", {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ attachment_urls: batch }),
      });

      if (!res.ok) {
        console.warn(`[Discord Refresh] Falha ao renovar lote (${res.status}): ${await res.text().catch(() => "")}`);
        continue;
      }

      const data = (await res.json()) as {
        refreshed_urls?: Array<{ original: string; refreshed: string }>;
      };

      if (Array.isArray(data.refreshed_urls)) {
        for (const item of data.refreshed_urls) {
          if (item.original && item.refreshed) {
            map.set(item.original, item.refreshed);
          }
        }
      }
    } catch (err) {
      console.error("[Discord Refresh] Erro ao chamar refresh-urls:", err);
    }
  }

  return map;
}

/**
 * Faz download de uma mídia e salva no Vercel Blob permanentemente.
 */
export async function uploadUrlToVercelBlob(
  sourceUrl: string,
  filename: string,
  folder: string = "transcripts",
): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.warn("[Vercel Blob] BLOB_READ_WRITE_TOKEN não configurada no ambiente.");
    return null;
  }

  try {
    const res = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Ticket-Transcript-Storage/1.0",
      },
    });

    if (!res.ok) {
      console.warn(`[Vercel Blob] Falha ao baixar ${sourceUrl}: HTTP ${res.status}`);
      return null;
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await res.arrayBuffer();

    // Limite de segurança: 50MB
    if (arrayBuffer.byteLength > 50 * 1024 * 1024) {
      console.warn(`[Vercel Blob] Arquivo ${filename} excede 50MB, ignorando upload.`);
      return null;
    }

    const cleanFilename = (filename || "arquivo.png")
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "_");
    const pathname = `${folder}/${cleanFilename}`;

    const blob = await put(pathname, Buffer.from(arrayBuffer), {
      access: "public",
      token,
      contentType,
      addRandomSuffix: true,
    });

    return blob.url;
  } catch (err) {
    console.error(`[Vercel Blob] Erro no upload de ${filename}:`, err);
    return null;
  }
}

function collectFromComponents(components: TranscriptComponent[] | undefined, list: string[]) {
  if (!components || !Array.isArray(components)) return;
  for (const c of components) {
    if (!c) continue;
    if (c.type === "thumbnail" && isDiscordAttachmentUrl(c.url)) {
      list.push(c.url);
    } else if (c.type === "file" && isDiscordAttachmentUrl(c.url)) {
      list.push(c.url);
    } else if (c.type === "gallery" && Array.isArray(c.items)) {
      for (const item of c.items) {
        if (isDiscordAttachmentUrl(item.url)) list.push(item.url);
      }
    }
    if ("components" in c && Array.isArray(c.components)) {
      collectFromComponents(c.components, list);
    }
    if ("accessory" in c && c.accessory) {
      collectFromComponents([c.accessory], list);
    }
  }
}

function updateComponentsUrls(
  components: TranscriptComponent[] | undefined,
  mapping: Map<string, string>,
): boolean {
  if (!components || !Array.isArray(components)) return false;
  let changed = false;

  for (const c of components) {
    if (!c) continue;
    if (c.type === "thumbnail" && c.url && mapping.has(c.url)) {
      c.url = mapping.get(c.url)!;
      changed = true;
    } else if (c.type === "file" && c.url && mapping.has(c.url)) {
      c.url = mapping.get(c.url)!;
      changed = true;
    } else if (c.type === "gallery" && Array.isArray(c.items)) {
      for (const item of c.items) {
        if (item.url && mapping.has(item.url)) {
          item.url = mapping.get(item.url)!;
          changed = true;
        }
      }
    }
    if ("components" in c && Array.isArray(c.components)) {
      if (updateComponentsUrls(c.components, mapping)) changed = true;
    }
    if ("accessory" in c && c.accessory) {
      if (updateComponentsUrls([c.accessory], mapping)) changed = true;
    }
  }

  return changed;
}

/**
 * Analisa todas as mensagens do transcript, faz upload dos anexos efêmeros
 * do Discord para o Vercel Blob e atualiza o MongoDB com as URLs permanentes.
 */
export async function syncTranscriptMedia(
  transcript: Transcript,
  botToken?: string,
  dbName?: string,
): Promise<{ transcript: Transcript; updated: boolean }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { transcript, updated: false };
  }

  // 1. Coleta todas as URLs do Discord
  const discordUrls: string[] = [];
  const filenameMap = new Map<string, string>();

  for (const msg of transcript.messages || []) {
    for (const att of msg.attachments || []) {
      if (isDiscordAttachmentUrl(att.url)) {
        discordUrls.push(att.url);
        filenameMap.set(att.url, att.filename || "anexo.png");
      }
    }
    for (const emb of msg.embeds || []) {
      if (emb.image && isDiscordAttachmentUrl(emb.image)) {
        discordUrls.push(emb.image);
        filenameMap.set(emb.image, "embed-image.png");
      }
      if (emb.thumbnail && isDiscordAttachmentUrl(emb.thumbnail)) {
        discordUrls.push(emb.thumbnail);
        filenameMap.set(emb.thumbnail, "embed-thumb.png");
      }
    }
    collectFromComponents(msg.components, discordUrls);
  }

  if (discordUrls.length === 0) {
    return { transcript, updated: false };
  }

  // 2. Renova as URLs via Discord caso já estejam expiradas
  let refreshedMap = new Map<string, string>();
  if (botToken) {
    refreshedMap = await refreshDiscordUrls(botToken, discordUrls);
  }

  // 3. Upload para o Vercel Blob
  const urlMapping = new Map<string, string>();
  const uniqueUrls = Array.from(new Set(discordUrls));

  for (const originalUrl of uniqueUrls) {
    const downloadUrl = refreshedMap.get(originalUrl) || originalUrl;
    const fallbackName = originalUrl.split("/").pop()?.split("?")[0] || "imagem.png";
    const filename = filenameMap.get(originalUrl) || fallbackName;

    const blobUrl = await uploadUrlToVercelBlob(
      downloadUrl,
      filename,
      `transcripts/${transcript.id}`,
    );

    if (blobUrl) {
      urlMapping.set(originalUrl, blobUrl);
    }
  }

  if (urlMapping.size === 0) {
    return { transcript, updated: false };
  }

  // 4. Substitui nos dados do transcript
  let hasChanges = false;
  for (const msg of transcript.messages) {
    for (const att of msg.attachments || []) {
      if (urlMapping.has(att.url)) {
        att.url = urlMapping.get(att.url)!;
        hasChanges = true;
      }
    }
    for (const emb of msg.embeds || []) {
      if (emb.image && urlMapping.has(emb.image)) {
        emb.image = urlMapping.get(emb.image)!;
        hasChanges = true;
      }
      if (emb.thumbnail && urlMapping.has(emb.thumbnail)) {
        emb.thumbnail = urlMapping.get(emb.thumbnail)!;
        hasChanges = true;
      }
    }
    if (updateComponentsUrls(msg.components, urlMapping)) {
      hasChanges = true;
    }
  }

  // 5. Salva no MongoDB
  if (hasChanges && dbName) {
    try {
      const db = await getDatabase(dbName);
      await db.collection<Transcript>("transcripts").updateOne(
        { id: transcript.id },
        { $set: { messages: transcript.messages } },
      );
      console.log(`[Vercel Blob] Transcript #${transcript.id}: ${urlMapping.size} mídias migradas com sucesso.`);
    } catch (err) {
      console.error(`[Vercel Blob] Erro ao persistir transcript no MongoDB:`, err);
    }
  }

  return { transcript, updated: hasChanges };
}

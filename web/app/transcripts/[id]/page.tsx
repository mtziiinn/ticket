import { notFound } from "next/navigation";
import { getDatabase } from "@/lib/mongodb";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { TranscriptViewer } from "@/components/transcript/transcript-viewer";
import type { Transcript } from "@/lib/types";
import type { Metadata } from "next";
import { isDiscordAttachmentUrl, syncTranscriptMedia } from "@/lib/blob-media";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getTranscript(id: string): Promise<Transcript | null> {
  try {
    const tenant = await resolveTenantFromHeaders();
    const db = await getDatabase(tenant.dbName);
    const collection = db.collection<Transcript>("transcripts");
    const cleanId = (id || "").trim();
    const transcript = await collection.findOne({
      $or: [
        { id: cleanId },
        { id: cleanId.toUpperCase() },
        { id: cleanId.toLowerCase() },
      ],
    });

    if (transcript) {
      // Se ainda houver mídias efêmeras do Discord, auto-sincroniza com Vercel Blob
      const hasDiscordMedia = transcript.messages?.some(
        (m) =>
          m.attachments?.some((a) => isDiscordAttachmentUrl(a.url)) ||
          m.embeds?.some((e) => isDiscordAttachmentUrl(e.image) || isDiscordAttachmentUrl(e.thumbnail)),
      );

      if (hasDiscordMedia && process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          const { transcript: updatedTranscript } = await syncTranscriptMedia(
            transcript,
            tenant.botToken,
            tenant.dbName,
          );
          return updatedTranscript;
        } catch (syncErr) {
          console.warn("[Transcript Page] Falha na auto-sincronização de mídia:", syncErr);
        }
      }
    }

    return transcript;
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const transcript = await getTranscript(id);

  if (!transcript) {
    return {
      title: "Transcript nao encontrado",
    };
  }

  return {
    title: `Transcript #${transcript.id}`,
    description: `Transcript de ${transcript.openedBy.username} - ${transcript.messageCount} mensagens`,
  };
}

export default async function TranscriptPage({ params }: PageProps) {
  const { id } = await params;
  const transcript = await getTranscript(id);

  if (!transcript) {
    notFound();
  }

  return <TranscriptViewer transcript={transcript} />;
}

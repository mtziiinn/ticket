import { notFound } from "next/navigation";
import { getDatabase } from "@/lib/mongodb";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import { TranscriptViewer } from "@/components/transcript/transcript-viewer";
import type { Transcript } from "@/lib/types";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

// A página NÃO sincroniza mídia aqui: baixar/renovar os anexos do Discord é
// lento e instável (a conexão com discord.com às vezes trava ~10s), o que
// estourava o timeout da função serverless e travava o SSR. A recuperação de
// mídia é feita de forma preguiçosa por imagem no /api/transcripts/image-proxy
// e em lote pelo POST /api/transcripts/[id]/media (disparado pelo bot).
async function getTranscript(id: string): Promise<Transcript | null> {
  try {
    const tenant = await resolveTenantFromHeaders();
    const db = await getDatabase(tenant.dbName);
    const collection = db.collection<Transcript>("transcripts");
    const cleanId = (id || "").trim();
    return await collection.findOne({
      $or: [
        { id: cleanId },
        { id: cleanId.toUpperCase() },
        { id: cleanId.toLowerCase() },
      ],
    });
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

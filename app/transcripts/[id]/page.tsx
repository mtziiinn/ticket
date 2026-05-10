import { notFound } from "next/navigation"
import { getDatabase } from "@/lib/mongodb"
import { TranscriptViewer } from "@/components/transcript/transcript-viewer"
import type { Transcript } from "@/lib/types"
import type { Metadata } from "next"

interface PageProps {
  params: Promise<{ id: string }>
}

async function getTranscript(id: string): Promise<Transcript | null> {
  try {
    const db = await getDatabase()
    const collection = db.collection<Transcript>("transcripts")
    const transcript = await collection.findOne({ id })
    return transcript
  } catch (error) {
    console.error("Error fetching transcript:", error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const transcript = await getTranscript(id)

  if (!transcript) {
    return {
      title: "Transcript nao encontrado",
    }
  }

  return {
    title: `Transcript #${transcript.id} - Code Studio`,
    description: `Transcript de ${transcript.openedBy.username} - ${transcript.messageCount} mensagens`,
  }
}

export default async function TranscriptPage({ params }: PageProps) {
  const { id } = await params
  const transcript = await getTranscript(id)

  if (!transcript) {
    notFound()
  }

  return <TranscriptViewer transcript={transcript} />
}

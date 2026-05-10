"use client"

import { Header } from "./header"
import { SummaryCard } from "./summary-card"
import { ConversationCard } from "./conversation-card"
import type { Transcript } from "@/lib/types"

interface TranscriptViewerProps {
  transcript: Transcript
}

export function TranscriptViewer({ transcript }: TranscriptViewerProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <SummaryCard transcript={transcript} />
        <ConversationCard messages={transcript.messages} />
      </main>
    </div>
  )
}

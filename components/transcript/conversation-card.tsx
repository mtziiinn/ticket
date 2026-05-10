"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { MessageItem } from "./message-item"
import type { TranscriptMessage } from "@/lib/types"

interface ConversationCardProps {
  messages: TranscriptMessage[]
}

export function ConversationCard({ messages }: ConversationCardProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold text-foreground">
          Conversa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
        </div>
        <Separator className="my-4" />
        <p className="text-center text-sm text-muted-foreground py-2">
          Fim da Conversa
        </p>
      </CardContent>
    </Card>
  )
}

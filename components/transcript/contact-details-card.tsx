"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FileText } from "lucide-react"
import type { Transcript } from "@/lib/types"

interface ContactDetailsCardProps {
  transcript: Transcript
}

export function ContactDetailsCard({ transcript }: ContactDetailsCardProps) {
  const getInitials = (username?: string) => {
    if (!username) return "?"
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }

  if (!transcript.initialMessage) return null

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-lg font-semibold text-foreground">
            Detalhes do Contato
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 border border-border mt-0.5">
            {transcript.openedBy.avatar ? (
              <AvatarImage src={transcript.openedBy.avatar} />
            ) : null}
            <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
              {getInitials(transcript.openedBy.username)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground mb-1">
              {transcript.openedBy.username}
            </p>
            <div className="rounded-lg bg-secondary/50 border border-border p-3">
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                {transcript.initialMessage}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, MessageSquare, User, Tag, Clock, Hash } from "lucide-react"
import type { Transcript } from "@/lib/types"

interface SummaryCardProps {
  transcript: Transcript
}

export function SummaryCard({ transcript }: SummaryCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    // Use UTC methods to avoid hydration mismatch
    const day = date.getUTCDate()
    const month = date.toLocaleString("pt-BR", { month: "long", timeZone: "UTC" })
    const year = date.getUTCFullYear()
    const hours = date.getUTCHours().toString().padStart(2, "0")
    const minutes = date.getUTCMinutes().toString().padStart(2, "0")
    return `${day} de ${month} de ${year} às ${hours}:${minutes}`
  }

  const getInitials = (username?: string) => {
    if (!username) return "?"
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-foreground">
            Resumo da Transcricao
          </CardTitle>
          <Badge variant="outline" className="font-mono">
            #{transcript.id}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aberto em</p>
              <p className="text-sm font-medium text-foreground">{formatDate(transcript.createdAt)}</p>
            </div>
          </div>

          {transcript.closedAt && (
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Clock className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fechado em</p>
                <p className="text-sm font-medium text-foreground">{formatDate(transcript.closedAt)}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-chart-2/10">
              <MessageSquare className="h-4 w-4 text-chart-2" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Mensagens</p>
              <p className="text-sm font-medium text-foreground">{transcript.messageCount}</p>
            </div>
          </div>

          {transcript.channelName && (
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-3/10">
                <Hash className="h-4 w-4 text-chart-3" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Canal</p>
                <p className="text-sm font-medium text-foreground">{transcript.channelName}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border border-border">
              {transcript.openedBy.avatar ? (
                <AvatarImage src={transcript.openedBy.avatar} />
              ) : null}
              <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                {getInitials(transcript.openedBy.username)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Aberto por</p>
              <p className="text-sm font-medium text-foreground">{transcript.openedBy.username}</p>
            </div>
          </div>

          {transcript.closedBy && (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border border-border">
                {transcript.closedBy.avatar ? (
                  <AvatarImage src={transcript.closedBy.avatar} />
                ) : null}
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {getInitials(transcript.closedBy.username)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Fechado por</p>
                <p className="text-sm font-medium text-foreground">{transcript.closedBy.username}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Tag className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Categoria</p>
              <Badge variant="secondary" className="mt-1">
                {transcript.category}
              </Badge>
            </div>
          </div>

          {transcript.guildName && (
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-4/10">
                <User className="h-4 w-4 text-chart-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Servidor</p>
                <p className="text-sm font-medium text-foreground">{transcript.guildName}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

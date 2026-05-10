"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bot } from "lucide-react"
import type { TranscriptMessage } from "@/lib/types"

interface MessageItemProps {
  message: TranscriptMessage
}

export function MessageItem({ message }: MessageItemProps) {
  const initials = message.authorUsername
    ? message.authorUsername
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?"

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    // Use UTC to avoid hydration mismatch
    const day = date.getUTCDate().toString().padStart(2, "0")
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0")
    const year = date.getUTCFullYear()
    const hours = date.getUTCHours().toString().padStart(2, "0")
    const minutes = date.getUTCMinutes().toString().padStart(2, "0")
    return `${day}/${month}/${year} ${hours}:${minutes}`
  }

  return (
    <div className="flex items-start gap-4 py-4">
      <Avatar className="h-10 w-10 border border-border">
        {message.authorAvatar ? (
          <AvatarImage src={message.authorAvatar} alt={message.authorUsername} />
        ) : null}
        <AvatarFallback 
          className={message.isStaff 
            ? "bg-primary/20 text-primary font-medium" 
            : "bg-secondary text-secondary-foreground font-medium"
          }
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold ${message.isStaff ? "text-primary" : "text-foreground"}`}>
            {message.authorUsername}
          </span>
          {message.authorBot && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 gap-1">
              <Bot className="h-3 w-3" />
              BOT
            </Badge>
          )}
          {message.isStaff && !message.authorBot && (
            <Badge variant="default" className="text-xs px-1.5 py-0.5">
              STAFF
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
        </div>
        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{message.content}</p>
        
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.attachments.map((attachment, index) => (
              <a
                key={index}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {attachment.filename}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bot, ExternalLink, FileText, Image as ImageIcon, AlertCircle } from "lucide-react"
import type { TranscriptMessage } from "@/lib/types"

interface MessageItemProps {
  message: TranscriptMessage
}

function isImageAttachment(att: { url: string; filename: string; contentType?: string }) {
  if (att.contentType && att.contentType.startsWith("image/")) {
    return true
  }
  const clean = (att.filename || att.url || "").toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(clean)
}

function ImageCard({ url, filename }: { url: string; filename?: string }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="truncate max-w-[220px]">{filename || "Imagem indisponível"}</span>
        <span className="text-[11px] underline ml-1 shrink-0">Tentar abrir ↗</span>
      </a>
    )
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/80 bg-muted/20 hover:border-primary/50 transition-all duration-200 max-w-sm sm:max-w-md shadow-sm">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden bg-black/20"
        title="Clique para abrir a imagem em tamanho real"
      >
        <img
          src={url}
          alt={filename || "Imagem do ticket"}
          loading="lazy"
          onError={() => setError(true)}
          className="max-h-80 w-auto object-contain rounded-t-xl hover:scale-[1.01] transition-transform duration-200 cursor-pointer mx-auto"
        />
      </a>
      <div className="flex items-center justify-between px-3 py-1.5 bg-card/70 border-t border-border/40 text-xs text-muted-foreground">
        <span className="truncate max-w-[200px] flex items-center gap-1.5" title={filename}>
          <ImageIcon className="h-3 w-3 text-primary shrink-0" />
          <span className="truncate">{filename || "Imagem"}</span>
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline flex items-center gap-1 text-[11px] font-medium ml-2 shrink-0"
        >
          <span>Abrir</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
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

  const imageAttachments = (message.attachments || []).filter(isImageAttachment)
  const fileAttachments = (message.attachments || []).filter((att) => !isImageAttachment(att))

  // Detect standalone image URLs in content that aren't already attachments
  const contentImageUrls = (
    message.content?.match(
      /https?:\/\/[^\s<>()]+?\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^\s<>()]*)?/gi
    ) || []
  ).filter((url) => !message.attachments?.some((att) => att.url === url))

  return (
    <div className="flex items-start gap-4 py-4">
      <Avatar className="h-10 w-10 border border-border shrink-0">
        {message.authorAvatar ? (
          <AvatarImage src={message.authorAvatar} alt={message.authorUsername} />
        ) : null}
        <AvatarFallback
          className={
            message.isStaff
              ? "bg-primary/20 text-primary font-medium"
              : "bg-secondary text-secondary-foreground font-medium"
          }
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-semibold ${message.isStaff ? "text-primary" : "text-foreground"}`}
          >
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
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {message.content && (
          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        {/* Imagens Anexadas */}
        {imageAttachments.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {imageAttachments.map((attachment, index) => (
              <ImageCard
                key={index}
                url={attachment.url}
                filename={attachment.filename}
              />
            ))}
          </div>
        )}

        {/* Links de imagem encontrados no conteúdo da mensagem */}
        {contentImageUrls.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {contentImageUrls.map((url, index) => (
              <ImageCard key={`content-img-${index}`} url={url} filename="Imagem no texto" />
            ))}
          </div>
        )}

        {/* Arquivos Não-Imagem (PDF, ZIP, TXT, etc.) */}
        {fileAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {fileAttachments.map((attachment, index) => (
              <a
                key={index}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-primary/50 transition-all text-xs text-foreground group"
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate max-w-[220px] font-medium">
                  {attachment.filename}
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors ml-1 shrink-0" />
              </a>
            ))}
          </div>
        )}

        {/* Embeds do Discord */}
        {message.embeds && message.embeds.length > 0 && (
          <div className="space-y-2 pt-1">
            {message.embeds.map((embed, index) => {
              const hexColor = embed.color
                ? `#${embed.color.toString(16).padStart(6, "0")}`
                : "#3b82f6"
              return (
                <div
                  key={index}
                  style={{ borderLeftColor: hexColor }}
                  className="border-l-4 rounded-r-xl bg-card/60 border border-border/40 p-3.5 max-w-xl space-y-2 shadow-sm"
                >
                  {embed.title && (
                    <div className="font-semibold text-sm text-foreground">
                      {embed.title}
                    </div>
                  )}
                  {embed.description && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {embed.description}
                    </p>
                  )}
                  {embed.image && (
                    <a
                      href={embed.image}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-lg border border-border/40 hover:opacity-90 transition-opacity mt-2"
                    >
                      <img
                        src={embed.image}
                        alt="Imagem do embed"
                        className="max-h-72 w-auto object-contain rounded-lg"
                        loading="lazy"
                      />
                    </a>
                  )}
                  {embed.thumbnail && !embed.image && (
                    <img
                      src={embed.thumbnail}
                      alt="Thumbnail do embed"
                      className="max-h-20 max-w-20 object-contain rounded float-right ml-2"
                      loading="lazy"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

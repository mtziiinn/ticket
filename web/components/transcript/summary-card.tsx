"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  MessageSquare,
  User,
  Tag,
  Clock,
  Hash,
  HelpCircle,
  ShieldCheck,
  DownloadCloud,
  ExternalLink,
  CheckCircle,
} from "lucide-react";
import type { Transcript } from "@/lib/types";

interface SummaryCardProps {
  transcript: Transcript;
}

export function SummaryCard({ transcript }: SummaryCardProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Data não disponível";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Data inválida";

      const day = date.getDate();
      const month = date.toLocaleString("pt-BR", { month: "long" });
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${day} de ${month} de ${year} às ${hours}:${minutes}`;
    } catch {
      return "Erro ao formatar data";
    }
  };

  const getInitials = (username?: string) => {
    if (!username) return "?";
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-foreground">
            Resumo da Transcrição
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
              <p className="text-sm font-medium text-foreground">
                {formatDate(transcript.createdAt)}
              </p>
            </div>
          </div>

          {transcript.closedAt && (
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Clock className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fechado em</p>
                <p className="text-sm font-medium text-foreground">
                  {formatDate(transcript.closedAt)}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-chart-2/10">
              <MessageSquare className="h-4 w-4 text-chart-2" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Total de Mensagens
              </p>
              <p className="text-sm font-medium text-foreground">
                {transcript.messageCount}
              </p>
            </div>
          </div>

          {transcript.channelName && (
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-3/10">
                <Hash className="h-4 w-4 text-chart-3" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Canal</p>
                <p className="text-sm font-medium text-foreground">
                  {transcript.channelName}
                </p>
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
              <p className="text-sm font-medium text-foreground">
                {transcript.openedBy.username}
              </p>
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
                <p className="text-sm font-medium text-foreground">
                  {transcript.closedBy.username}
                </p>
              </div>
            </div>
          )}

          {transcript.claimedBy && (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border border-border">
                {transcript.claimedBy.avatar ? (
                  <AvatarImage src={transcript.claimedBy.avatar} />
                ) : null}
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {getInitials(transcript.claimedBy.username)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Responsável</p>
                <p className="text-sm font-medium text-foreground">
                  {transcript.claimedBy.username}
                </p>
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
                <p className="text-sm font-medium text-foreground">
                  {transcript.guildName}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {transcript.deliveries && transcript.deliveries.length > 0 && (
        <div className="px-6 pb-6 pt-2">
          <div className="border-t border-border/50 pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <DownloadCloud className="h-4 w-4 text-primary" />
              Arquivos Entregues
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {transcript.deliveries.map((delivery, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-4 p-3 rounded-lg bg-primary/5 border border-primary/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {delivery.filename}
                      </p>
                      {delivery.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {delivery.description}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-2">
                        Entregue em {formatDate(delivery.deliveredAt)}
                      </p>
                      {/\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(delivery.filename || delivery.url || "") && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-border/50 max-w-xs bg-muted/20">
                          <a href={delivery.url} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                              src={delivery.url}
                              alt={delivery.filename}
                              className="max-h-48 w-auto object-contain rounded-lg hover:scale-[1.02] transition-transform cursor-pointer"
                              loading="lazy"
                            />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  <a
                    href={delivery.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors text-primary shrink-0"
                    title="Baixar arquivo"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {transcript.description && (
        <div className="px-6 pb-6 pt-2">
          <div className="border-t border-border/50 pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Detalhes do Contato
            </h3>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
              <div className="mt-0.5">
                <HelpCircle className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {transcript.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

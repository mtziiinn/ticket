"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Ticket, ShieldCheck, Clock, ExternalLink, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SearchMode = "transcript" | "delivery";

export default function HomePage() {
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<SearchMode>("transcript");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    setLoading(true);
    const id = searchId.trim().toUpperCase();
    router.push(mode === "transcript" ? `/transcripts/${id}` : `/entregas/${id}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 animate-in fade-in zoom-in duration-500">
        {/* Header Visual */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full ring-1 ring-primary/20">
              {mode === "transcript" ? (
                <Ticket className="h-12 w-12 text-primary" />
              ) : (
                <Package className="h-12 w-12 text-primary" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {mode === "transcript" ? (
                <>Ticket <span className="text-primary">Transcript</span></>
              ) : (
                <>Minhas <span className="text-primary">Entregas</span></>
              )}
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              {mode === "transcript"
                ? "Acesse o histórico detalhado de atendimentos através do ID único do ticket."
                : "Recupere os arquivos entregues no seu ticket através do código de atendimento."}
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center gap-2">
          <Button
            variant={mode === "transcript" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("transcript")}
            className="gap-2"
          >
            <Ticket className="h-4 w-4" />
            Transcript
          </Button>
          <Button
            variant={mode === "delivery" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("delivery")}
            className="gap-2"
          >
            <Package className="h-4 w-4" />
            Entregas
          </Button>
        </div>

        {/* Busca */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-xl flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              {mode === "transcript" ? "Localizar Atendimento" : "Recuperar Entregas"}
            </CardTitle>
            <CardDescription>
              Insira o ID de 7 caracteres do ticket (ex: 380GACM)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Digite o ID do Ticket..."
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  className="pl-10 h-12 text-lg font-mono uppercase tracking-widest border-primary/20 focus-visible:ring-primary"
                  maxLength={10}
                />
                {mode === "transcript" ? (
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                ) : (
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-12 px-8 font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                disabled={loading || !searchId.trim()}
              >
                {loading ? "Buscando..." : "Buscar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Features / Cards Informativos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card/30 flex flex-col items-center text-center space-y-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span className="font-semibold text-sm">Segurança</span>
            <p className="text-xs text-muted-foreground">
              Logs protegidos e armazenados em nuvem.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card/30 flex flex-col items-center text-center space-y-2">
            <Clock className="h-6 w-6 text-primary" />
            <span className="font-semibold text-sm">30 Dias</span>
            <p className="text-xs text-muted-foreground">
              Arquivos disponíveis por 30 dias após a entrega.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card/30 flex flex-col items-center text-center space-y-2">
            <ExternalLink className="h-6 w-6 text-primary" />
            <span className="font-semibold text-sm">Integrado</span>
            <p className="text-xs text-muted-foreground">
              Sincronização instantânea com o Discord.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center">
          <Badge
            variant="secondary"
            className="px-4 py-1 text-xs font-mono opacity-60"
          >
            Powered by Mts
          </Badge>
        </footer>
      </div>
    </div>
  );
}

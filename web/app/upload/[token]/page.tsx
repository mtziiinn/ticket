"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileUp,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function UploadPage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    url?: string;
    filename?: string;
    error?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);

    try {
      const res = await fetch(`/api/upload/${token}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, url: data.url, filename: data.filename });
      } else {
        setResult({ success: false, error: data.error || "Erro ao fazer upload" });
      }
    } catch {
      setResult({ success: false, error: "Erro de conexão" });
    } finally {
      setUploading(false);
    }
  };

  if (result?.success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card text-center">
          <CardHeader>
            <div className="mx-auto p-4 rounded-full bg-green-500/10 w-fit mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Upload realizado!</CardTitle>
            <CardDescription>
              O arquivo <strong>{result.filename}</strong> foi enviado com
              sucesso e a qualidade original foi preservada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Volte ao Discord e clique em{" "}
              <strong>"Entregar Mídia"</strong> no painel admin para finalizar a
              entrega.
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href={result.url} target="_blank" rel="noopener noreferrer">
                Ver arquivo enviado
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full ring-1 ring-primary/20">
              <Upload className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Upload de Mídia
          </h1>
          <p className="text-sm text-muted-foreground">
            Envie o arquivo final com qualidade original para entrega ao
            cliente.
          </p>
        </div>

        {result?.error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{result.error}</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  id="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="file"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <FileUp className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {file ? file.name : "Clique para selecionar o arquivo"}
                  </span>
                  {file && (
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1048576).toFixed(1)} MB
                    </span>
                  )}
                </label>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={!file || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {file ? "Enviar arquivo" : "Selecione um arquivo"}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button asChild variant="link" size="sm">
            <a href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar ao início
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

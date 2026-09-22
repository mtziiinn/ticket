"use client";

import { useState, use } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { zipSync } from "fflate";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Files,
  X,
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

const MAX_FILES = 10;
// Mesmo teto aplicado no servidor (maximumSizeInBytes em app/api/upload/[token]/route.ts).
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

// Empacota a fila em um único ZIP no navegador. Zipar aqui em vez de no
// servidor é o que permite o upload ir direto para o Vercel Blob como um
// único arquivo, sem precisar de uma função serverless remontando tudo.
function buildZip(files: File[]): Promise<Uint8Array> {
  return Promise.all(files.map(async (f) => [f.name, new Uint8Array(await f.arrayBuffer())] as const)).then(
    (entries) => zipSync(Object.fromEntries(entries), { level: 5 }),
  );
}

export default function UploadPage({ params }: PageProps) {
  const { token } = use(params);
  // Fila acumulada: cada seleção via input soma ao array em vez de
  // substituir (o <input type="file"> por padrão troca o FileList inteiro
  // a cada escolha — por isso mandar "uma imagem por vez" antes perdia as
  // anteriores). A fila só é de fato enviada ao clicar em "Finalizar Envio".
  const [fileArray, setFileArray] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    url?: string;
    filename?: string;
    error?: string;
  } | null>(null);

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    setFileArray((prev) => {
      const next = [...prev, ...Array.from(selected)].slice(0, MAX_FILES);
      return next;
    });
  };

  const removeFile = (index: number) => {
    setFileArray((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fileArray.length === 0) return;

    const totalBytes = fileArray.reduce((s, f) => s + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      setResult({
        success: false,
        error: `Total de ${(totalBytes / 1048576).toFixed(1)} MB excede o limite de ${MAX_TOTAL_BYTES / 1048576} MB.`,
      });
      return;
    }

    setUploading(true);
    try {
      const isMulti = fileArray.length > 1;
      const filename = isMulti ? `entregaveis_${token}.zip` : fileArray[0].name;
      const contentType = isMulti ? "application/zip" : fileArray[0].type || "application/octet-stream";
      // Multi-arquivo vira um único ZIP no navegador; single-arquivo vai como está.
      const body: Blob = isMulti ? new Blob([await buildZip(fileArray)], { type: contentType }) : fileArray[0];

      // upload() manda os bytes direto para o Vercel Blob (não passa pela
      // função serverless, então não esbarra no limite de ~4,5 MB por
      // requisição). O backend só entra depois, via onUploadCompleted em
      // app/api/upload/[token]/route.ts, para gravar no Mongo e avisar o Discord.
      const blob = await upload(filename, body, {
        access: "public",
        contentType,
        handleUploadUrl: `/api/upload/${token}`,
        clientPayload: JSON.stringify({ fileNames: fileArray.map((f) => f.name) }),
      });

      setResult({ success: true, url: blob.url, filename });
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error && err.message ? err.message : "Erro de conexão",
      });
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
              {fileArray.length > 1
                ? `${fileArray.length} arquivos foram compactados e enviados com sucesso.`
                : `O arquivo foi enviado com sucesso e a qualidade original foi preservada.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A entrega foi enviada automaticamente para o Discord!
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href={result.url} target="_blank" rel="noopener noreferrer">
                Baixar {result.filename}
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
            Envie os arquivos finais com qualidade original para entrega ao cliente.
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
                  multiple
                  className="hidden"
                  // value="" permite escolher o MESMO arquivo de novo depois
                  // de removê-lo da fila — sem isso o navegador não dispara
                  // onChange na segunda vez.
                  value=""
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <label
                  htmlFor="file"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Files className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {fileArray.length > 0
                      ? "Clique para adicionar mais arquivos à fila"
                      : "Clique para selecionar os arquivos"}
                  </span>
                </label>
              </div>

              {fileArray.length > 0 && (
                <ul className="text-left text-sm text-muted-foreground space-y-1 max-h-48 overflow-y-auto">
                  {fileArray.map((f, i) => (
                    <li
                      key={`${f.name}-${f.lastModified}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5"
                    >
                      <span className="truncate">
                        {f.name} ({(f.size / 1048576).toFixed(1)} MB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={`Remover ${f.name} da fila`}
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                  {fileArray.length > 1 && (
                    <li className="text-xs text-primary pt-1 border-t border-border mt-1 px-1">
                      Total:{" "}
                      {(
                        fileArray.reduce((s, f) => s + f.size, 0) / 1048576
                      ).toFixed(1)}{" "}
                      MB — serão compactados em ZIP ao finalizar
                    </li>
                  )}
                </ul>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={fileArray.length === 0 || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {fileArray.length > 1
                      ? "Compactando e enviando..."
                      : "Enviando..."}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {fileArray.length > 0
                      ? `Finalizar Envio (${fileArray.length})`
                      : "Selecione os arquivos"}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button asChild variant="link" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

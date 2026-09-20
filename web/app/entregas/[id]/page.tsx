import { notFound } from "next/navigation";
import { getDatabase } from "@/lib/mongodb";
import { resolveTenantFromHeaders } from "@/lib/tenant";
import type { TicketWithDeliveries } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileDown, Package, ArrowLeft, Download, TimerOff } from "lucide-react";

// Mesmo prazo aplicado em app/api/upload/[token]/route.ts ao gravar o arquivo.
const FILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FILE_URL_PATTERN = /\/api\/file\/([^/?#]+)/;

interface PageProps {
  params: Promise<{ id: string }>;
}

interface TicketDocument {
  ticketId: string;
  category?: string;
  description?: string;
  openedAt?: Date;
  deliveries?: Array<{
    url: string;
    filename: string;
    description: string;
    deliveredBy: string;
    deliveredAt: Date;
  }>;
}

async function getTicketDeliveries(id: string): Promise<TicketWithDeliveries | null> {
  try {
    const tenant = await resolveTenantFromHeaders();
    const db = await getDatabase(tenant.dbName);
    const collection = db.collection<TicketDocument>("tickets");
    const ticket = await collection.findOne(
      { ticketId: id },
      { projection: { ticketId: 1, category: 1, description: 1, openedAt: 1, deliveries: 1 } },
    );

    if (!ticket || !ticket.deliveries || ticket.deliveries.length === 0) {
      return null;
    }

    // O arquivo mora em delivery_files e o MongoDB apaga o documento quando
    // expiresAt passa. Sem documento (ou com prazo vencido) a entrega expirou.
    // Links que não são do nosso /api/file/ não têm como ser checados: seguem disponíveis.
    const tokens = ticket.deliveries
      .map((d) => d.url?.match(FILE_URL_PATTERN)?.[1])
      .filter((t): t is string => Boolean(t));
    const files = tokens.length
      ? await db
          .collection("delivery_files")
          .find({ token: { $in: tokens } }, { projection: { token: 1, expiresAt: 1 } })
          .toArray()
      : [];
    const expiresByToken = new Map(files.map((f) => [f.token as string, f.expiresAt as Date | undefined]));
    const now = Date.now();

    return {
      ticketId: ticket.ticketId,
      category: ticket.category || "Suporte",
      description: ticket.description || "Não informado.",
      createdAt: ticket.openedAt?.toISOString() || new Date().toISOString(),
      deliveries: ticket.deliveries.map((d) => {
        const deliveredAt = d.deliveredAt instanceof Date
          ? d.deliveredAt.toISOString()
          : String(d.deliveredAt);
        const token = d.url?.match(FILE_URL_PATTERN)?.[1];
        let expired = false;
        let expiresAt: string | undefined;
        if (token) {
          const hasFile = expiresByToken.has(token);
          const fileExpiresAt = expiresByToken.get(token);
          if (hasFile && !fileExpiresAt) {
            // Documento sem prazo gravado: a rota de download serve sem checar validade.
            expired = false;
          } else {
            const expiresMs = fileExpiresAt
              ? new Date(fileExpiresAt).getTime()
              : new Date(deliveredAt).getTime() + FILE_TTL_MS;
            expired = !hasFile || expiresMs <= now;
            if (Number.isFinite(expiresMs)) expiresAt = new Date(expiresMs).toISOString();
          }
        }
        return {
          url: d.url,
          filename: d.filename,
          description: d.description,
          deliveredBy: d.deliveredBy,
          deliveredAt,
          expired,
          expiresAt,
        };
      }),
    };
  } catch (error) {
    console.error("Error fetching ticket deliveries:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getTicketDeliveries(id);

  if (!data) {
    return { title: "Entregas nao encontradas" };
  }

  return {
    title: `Entregas #${data.ticketId}`,
    description: `${data.deliveries.length} arquivo(s) entregue(s) - ${data.category}`,
  };
}

export default async function DeliveriesPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getTicketDeliveries(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-semibold text-foreground tracking-tight">
                Entregas
              </span>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Ticket Info */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Package className="h-6 w-6 text-primary" />
                  Ticket #{data.ticketId}
                </CardTitle>
                <p className="text-muted-foreground text-sm mt-1">
                  Categoria: <Badge variant="secondary" className="ml-1">{data.category}</Badge>
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {data.deliveries.length} {data.deliveries.length === 1 ? "arquivo" : "arquivos"}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Deliveries List */}
        {data.deliveries.map((delivery, index) => (
          <Card key={index} className="border-border bg-card overflow-hidden">
            <CardHeader className="pb-3 bg-primary/5 border-b border-primary/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileDown className="h-5 w-5 text-primary" />
                  {delivery.filename}
                </CardTitle>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {delivery.expired && (
                    <Badge variant="destructive" className="text-[10px]">Expirado</Badge>
                  )}
                  {new Date(delivery.deliveredAt).toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {delivery.description && (
                <p className="text-sm text-muted-foreground">
                  {delivery.description}
                </p>
              )}
              {delivery.expired ? (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
                >
                  <TimerOff className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      Este arquivo expirou{delivery.expiresAt
                        ? ` em ${new Date(delivery.expiresAt).toLocaleDateString("pt-BR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            timeZone: "America/Sao_Paulo",
                          })}`
                        : ""}.
                    </p>
                    <p className="text-muted-foreground">
                      Os arquivos ficam disponíveis por 7 dias após a entrega. Fale com a equipe pelo ticket para solicitar uma nova entrega.
                    </p>
                  </div>
                </div>
              ) : (
                <Button asChild className="w-full gap-2">
                  <a href={delivery.url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Baixar {delivery.filename}
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getDatabase } from "@/lib/mongodb";
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
import { FileDown, Package, ArrowLeft, Download } from "lucide-react";

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
    const db = await getDatabase();
    const collection = db.collection<TicketDocument>("tickets");
    const ticket = await collection.findOne(
      { ticketId: id },
      { projection: { ticketId: 1, category: 1, description: 1, openedAt: 1, deliveries: 1 } },
    );

    if (!ticket || !ticket.deliveries || ticket.deliveries.length === 0) {
      return null;
    }

    return {
      ticketId: ticket.ticketId,
      category: ticket.category || "Suporte",
      description: ticket.description || "Não informado.",
      createdAt: ticket.openedAt?.toISOString() || new Date().toISOString(),
      deliveries: ticket.deliveries.map((d) => ({
        url: d.url,
        filename: d.filename,
        description: d.description,
        deliveredBy: d.deliveredBy,
        deliveredAt: d.deliveredAt instanceof Date
          ? d.deliveredAt.toISOString()
          : String(d.deliveredAt),
      })),
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
    title: `Entregas #${data.ticketId} - Mts`,
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
                Mts Entregas
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
                <span className="text-xs text-muted-foreground">
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
              <Button asChild className="w-full gap-2">
                <a href={delivery.url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                  Baixar {delivery.filename}
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}

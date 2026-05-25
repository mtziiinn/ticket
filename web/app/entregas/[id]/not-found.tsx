import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <span className="text-lg font-semibold text-foreground tracking-tight">
              Mts Entregas
            </span>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Card className="border-border bg-card text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto p-4 rounded-full bg-destructive/10 w-fit mb-4">
              <PackageX className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              Nenhuma entrega encontrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Nao encontramos entregas para este codigo de ticket. O codigo pode estar incorreto, ou as entregas ja foram removidas (apos 30 dias).
            </p>
            <Button asChild variant="outline">
              <Link href="/">Voltar ao inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

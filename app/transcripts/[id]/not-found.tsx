import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileX } from "lucide-react"
import { Header } from "@/components/transcript/header"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Card className="border-border bg-card text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto p-4 rounded-full bg-destructive/10 w-fit mb-4">
              <FileX className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              Transcript nao encontrado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              O transcript que voce esta procurando nao existe ou foi removido.
            </p>
            <Button asChild variant="outline">
              <Link href="/">Voltar ao inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

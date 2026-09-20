import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Carregados só pelo efeito colateral: o next/font injeta o @font-face
// global "Geist"/"Geist Mono" que o globals.css espera (--font-sans:
// 'Geist', ...). Foi removido numa limpeza de performance sem perceber
// que o CSS dependia dele — sem isso o site cai na fonte padrão do sistema.
const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Transcripts",
  description: "Visualize support ticket transcripts",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}

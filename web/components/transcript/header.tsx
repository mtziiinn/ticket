"use client";

import { Ticket } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight">
              Mts Transcripts
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

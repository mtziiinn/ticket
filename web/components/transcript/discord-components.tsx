"use client"

import { Fragment, useState, type ReactNode } from "react"
import { ChevronDown, ExternalLink, FileText } from "lucide-react"
import type { TranscriptComponent, TranscriptEmoji, TranscriptMentions } from "@/lib/types"

// Renderiza os componentes V2 do Discord (container, section, text display,
// galeria, separador, botões) e o markdown do Discord dentro deles, pra que o
// transcript mostre os painéis do bot como aparecem no ticket.

function emojiUrl(id: string, animated?: boolean) {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=48&quality=lossless`
}

function CustomEmoji({ emoji, className }: { emoji: TranscriptEmoji; className?: string }) {
  if (!emoji.id) return <span className={className}>{emoji.name}</span>
  return (
    <img
      src={emojiUrl(emoji.id, emoji.animated)}
      alt={emoji.name ? `:${emoji.name}:` : "emoji"}
      title={emoji.name ? `:${emoji.name}:` : undefined}
      loading="lazy"
      className={className ?? "inline-block h-[1.375em] w-auto align-[-0.3em] object-contain"}
    />
  )
}

// Horário fixo de Brasília: igual no servidor e no navegador (sem hydration mismatch)
const TIMESTAMP_FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
  t: { hour: "2-digit", minute: "2-digit" },
  T: { hour: "2-digit", minute: "2-digit", second: "2-digit" },
  d: { day: "2-digit", month: "2-digit", year: "numeric" },
  D: { day: "numeric", month: "long", year: "numeric" },
  f: { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" },
  F: {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
}

function formatDiscordTimestamp(unix: number, style = "f") {
  const options = TIMESTAMP_FORMATS[style] ?? TIMESTAMP_FORMATS.f
  return new Date(unix * 1000).toLocaleString("pt-BR", { ...options, timeZone: "America/Sao_Paulo" })
}

function Spoiler({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <span
      onClick={() => setRevealed(true)}
      className={
        revealed
          ? "rounded bg-muted/60 px-0.5"
          : "cursor-pointer rounded bg-muted text-transparent select-none [&_*]:invisible"
      }
      title={revealed ? undefined : "Spoiler — clique para revelar"}
    >
      {children}
    </span>
  )
}

function Mention({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-primary/15 px-1 font-medium text-primary">{children}</span>
  )
}

// ---------------------------------------------------------------------------
// Markdown inline
// ---------------------------------------------------------------------------

type InlineRule = {
  pattern: RegExp
  /** Só casa no começo de palavra (ex.: _itálico_ não pega snake_case) */
  wordStart?: boolean
  render: (m: RegExpExecArray, ctx: Ctx, key: number) => ReactNode
}

type Ctx = { mentions?: TranscriptMentions }

const INLINE_RULES: InlineRule[] = [
  {
    pattern: /^\\([*_~`|\\<>#\-[\]()])/,
    render: (m) => m[1],
  },
  {
    pattern: /^(`+)([\s\S]*?[^`])\1(?!`)/,
    render: (m, _ctx, key) => (
      <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
        {m[2].trim()}
      </code>
    ),
  },
  {
    pattern: /^<(a)?:(\w+):(\d+)>/,
    render: (m, _ctx, key) => (
      <CustomEmoji key={key} emoji={{ id: m[3], name: m[2], animated: Boolean(m[1]) }} />
    ),
  },
  {
    pattern: /^<@&(\d+)>/,
    render: (m, ctx, key) => (
      <Mention key={key}>@{ctx.mentions?.roles?.[m[1]] ?? "cargo"}</Mention>
    ),
  },
  {
    pattern: /^<@!?(\d+)>/,
    render: (m, ctx, key) => (
      <Mention key={key}>@{ctx.mentions?.users?.[m[1]] ?? "usuário"}</Mention>
    ),
  },
  {
    pattern: /^<#(\d+)>/,
    render: (m, ctx, key) => (
      <Mention key={key}>#{ctx.mentions?.channels?.[m[1]] ?? "canal"}</Mention>
    ),
  },
  {
    pattern: /^<t:(-?\d+)(?::([tTdDfFR]))?>/,
    render: (m, _ctx, key) => (
      <span key={key} className="rounded bg-muted/70 px-1">
        {formatDiscordTimestamp(Number(m[1]), m[2] === "R" ? "f" : m[2])}
      </span>
    ),
  },
  {
    pattern: /^\[([^\]\n]+)\]\(<?(https?:\/\/[^\s)>]+)>?\)/,
    render: (m, ctx, key) => (
      <a key={key} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
        {renderInline(m[1], ctx)}
      </a>
    ),
  },
  {
    pattern: /^<(https?:\/\/[^\s>]+)>/,
    render: (m, _ctx, key) => (
      <a key={key} href={m[1]} target="_blank" rel="noopener noreferrer" className="break-all text-sky-400 hover:underline">
        {m[1]}
      </a>
    ),
  },
  {
    pattern: /^https?:\/\/[^\s<]+[^\s<.,:;"')\]]/,
    render: (m, _ctx, key) => (
      <a key={key} href={m[0]} target="_blank" rel="noopener noreferrer" className="break-all text-sky-400 hover:underline">
        {m[0]}
      </a>
    ),
  },
  {
    pattern: /^\*\*\*([\s\S]+?)\*\*\*(?!\*)/,
    render: (m, ctx, key) => (
      <strong key={key} className="font-semibold text-foreground">
        <em>{renderInline(m[1], ctx)}</em>
      </strong>
    ),
  },
  {
    pattern: /^\*\*([\s\S]+?)\*\*(?!\*)/,
    render: (m, ctx, key) => (
      <strong key={key} className="font-semibold text-foreground">
        {renderInline(m[1], ctx)}
      </strong>
    ),
  },
  {
    pattern: /^__([\s\S]+?)__(?!_)/,
    render: (m, ctx, key) => <u key={key}>{renderInline(m[1], ctx)}</u>,
  },
  {
    pattern: /^\*(?=\S)([^*\n]+?)\*(?!\*)/,
    render: (m, ctx, key) => <em key={key}>{renderInline(m[1], ctx)}</em>,
  },
  {
    pattern: /^_(?=\S)([^_\n]+?)_(?![\w_])/,
    wordStart: true,
    render: (m, ctx, key) => <em key={key}>{renderInline(m[1], ctx)}</em>,
  },
  {
    pattern: /^~~([\s\S]+?)~~/,
    render: (m, ctx, key) => <s key={key}>{renderInline(m[1], ctx)}</s>,
  },
  {
    pattern: /^\|\|([\s\S]+?)\|\|/,
    render: (m, ctx, key) => <Spoiler key={key}>{renderInline(m[1], ctx)}</Spoiler>,
  },
]

function renderInline(text: string, ctx: Ctx): ReactNode[] {
  const out: ReactNode[] = []
  let buffer = ""
  let i = 0
  let key = 0

  while (i < text.length) {
    const rest = text.slice(i)
    const afterWord = i > 0 && /\w/.test(text[i - 1])
    let matched = false
    for (const rule of INLINE_RULES) {
      if (rule.wordStart && afterWord) continue
      const m = rule.pattern.exec(rest)
      if (!m) continue
      if (buffer) {
        out.push(buffer)
        buffer = ""
      }
      out.push(rule.render(m, ctx, key++))
      i += m[0].length
      matched = true
      break
    }
    if (!matched) {
      buffer += text[i]
      i++
    }
  }
  if (buffer) out.push(buffer)
  return out
}

// ---------------------------------------------------------------------------
// Markdown em blocos (títulos, subtexto, citação, listas, blocos de código)
// ---------------------------------------------------------------------------

export function DiscordMarkdown({
  text,
  mentions,
  className,
}: {
  text: string
  mentions?: TranscriptMentions
  className?: string
}) {
  return (
    <div className={className ?? "space-y-1 text-sm leading-relaxed text-foreground/90 break-words"}>
      {renderBlocks(text, { mentions })}
    </div>
  )
}

function renderBlocks(text: string, ctx: Ctx): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const out: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // ```bloco de código``` — numa linha só, ou em várias com linguagem opcional
    if (line.startsWith("```")) {
      const single = /^```([\s\S]+?)```\s*$/.exec(line)
      const body: string[] = []
      if (single) {
        body.push(single[1])
        i++
      } else {
        const first = line.slice(3)
        if (first.trim() && !/^\w+$/.test(first.trim())) body.push(first)
        i++
        while (i < lines.length && !lines[i].includes("```")) body.push(lines[i++])
        if (i < lines.length) {
          const before = lines[i].slice(0, lines[i].indexOf("```"))
          if (before) body.push(before)
          i++
        }
      }
      out.push(
        <pre
          key={key++}
          className="whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/40 px-3 py-2 font-mono text-xs text-foreground/90"
        >
          {body.join("\n")}
        </pre>,
      )
      continue
    }

    // >>> citação até o fim
    if (line.startsWith(">>> ")) {
      const quoted = [line.slice(4), ...lines.slice(i + 1)].join("\n")
      out.push(<Quote key={key++}>{renderBlocks(quoted, ctx)}</Quote>)
      break
    }

    // > citação (linhas seguidas)
    if (line.startsWith("> ") || line === ">") {
      const quoted: string[] = []
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
        quoted.push(lines[i].replace(/^> ?/, ""))
        i++
      }
      out.push(<Quote key={key++}>{renderBlocks(quoted.join("\n"), ctx)}</Quote>)
      continue
    }

    const heading = /^(#{1,3}) +(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const cls =
        level === 1
          ? "text-2xl font-bold text-foreground"
          : level === 2
            ? "text-xl font-bold text-foreground"
            : "text-base font-bold text-foreground"
      out.push(
        <div key={key++} className={`${cls} leading-snug pt-0.5`}>
          {renderInline(heading[2], ctx)}
        </div>,
      )
      i++
      continue
    }

    const subtext = /^-# +(.+)$/.exec(line)
    if (subtext) {
      out.push(
        <div key={key++} className="text-xs text-muted-foreground">
          {renderInline(subtext[1], ctx)}
        </div>,
      )
      i++
      continue
    }

    if (/^\s*[-*] +/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*] +/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*] +/, ""))
        i++
      }
      out.push(
        <ul key={key++} className="list-disc space-y-0.5 pl-5">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, ctx)}</li>
          ))}
        </ul>,
      )
      continue
    }

    if (line.trim() === "") {
      out.push(<div key={key++} className="h-1" />)
      i++
      continue
    }

    out.push(
      <div key={key++} className="whitespace-pre-wrap">
        {renderInline(line, ctx)}
      </div>,
    )
    i++
  }

  return out
}

function Quote({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-1 border-l-4 border-muted-foreground/40 pl-3">{children}</div>
  )
}

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------

const BUTTON_STYLES: Record<number, string> = {
  1: "bg-[#5865F2] text-white border-transparent",
  2: "bg-muted text-foreground border-border/60",
  3: "bg-[#248046] text-white border-transparent",
  4: "bg-[#DA373C] text-white border-transparent",
  5: "bg-muted text-foreground border-border/60",
  6: "bg-muted text-foreground border-border/60",
}

function ComponentButton({ c }: { c: Extract<TranscriptComponent, { type: "button" }> }) {
  const cls = `inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${
    BUTTON_STYLES[c.style] ?? BUTTON_STYLES[2]
  } ${c.disabled ? "opacity-50" : ""}`
  const inner = (
    <>
      {c.emoji && <CustomEmoji emoji={c.emoji} className="h-[1.1em] w-auto object-contain" />}
      {c.label && <span>{c.label}</span>}
      {c.url && <ExternalLink className="h-3.5 w-3.5 opacity-70" />}
    </>
  )
  if (c.url) {
    return (
      <a href={c.url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:brightness-110`}>
        {inner}
      </a>
    )
  }
  return (
    <span className={`${cls} cursor-default`} title="Botão do Discord (não interativo no transcript)">
      {inner}
    </span>
  )
}

function Gallery({ items }: { items: Array<{ url: string; description?: string }> }) {
  if (items.length === 1) {
    const item = items[0]
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block w-fit max-w-full">
        <img
          src={item.url}
          alt={item.description || "Imagem"}
          loading="lazy"
          className="max-h-96 w-auto max-w-full rounded-lg border border-border/40 object-contain"
        />
      </a>
    )
  }
  return (
    <div className={`grid gap-1.5 ${items.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
      {items.map((item, idx) => (
        <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={item.url}
            alt={item.description || "Imagem"}
            loading="lazy"
            className="aspect-square w-full rounded-lg border border-border/40 object-cover"
          />
        </a>
      ))}
    </div>
  )
}

function renderComponent(c: TranscriptComponent, ctx: Ctx, key: number): ReactNode {
  switch (c.type) {
    case "container": {
      const accent =
        typeof c.accentColor === "number"
          ? `#${c.accentColor.toString(16).padStart(6, "0")}`
          : undefined
      return (
        <div
          key={key}
          style={accent ? { borderLeftColor: accent } : undefined}
          className={`max-w-2xl space-y-2 rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm ${
            accent ? "border-l-4" : ""
          }`}
        >
          {c.components.map((child, idx) => renderComponent(child, ctx, idx))}
        </div>
      )
    }
    case "section":
      return (
        <div key={key} className="flex items-start gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            {c.components.map((child, idx) => renderComponent(child, ctx, idx))}
          </div>
          {c.accessory && (
            <div className={c.accessory.type === "button" ? "self-center shrink-0" : "shrink-0"}>
              {renderComponent(c.accessory, ctx, 0)}
            </div>
          )}
        </div>
      )
    case "text":
      return <DiscordMarkdown key={key} text={c.content} mentions={ctx.mentions} />
    case "thumbnail":
      return (
        <a key={key} href={c.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={c.url}
            alt={c.description || "Miniatura"}
            loading="lazy"
            className="h-20 w-20 rounded-lg object-cover sm:h-24 sm:w-24"
          />
        </a>
      )
    case "gallery":
      return <Gallery key={key} items={c.items} />
    case "file":
      return (
        <a
          key={key}
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs font-medium hover:border-primary/50"
        >
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="max-w-[220px] truncate">{c.name || "Arquivo"}</span>
        </a>
      )
    case "separator":
      return c.divider ? (
        <div key={key} className={`border-t border-border/60 ${c.spacing === "large" ? "my-4" : "my-2"}`} />
      ) : (
        <div key={key} className={c.spacing === "large" ? "h-4" : "h-1"} />
      )
    case "row":
      return (
        <div key={key} className="flex flex-wrap gap-2 pt-1">
          {c.components.map((child, idx) => renderComponent(child, ctx, idx))}
        </div>
      )
    case "button":
      return <ComponentButton key={key} c={c} />
    case "select":
      return (
        <div
          key={key}
          className={`flex w-full max-w-md items-center justify-between rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground ${
            c.disabled ? "opacity-50" : ""
          }`}
        >
          <span className="truncate">{c.placeholder || "Selecione uma opção"}</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </div>
      )
    default:
      return null
  }
}

export function DiscordComponents({
  components,
  mentions,
}: {
  components: TranscriptComponent[]
  mentions?: TranscriptMentions
}) {
  const ctx: Ctx = { mentions }
  return (
    <div className="space-y-2 pt-1">
      {components.map((c, idx) => (
        <Fragment key={idx}>{renderComponent(c, ctx, idx)}</Fragment>
      ))}
    </div>
  )
}

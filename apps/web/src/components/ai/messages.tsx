import type { PlaygroundCitation, PlaygroundToolCall } from "@/features/playground/types"

export function MarkdownMessageRenderer({ source }: { source: string }) {
  const blocks = source.split(/```/)

  return (
    <div className="space-y-2 text-sm leading-6">
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          const newline = block.indexOf("\n")
          const code = newline === -1 ? block : block.slice(newline + 1)
          return (
            <pre key={index} className="overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs">
              <code>{code}</code>
            </pre>
          )
        }
        return block.split("\n").filter((line) => line.length > 0).map((line, lineIndex) => {
          if (line.startsWith("- ")) {
            return (
              <ul key={`${index}-${lineIndex}`} className="list-disc pl-5">
                <li>{renderInline(line.slice(2))}</li>
              </ul>
            )
          }
          return <p key={`${index}-${lineIndex}`}>{renderInline(line)}</p>
        })
      })}
    </div>
  )
}

function renderInline(line: string) {
  const parts = line.split(/(`[^`]+`)/)
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={index}>{part}</span>
  })
}

export function StreamingMessage({
  role,
  content,
  streaming = false,
  simulated = false,
}: {
  role: "user" | "assistant"
  content: string
  streaming?: boolean
  simulated?: boolean
}) {
  return (
    <article className="grid gap-2 rounded-xl border border-border bg-card px-3 py-3" aria-busy={streaming}>
      <header className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{role === "user" ? "You" : "Assistant"}</span>
        {simulated ? <span className="rounded-full border border-border px-2 py-0.5">Simulated response</span> : null}
        {streaming ? <span role="status">Generating simulated text…</span> : null}
      </header>
      <MarkdownMessageRenderer source={content || (streaming ? "…" : "")} />
    </article>
  )
}

export function CitationCard({ citation }: { citation: PlaygroundCitation }) {
  return (
    <article className="rounded-lg border border-border px-3 py-2 text-sm" aria-label={`Citation ${citation.document}`}>
      <p className="font-medium">{citation.document}</p>
      <p className="text-xs text-muted-foreground">
        {citation.chunkId} · score {citation.score.toFixed(2)}
      </p>
      <p className="mt-1 leading-6">{citation.excerpt}</p>
    </article>
  )
}

export function ToolInvocationCard({ tool }: { tool: PlaygroundToolCall }) {
  return (
    <article className="rounded-lg border border-border px-3 py-2 text-sm" aria-label={`Tool ${tool.name}`}>
      <p className="font-medium">{tool.name}</p>
      <p className="text-xs text-muted-foreground">Status {tool.status}</p>
      <p className="mt-1 leading-6">{tool.output}</p>
    </article>
  )
}

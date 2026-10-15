import { useState } from "react"

const stages = ["Uploaded", "Parsing", "Chunking", "Embedding", "Indexing", "Ready"] as const

export function DocumentUploadZone({
  onFiles,
  disabled = false,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
}) {
  const [error, setError] = useState<string | null>(null)

  const accept = (list: FileList | null) => {
    const files = [...(list ?? [])]
    const invalid = files.find((file) => file.size > 5_000_000)
    if (invalid) {
      setError(`${invalid.name} is larger than 5 MB.`)
      return
    }
    setError(null)
    if (files.length > 0) onFiles(files)
  }

  return (
    <div
      className="rounded-xl border border-dashed border-border px-4 py-6 text-sm"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        if (!disabled) accept(event.dataTransfer.files)
      }}
    >
      <label className="grid gap-2">
        Upload documents
        <input
          type="file"
          multiple
          disabled={disabled}
          aria-describedby={error ? "upload-error" : undefined}
          onChange={(event) => accept(event.target.files)}
        />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">Files stay local until an ingestion API accepts them.</p>
      {error ? (
        <p id="upload-error" role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function IngestionProgress({ stage, failed = false }: { stage: (typeof stages)[number] | "Failed"; failed?: boolean }) {
  return (
    <ol className="grid gap-1 text-sm" aria-label="Ingestion progress">
      {stages.map((item) => (
        <li key={item} aria-current={item === stage ? "step" : undefined}>
          {item}
          {item === stage && !failed ? " · current" : ""}
        </li>
      ))}
      {failed ? <li role="alert">Failed</li> : null}
    </ol>
  )
}

export function RetrievalResultCard({
  rank,
  document,
  score,
  excerpt,
}: {
  rank: number
  document: string
  score: number
  excerpt: string
}) {
  return (
    <article className="rounded-lg border border-border px-3 py-2 text-sm" aria-label={`Result ${rank}`}>
      <p className="font-medium">
        {rank}. {document}
      </p>
      <p className="text-xs text-muted-foreground">Score {score.toFixed(2)}</p>
      <p className="mt-1 leading-6">{excerpt}</p>
    </article>
  )
}

export function ChunkInspector({
  chunkId,
  content,
  metadata,
}: {
  chunkId: string
  content: string
  metadata: Record<string, string>
}) {
  return (
    <section aria-label="Chunk inspector" className="grid gap-2 text-sm">
      <h3 className="font-medium">{chunkId}</h3>
      <p className="leading-6">{content}</p>
      <dl className="grid gap-1 text-xs text-muted-foreground">
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key}>
            <dt className="inline">{key}: </dt>
            <dd className="inline">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function EmbeddingStatus({ model, state }: { model: string; state: "idle" | "running" | "ready" | "failed" }) {
  return (
    <p role="status" className="text-sm">
      Embedding {model}: {state}
    </p>
  )
}

export function EvaluationScoreCard({
  label,
  score,
  threshold,
  simulated,
}: {
  label: string
  score: number
  threshold: number
  simulated: boolean
}) {
  const passed = score >= threshold
  return (
    <article className="rounded-lg border border-border px-3 py-2 text-sm" aria-label={label}>
      <p className="font-medium">{label}</p>
      <p>
        {score.toFixed(2)} / threshold {threshold.toFixed(2)} · {passed ? "pass" : "fail"}
      </p>
      {simulated ? <p className="text-xs text-muted-foreground">Simulated score</p> : null}
    </article>
  )
}

export function TraceTimeline({
  spans,
}: {
  spans: { id: string; name: string; durationMs: number; parentId?: string }[]
}) {
  return (
    <ol className="grid gap-1 text-sm" aria-label="Trace timeline">
      {spans.map((span) => (
        <li key={span.id}>
          {span.name} · {span.durationMs} ms{span.parentId ? ` · parent ${span.parentId}` : ""}
        </li>
      ))}
    </ol>
  )
}

export function JSONSchemaEditor({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  let error: string | null = null
  if (value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) error = "Enter a JSON object."
    } catch {
      error = "Enter valid JSON."
    }
  }

  return (
    <label htmlFor={id} className="grid gap-1.5 text-sm font-medium">
      JSON schema
      <textarea
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs font-normal"
      />
      {error ? (
        <span id={`${id}-error`} className="text-xs font-normal text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function KnowledgeBaseSelector({
  value,
  options,
  onChange,
  loading = false,
}: {
  value: string
  options: { id: string; name: string }[]
  onChange: (id: string) => void
  loading?: boolean
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      Knowledge base
      <select
        value={value}
        disabled={loading}
        aria-busy={loading}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm font-normal"
      >
        <option value="">{loading ? "Loading knowledge bases" : options.length === 0 ? "No knowledge bases" : "Select a knowledge base"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}

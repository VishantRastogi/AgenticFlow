"use client"

import { useState } from "react"
import { CostIndicator, TokenUsageBadge } from "@/components/ai/model-controls"
import { ChunkInspector, KnowledgeBaseSelector, TraceTimeline } from "@/components/ai/studio"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import { getApiMode } from "@/features/auth/api/mode"
import { useRagBases, useRagConfiguration, useRetrieve } from "@/features/rag/hooks"
import type { MetadataFilter, RetrievalRequest, RetrievalStrategy } from "@/features/rag/types"
import { assessRetrievalRequest } from "@/features/rag/validate"
import { localWorkspace } from "@/lib/workspace"

const fieldClass = "h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm font-normal"

function requestFrom(values: RetrievalRequest): RetrievalRequest {
  return { ...values, workspaceId: localWorkspace.id }
}

export function RagStudioScreen() {
  const bases = useRagBases()
  const saved = useRagConfiguration()
  const retrieval = useRetrieve()
  const [draft, setDraft] = useState<RetrievalRequest | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [pickedFor, setPickedFor] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [configOpen, setConfigOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const form = draft ?? saved.data?.configuration ?? null
  const requestId = retrieval.data?.requestId ?? null
  const firstChunkId = retrieval.data?.results[0]?.chunk.chunkId ?? null
  const selectedId = pickedFor === requestId ? pickedId : firstChunkId
  const result = retrieval.data ?? null
  const selected = result?.results.find((item) => item.chunk.chunkId === selectedId)?.chunk ?? null

  const update = (patch: Partial<RetrievalRequest>) => {
    if (!form) return
    setDraft({ ...form, ...patch })
  }

  const run = () => {
    if (!form) return
    const assessed = assessRetrievalRequest(requestFrom(form))
    if (!assessed.ok) {
      setFormError(assessed.message)
      return
    }
    setFormError(null)
    void retrieval.mutateAsync(assessed.request).catch((reason: unknown) => {
      setFormError(isApiError(reason) ? reason.message : "The retrieval service could not be reached.")
    })
  }

  const configuration = form ? (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        run()
      }}
    >
      <KnowledgeBaseSelector
        value={form.knowledgeBaseId}
        loading={bases.isPending}
        options={(bases.data ?? []).map((base) => ({ id: base.id, name: base.name }))}
        onChange={(knowledgeBaseId) => update({ knowledgeBaseId })}
      />
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="rag-query">
        Search query
        <textarea
          id="rag-query"
          value={form.query}
          onChange={(event) => update({ query: event.target.value })}
          className="min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm font-normal"
        />
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Retrieval strategy</legend>
        <div role="radiogroup" aria-label="Retrieval strategy" className="grid gap-1">
          {(["vector", "keyword", "hybrid"] as RetrievalStrategy[]).map((strategy) => (
            <label key={strategy} className="flex items-center gap-2 text-sm font-normal capitalize">
              <input
                type="radio"
                name="retrieval-strategy"
                value={strategy}
                checked={form.strategy === strategy}
                onChange={() => update({ strategy })}
              />
              {strategy}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="rag-topk">
        Top K
        <input
          id="rag-topk"
          type="number"
          min={1}
          max={20}
          value={form.topK}
          onChange={(event) => update({ topK: Number(event.target.value) })}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="rag-threshold">
        Similarity threshold
        <input
          id="rag-threshold"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={form.scoreThreshold}
          onChange={(event) => update({ scoreThreshold: Number(event.target.value) })}
          className={fieldClass}
        />
      </label>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Metadata filters</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update({ filters: [...form.filters, { key: "filename", op: "eq", value: "" }] })}
          >
            Add filter
          </Button>
        </div>
        {form.filters.length === 0 ? <p className="text-xs text-muted-foreground">No metadata filters.</p> : null}
        {form.filters.map((filter, index) => (
          <div key={`${filter.key}-${index}`} className="grid gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Key
              <input
                aria-label={`Filter ${index + 1} key`}
                value={filter.key}
                onChange={(event) => {
                  const filters = form.filters.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, key: event.target.value } : item,
                  )
                  update({ filters })
                }}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Operator
              <select
                aria-label={`Filter ${index + 1} operator`}
                value={filter.op}
                onChange={(event) => {
                  const op = event.target.value as MetadataFilter["op"]
                  update({ filters: form.filters.map((item, itemIndex) => (itemIndex === index ? { ...item, op } : item)) })
                }}
                className={fieldClass}
              >
                <option value="eq">Equals</option>
                <option value="contains">Contains</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Value
              <input
                aria-label={`Filter ${index + 1} value`}
                value={filter.value}
                onChange={(event) =>
                  update({
                    filters: form.filters.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value: event.target.value } : item,
                    ),
                  })
                }
                className={fieldClass}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => update({ filters: form.filters.filter((_, itemIndex) => itemIndex !== index) })}
            >
              Remove filter {index + 1}
            </Button>
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.rerank.enabled}
          onChange={(event) => update({ rerank: { ...form.rerank, enabled: event.target.checked } })}
        />
        Rerank results
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="rag-reranker">
        Reranker
        <select
          id="rag-reranker"
          value={form.rerank.model}
          disabled={!form.rerank.enabled}
          onChange={() => update({ rerank: { ...form.rerank, model: "orbit-rerank-mini" } })}
          className={fieldClass}
        >
          <option value="orbit-rerank-mini">Orbit Rerank Mini</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="rag-budget">
        Context token budget
        <input
          id="rag-budget"
          type="number"
          min={64}
          max={8192}
          value={form.contextTokenBudget}
          onChange={(event) => update({ contextTokenBudget: Number(event.target.value) })}
          className={fieldClass}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.generateAnswer}
          onChange={(event) => update({ generateAnswer: event.target.checked })}
        />
        Generate answer
      </label>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={retrieval.isPending}>
          {retrieval.isPending ? "Running retrieval" : "Run retrieval"}
        </Button>
        {formError ? (
          <Button type="button" variant="outline" onClick={run}>
            Retry
          </Button>
        ) : null}
      </div>
    </form>
  ) : (
    <p role="status">Loading retrieval settings</p>
  )

  const results = (
    <div className="grid gap-3" aria-live="polite">
      {retrieval.isPending ? <p role="status">Running simulated retrieval</p> : null}
      {!result && !retrieval.isPending ? (
        <p className="text-sm text-muted-foreground">Run a retrieval to see ranked chunks from ready documents.</p>
      ) : null}
      {result ? (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {result.notice} Strategy {result.strategy}. Latency {result.timing.totalMs} ms.
          </p>
          {result.results.length === 0 ? <p className="text-sm">No chunks returned.</p> : null}
          <ol className="grid gap-2" aria-label="Retrieval results">
            {result.results.map((item) => {
              const open = expanded[item.chunk.chunkId] ?? false
              return (
                <li key={item.chunk.chunkId} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <p className="font-medium">
                    {item.rank}. {item.chunk.documentName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Retrieval {item.chunk.score.kind} {item.chunk.score.normalized.toFixed(2)}
                    {item.chunk.rerankScore ? ` · rerank ${item.chunk.rerankScore.normalized.toFixed(2)}` : ""} · {item.chunk.chunkId}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.chunk.explanation}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" aria-expanded={open} onClick={() => setExpanded((current) => ({ ...current, [item.chunk.chunkId]: !open }))}>
                      {open ? "Hide chunk" : "Show chunk"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-pressed={selectedId === item.chunk.chunkId}
                      onClick={() => {
                        setPickedFor(requestId)
                        setPickedId(item.chunk.chunkId)
                      }}
                    >
                      Inspect {item.chunk.chunkId}
                    </Button>
                  </div>
                  {open ? <p className="mt-2 leading-6">{item.chunk.content}</p> : null}
                </li>
              )
            })}
          </ol>
        </>
      ) : null}
    </div>
  )

  const inspector = (
    <div className="grid gap-4" role="region" aria-label="RAG inspector">
      <h2 className="text-sm font-medium">Inspector</h2>
      {!selected ? <p className="text-sm text-muted-foreground">Select a chunk to inspect its content, offsets, and scores.</p> : null}
      {selected ? (
        <>
          <ChunkInspector chunkId={selected.chunkId} content={selected.content} metadata={selected.metadata} />
          <dl className="grid gap-1 text-xs text-muted-foreground">
            <div>Document {selected.documentName}</div>
            <div>
              Offsets {selected.startOffset}–{selected.endOffset}
            </div>
            <div>Embedding model {selected.embeddingModel}. No vectors were computed.</div>
            <div>
              Retrieval raw {selected.score.raw} · normalized {selected.score.normalized}
            </div>
            <div>{selected.rerankScore ? `Rerank ${selected.rerankScore.normalized}` : "Reranking was off for this run."}</div>
          </dl>
        </>
      ) : null}
      {result ? (
        <>
          <section className="grid gap-2" aria-label="Retrieval timing">
            <h3 className="text-sm font-medium">Timing</h3>
            <TraceTimeline
              spans={result.trace.stages.map((stage) => ({
                id: stage.name,
                name: stage.skipped ? `${stage.name} skipped` : stage.name,
                durationMs: stage.durationMs,
              }))}
            />
          </section>
          <section className="grid gap-2" aria-label="Context assembly">
            <h3 className="text-sm font-medium">Context assembly</h3>
            <p className="text-xs text-muted-foreground">
              {result.context.tokensUsed} of {result.context.tokenBudget} tokens · {result.context.chunkIds.length} chunks · simulated
            </p>
            <p className="text-sm leading-6">{result.context.preview || "No chunk fit the token budget."}</p>
          </section>
          <section className="grid gap-2" aria-label="Generated answer">
            <h3 className="text-sm font-medium">Generated answer</h3>
            {result.answer ? (
              <>
                <p className="text-sm leading-6">{result.answer.text}</p>
                <TokenUsageBadge promptTokens={result.answer.usage.promptTokens} completionTokens={result.answer.usage.completionTokens} />
                <CostIndicator amount={result.answer.estimatedCostUsd} />
                <ul className="grid gap-2" aria-label="Citations">
                  {result.answer.citations.map((citation) => (
                    <li key={citation.citationId} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <p className="font-medium">
                        {citation.documentName} · {citation.chunkId}
                      </p>
                      <p className="mt-1 leading-6">{citation.quote}</p>
                    </li>
                  ))}
                </ul>
                {result.answer.citations.length === 0 ? <p className="text-sm text-muted-foreground">No citations. The answer did not use a chunk.</p> : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Answer generation is off. Retrieval results stay available.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  )

  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">RAG Studio</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {getApiMode() === "mock" ? "Mock mode. " : ""}
          Retrieval and answers on this page are simulated. They use ready documents from this workspace and do not call a model.
        </p>
      </header>
      <div className="flex gap-2 lg:hidden">
        <Button type="button" variant="outline" aria-expanded={configOpen} onClick={() => setConfigOpen((open) => !open)}>
          Configuration
        </Button>
        <Button type="button" variant="outline" aria-expanded={inspectorOpen} onClick={() => setInspectorOpen((open) => !open)}>
          Inspector
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_20rem] lg:items-start">
        <aside className={`${configOpen ? "grid" : "hidden"} content-start gap-3 rounded-xl border border-border bg-card p-3 lg:grid`} aria-label="Retrieval configuration">
          {saved.isPending ? <p role="status">Loading retrieval settings</p> : null}
          {saved.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {isApiError(saved.error) ? saved.error.message : "Retrieval settings could not be loaded."}
            </p>
          ) : null}
          {configuration}
        </aside>
        <section className="min-h-[28rem] rounded-xl border border-border bg-card p-3" aria-label="Retrieval results panel">
          {results}
        </section>
        <aside className={`${inspectorOpen ? "grid" : "hidden"} content-start rounded-xl border border-border bg-card p-3 lg:grid`}>{inspector}</aside>
      </div>
    </div>
  )
}

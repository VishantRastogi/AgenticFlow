import type { ApiErrorCode } from "@/features/auth/types"
import { emptyRetrievalRequest, estimateCost } from "@/features/rag/catalog"
import { explainScore, rerankSimilarity, strategyScore, tokenize } from "@/features/rag/rank"
import type {
  ContextAssembly,
  GroundedAnswer,
  RagConfigurationResponse,
  RetrievalRequest,
  RetrievalResponse,
  RetrievalResult,
  RetrievalTiming,
  RetrievalTrace,
  SourceCitation,
} from "@/features/rag/types"
import { assessRetrievalRequest } from "@/features/rag/validate"
import { isWorkspaceId } from "@/features/knowledge/validate"
import { listIndexedChunks, type StoreFailure } from "@/mocks/knowledge-store"

const STORAGE_KEY = "agentflow-mock-rag"

type Database = {
  sequence: number
  configurations: Record<string, RetrievalRequest>
}

function emptyDatabase(): Database {
  return { sequence: 1, configurations: {} }
}

function readDatabase(): Database {
  if (typeof localStorage === "undefined") return emptyDatabase()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seeded = emptyDatabase()
    writeDatabase(seeded)
    return seeded
  }
  try {
    const parsed = JSON.parse(raw) as Database
    if (!parsed || typeof parsed.sequence !== "number" || !parsed.configurations) return emptyDatabase()
    return parsed
  } catch {
    return emptyDatabase()
  }
}

function writeDatabase(database: Database) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
}

function failure(status: number, code: ApiErrorCode, message: string): StoreFailure {
  return { ok: false, status, code, message }
}

function matches(metadata: Record<string, string>, request: RetrievalRequest) {
  return request.filters.every((filter) => {
    const value = metadata[filter.key] ?? ""
    if (filter.op === "eq") return value === filter.value
    return value.toLowerCase().includes(filter.value.toLowerCase())
  })
}

function timingFor(request: RetrievalRequest, candidateCount: number, resultCount: number, assembled: number, answerLength: number): RetrievalTiming {
  const embeddingMs = request.strategy === "keyword" ? 0 : 8 + request.query.length
  const rerankMs = request.rerank.enabled ? 6 + resultCount : 0
  const generationMs = request.generateAnswer ? 10 + answerLength : 0
  const parts = {
    validationMs: 3,
    embeddingMs,
    retrievalMs: 5 + candidateCount,
    filterMs: 2 + request.filters.length,
    rerankMs,
    assemblyMs: 2 + assembled,
    generationMs,
  }
  return { ...parts, totalMs: Object.values(parts).reduce((sum, value) => sum + value, 0) }
}

function traceFor(requestId: string, traceId: string, request: RetrievalRequest, timing: RetrievalTiming): RetrievalTrace {
  return {
    requestId,
    traceId,
    stages: [
      { name: "validation", durationMs: timing.validationMs, skipped: false },
      { name: "query_embedding", durationMs: timing.embeddingMs, skipped: request.strategy === "keyword" },
      { name: "retrieval", durationMs: timing.retrievalMs, skipped: false },
      { name: "filtering", durationMs: timing.filterMs, skipped: false },
      { name: "reranking", durationMs: timing.rerankMs, skipped: !request.rerank.enabled },
      { name: "context_assembly", durationMs: timing.assemblyMs, skipped: false },
      { name: "generation", durationMs: timing.generationMs, skipped: !request.generateAnswer },
    ],
  }
}

function assemble(results: RetrievalResult[], budget: number): ContextAssembly {
  const chunkIds: string[] = []
  const parts: string[] = []
  let tokensUsed = 0
  for (const result of results) {
    if (tokensUsed + result.chunk.tokenCount > budget) continue
    tokensUsed += result.chunk.tokenCount
    chunkIds.push(result.chunk.chunkId)
    parts.push(result.chunk.content)
  }
  return {
    tokenBudget: budget,
    tokensUsed,
    chunkIds,
    preview: parts.join("\n\n").slice(0, 1200),
    simulated: true,
  }
}

function answerFor(request: RetrievalRequest, context: ContextAssembly, results: RetrievalResult[]): GroundedAnswer | null {
  if (!request.generateAnswer) return null
  const included = results.filter((result) => context.chunkIds.includes(result.chunk.chunkId))
  const citations: SourceCitation[] = included.map((result) => ({
    citationId: `cite_${result.chunk.chunkId}`,
    chunkId: result.chunk.chunkId,
    documentId: result.chunk.documentId,
    documentName: result.chunk.documentName,
    index: result.chunk.index,
    quote: result.chunk.content.slice(0, 180),
  }))
  const text =
    citations.length === 0
      ? "Simulated answer. No ready chunks were placed in context, so this response has no citations. It was not produced by a model."
      : `Simulated answer. This was not produced by a model. Retrieved context from ${citations
          .map((citation, index) => `[${index + 1}] ${citation.documentName}`)
          .join(", ")}.`
  const promptTokens = context.tokensUsed + tokenize(request.query).length
  const completionTokens = Math.max(1, Math.ceil(text.length / 4))
  const totalTokens = promptTokens + completionTokens
  return {
    text,
    model: "orbit-small",
    citations,
    usage: { promptTokens, completionTokens, totalTokens },
    estimatedCostUsd: estimateCost(totalTokens),
    simulated: true,
  }
}

function finish(database: Database, request: RetrievalRequest, notice: string, results: RetrievalResult[], candidateCount: number): RetrievalResponse {
  const requestId = `req_${database.sequence}`
  const traceId = `trc_${database.sequence}`
  database.sequence += 1
  database.configurations[request.workspaceId] = request
  const context = assemble(results, request.contextTokenBudget)
  const answer = answerFor(request, context, results)
  const timing = timingFor(request, candidateCount, results.length, context.chunkIds.length, answer?.text.length ?? 0)
  writeDatabase(database)
  return {
    simulated: true,
    workspaceId: request.workspaceId,
    knowledgeBaseId: request.knowledgeBaseId,
    requestId,
    traceId,
    strategy: request.strategy,
    query: request.query,
    notice,
    results,
    context,
    answer,
    timing,
    trace: traceFor(requestId, traceId, request, timing),
  }
}

export function getRagConfiguration(workspaceId: string): RagConfigurationResponse | StoreFailure {
  if (!isWorkspaceId(workspaceId)) return failure(400, "validation_error", "A workspace id is required.")
  const database = readDatabase()
  return {
    simulated: true,
    workspaceId,
    configuration: database.configurations[workspaceId] ?? emptyRetrievalRequest(workspaceId),
  }
}

export function saveRagConfiguration(input: RetrievalRequest): RagConfigurationResponse | StoreFailure {
  if (!isWorkspaceId(input.workspaceId)) return failure(400, "validation_error", "A workspace id is required.")
  if (!input.knowledgeBaseId?.trim()) return failure(400, "validation_error", "Choose a knowledge base.")
  const database = readDatabase()
  const configuration: RetrievalRequest = {
    ...emptyRetrievalRequest(input.workspaceId),
    ...input,
    workspaceId: input.workspaceId,
    query: typeof input.query === "string" ? input.query : "",
    filters: Array.isArray(input.filters) ? input.filters : [],
    rerank: { enabled: Boolean(input.rerank?.enabled), model: "orbit-rerank-mini" },
  }
  database.configurations[input.workspaceId] = configuration
  writeDatabase(database)
  return { simulated: true, workspaceId: input.workspaceId, configuration }
}

export function retrieve(input: RetrievalRequest): RetrievalResponse | StoreFailure {
  if (/\brate limit\b/i.test(input.query ?? "")) {
    return failure(429, "rate_limited", "The simulated retrieval service applied a rate limit. Wait and retry this query.")
  }
  const assessed = assessRetrievalRequest(input)
  if (!assessed.ok) return failure(400, "validation_error", assessed.message)
  const request = assessed.request
  const indexed = listIndexedChunks(request.workspaceId, request.knowledgeBaseId)
  if (!indexed.ok) return indexed
  const database = readDatabase()
  if (indexed.chunks.length === 0) {
    return finish(database, request, "No ready documents in this knowledge base. Retrieval did not invent chunks.", [], 0)
  }

  const scored = indexed.chunks
    .map((chunk) => ({ chunk, score: strategyScore(request.strategy, request.query, chunk.content) }))
    .filter((item) => matches(item.chunk.metadata, request) && item.score.normalized >= request.scoreThreshold)
    .sort((left, right) => right.score.normalized - left.score.normalized || left.chunk.id.localeCompare(right.chunk.id))
    .slice(0, request.topK)

  const ordered = request.rerank.enabled
    ? [...scored].sort((left, right) => {
        const gap = rerankSimilarity(request.query, right.chunk.content) - rerankSimilarity(request.query, left.chunk.content)
        return gap || left.chunk.id.localeCompare(right.chunk.id)
      })
    : scored

  const results: RetrievalResult[] = ordered.map((item, index) => {
    const reranked = request.rerank.enabled ? rerankSimilarity(request.query, item.chunk.content) : null
    return {
      rank: index + 1,
      chunk: {
        chunkId: item.chunk.id,
        documentId: item.chunk.documentId,
        documentName: item.chunk.documentName,
        index: item.chunk.index,
        content: item.chunk.content,
        startOffset: item.chunk.startOffset,
        endOffset: item.chunk.endOffset,
        tokenCount: item.chunk.tokenCount,
        metadata: item.chunk.metadata,
        embeddingModel: item.chunk.embeddingModel,
        score: item.score,
        rerankScore: reranked === null ? null : { kind: "rerank", raw: reranked, normalized: reranked },
        explanation: explainScore(item.score),
      },
    }
  })

  const notice =
    results.length === 0
      ? "No chunks met the score threshold or metadata filters."
      : "Simulated retrieval. Scores are not from a vector database, and no model wrote this ranking."
  return finish(database, request, notice, results, indexed.chunks.length)
}

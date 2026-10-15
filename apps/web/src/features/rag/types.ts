export type RetrievalStrategy = "vector" | "keyword" | "hybrid"
export type MetadataFilterOp = "eq" | "contains"
export type RerankerId = "orbit-rerank-mini"

export type MetadataFilter = {
  key: string
  op: MetadataFilterOp
  value: string
}

export type RerankConfiguration = {
  enabled: boolean
  model: RerankerId
}

export type RetrievalRequest = {
  workspaceId: string
  knowledgeBaseId: string
  query: string
  strategy: RetrievalStrategy
  topK: number
  scoreThreshold: number
  filters: MetadataFilter[]
  rerank: RerankConfiguration
  contextTokenBudget: number
  generateAnswer: boolean
}

/** Strategy scores do not share a raw unit. Compare `normalized` only after reading the kind. */
export type RetrievalScore = {
  kind: "vector" | "keyword" | "hybrid" | "rerank"
  raw: number
  normalized: number
  vectorNormalized?: number
  keywordNormalized?: number
}

export type RetrievedChunk = {
  chunkId: string
  documentId: string
  documentName: string
  index: number
  content: string
  startOffset: number
  endOffset: number
  tokenCount: number
  metadata: Record<string, string>
  embeddingModel: string
  score: RetrievalScore
  rerankScore: RetrievalScore | null
  explanation: string
}

export type RetrievalResult = {
  rank: number
  chunk: RetrievedChunk
}

export type ContextAssembly = {
  tokenBudget: number
  tokensUsed: number
  chunkIds: string[]
  preview: string
  simulated: true
}

export type SourceCitation = {
  citationId: string
  chunkId: string
  documentId: string
  documentName: string
  index: number
  quote: string
}

export type GroundedAnswer = {
  text: string
  model: "orbit-small"
  citations: SourceCitation[]
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  estimatedCostUsd: number
  simulated: true
}

export type RetrievalTiming = {
  validationMs: number
  embeddingMs: number
  retrievalMs: number
  filterMs: number
  rerankMs: number
  assemblyMs: number
  generationMs: number
  totalMs: number
}

export type RetrievalTrace = {
  traceId: string
  requestId: string
  stages: { name: string; durationMs: number; skipped: boolean }[]
}

export type RetrievalResponse = {
  simulated: true
  workspaceId: string
  knowledgeBaseId: string
  requestId: string
  traceId: string
  strategy: RetrievalStrategy
  query: string
  notice: string
  results: RetrievalResult[]
  context: ContextAssembly
  answer: GroundedAnswer | null
  timing: RetrievalTiming
  trace: RetrievalTrace
}

export type RagConfigurationResponse = {
  simulated: true
  workspaceId: string
  configuration: RetrievalRequest
}

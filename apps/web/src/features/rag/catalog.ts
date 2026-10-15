import type { RetrievalRequest } from "@/features/rag/types"

export const ANSWER_MODEL = "orbit-small" as const
export const ANSWER_COST_PER_1K = 0.002
export const RERANKER_LABEL = "Orbit Rerank Mini"

export const emptyRetrievalRequest = (workspaceId: string): RetrievalRequest => ({
  workspaceId,
  knowledgeBaseId: "",
  query: "",
  strategy: "hybrid",
  topK: 4,
  scoreThreshold: 0.2,
  filters: [],
  rerank: { enabled: false, model: "orbit-rerank-mini" },
  contextTokenBudget: 800,
  generateAnswer: true,
})

export function estimateCost(totalTokens: number) {
  return Math.round((totalTokens / 1000) * ANSWER_COST_PER_1K * 1_000_000) / 1_000_000
}

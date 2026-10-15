import type { RetrievalRequest, RetrievalStrategy } from "@/features/rag/types"
import { isWorkspaceId } from "@/features/knowledge/validate"

const strategies = new Set<RetrievalStrategy>(["vector", "keyword", "hybrid"])

export function assessRetrievalRequest(input: RetrievalRequest): { ok: true; request: RetrievalRequest } | { ok: false; message: string } {
  if (!isWorkspaceId(input.workspaceId)) return { ok: false, message: "A workspace id is required." }
  if (!input.knowledgeBaseId?.trim()) return { ok: false, message: "Choose a knowledge base." }
  const query = typeof input.query === "string" ? input.query.trim() : ""
  if (query.length < 2 || query.length > 500) return { ok: false, message: "Enter a query between 2 and 500 characters." }
  if (!strategies.has(input.strategy)) return { ok: false, message: "Choose vector, keyword, or hybrid retrieval." }
  if (!Number.isInteger(input.topK) || input.topK < 1 || input.topK > 20) return { ok: false, message: "Top K must be an integer from 1 to 20." }
  if (typeof input.scoreThreshold !== "number" || input.scoreThreshold < 0 || input.scoreThreshold > 1) {
    return { ok: false, message: "The score threshold must be between 0 and 1." }
  }
  if (!Number.isInteger(input.contextTokenBudget) || input.contextTokenBudget < 64 || input.contextTokenBudget > 8192) {
    return { ok: false, message: "The context budget must be an integer from 64 to 8192." }
  }
  if (!input.rerank || (input.rerank.enabled && input.rerank.model !== "orbit-rerank-mini")) {
    return { ok: false, message: "Choose the simulated reranker." }
  }
  if (!Array.isArray(input.filters) || input.filters.length > 6) return { ok: false, message: "Use at most 6 metadata filters." }
  for (const filter of input.filters) {
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(filter.key)) return { ok: false, message: "Filter keys use lowercase letters, numbers, and underscores." }
    if (filter.op !== "eq" && filter.op !== "contains") return { ok: false, message: "Filters support equals or contains." }
    if (typeof filter.value !== "string" || filter.value.trim().length === 0 || filter.value.length > 80) {
      return { ok: false, message: "Enter a filter value." }
    }
  }
  return {
    ok: true,
    request: {
      ...input,
      query,
      filters: input.filters.map((filter) => ({ ...filter, value: filter.value.trim() })),
      rerank: { enabled: input.rerank.enabled, model: "orbit-rerank-mini" },
      generateAnswer: Boolean(input.generateAnswer),
    },
  }
}

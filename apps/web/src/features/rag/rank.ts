import type { RetrievalScore, RetrievalStrategy } from "@/features/rag/types"

export function tokenize(value: string) {
  return value.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []
}

export function roundScore(value: number) {
  return Math.round(value * 10_000) / 10_000
}

function bucket(token: string) {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 32
}

function buckets(text: string) {
  const counts = Array.from({ length: 32 }, () => 0)
  for (const token of tokenize(text)) counts[bucket(token)] += 1
  return counts
}

/** Simulated cosine in [0, 1]. This is not a keyword hit count. */
export function vectorSimilarity(query: string, content: string) {
  const left = buckets(query)
  const right = buckets(content)
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] * left[index]
    rightNorm += right[index] * right[index]
  }
  if (leftNorm === 0 || rightNorm === 0) return 0
  return roundScore(dot / Math.sqrt(leftNorm * rightNorm))
}

export function keywordOverlap(query: string, content: string) {
  const tokens = tokenize(query)
  if (tokens.length === 0) return { raw: 0, normalized: 0 }
  const haystack = content.toLowerCase()
  const raw = tokens.filter((token) => haystack.includes(token)).length
  return { raw, normalized: roundScore(raw / tokens.length) }
}

/** Coverage plus earlier match position. Independent of the retrieval score. */
export function rerankSimilarity(query: string, content: string) {
  const tokens = tokenize(query)
  if (tokens.length === 0 || content.length === 0) return 0
  const haystack = content.toLowerCase()
  let hits = 0
  let first = content.length
  for (const token of tokens) {
    const at = haystack.indexOf(token)
    if (at >= 0) {
      hits += 1
      first = Math.min(first, at)
    }
  }
  if (hits === 0) return 0
  const coverage = hits / tokens.length
  const position = 1 - first / content.length
  return roundScore(0.7 * coverage + 0.3 * position)
}

export function strategyScore(strategy: RetrievalStrategy, query: string, content: string): RetrievalScore {
  const vector = vectorSimilarity(query, content)
  const keyword = keywordOverlap(query, content)
  if (strategy === "vector") {
    return { kind: "vector", raw: vector, normalized: vector }
  }
  if (strategy === "keyword") {
    return { kind: "keyword", raw: keyword.raw, normalized: keyword.normalized }
  }
  const normalized = roundScore((vector + keyword.normalized) / 2)
  return {
    kind: "hybrid",
    raw: normalized,
    normalized,
    vectorNormalized: vector,
    keywordNormalized: keyword.normalized,
  }
}

export function explainScore(score: RetrievalScore) {
  if (score.kind === "vector") return "Simulated cosine over token buckets. This number is not a keyword count."
  if (score.kind === "keyword") return "Token overlap count, normalized by the number of query tokens."
  if (score.kind === "hybrid") return "Equal blend of the normalized vector score and the normalized keyword score."
  return "Simulated reranker score from coverage and match position."
}

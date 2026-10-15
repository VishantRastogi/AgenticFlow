import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createKnowledgeBase, uploadDocument } from "@/features/knowledge/api"
import type { KnowledgeBaseCreateRequest } from "@/features/knowledge/types"
import { getRagConfiguration, retrieve } from "@/features/rag/api"
import { RagStudioScreen } from "@/features/rag/rag-screen"
import type { RetrievalRequest } from "@/features/rag/types"
import { advanceIngestionJob } from "@/mocks/knowledge-store"
import { renderWithProviders } from "@/test/render"

const navigation = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/rag-studio",
}))

const settings: KnowledgeBaseCreateRequest["settings"] = {
  embeddingModel: "orbit-embed-small",
  chunkSize: 512,
  chunkOverlap: 64,
  retrieval: { topK: 4, scoreThreshold: 0.2 },
  metadataSchema: { source: "string" },
}

function request(knowledgeBaseId: string, overrides: Partial<RetrievalRequest> = {}): RetrievalRequest {
  return {
    workspaceId: "local",
    knowledgeBaseId,
    query: "simulated",
    strategy: "hybrid",
    topK: 4,
    scoreThreshold: 0,
    filters: [],
    rerank: { enabled: false, model: "orbit-rerank-mini" },
    contextTokenBudget: 800,
    generateAnswer: true,
    ...overrides,
  }
}

function finish(workspaceId: string, knowledgeBaseId: string, jobId: string) {
  let current = jobId
  let stage = "UPLOADED"
  for (let guard = 0; guard < 8 && stage !== "READY" && stage !== "FAILED"; guard += 1) {
    const next = advanceIngestionJob(workspaceId, knowledgeBaseId, current)
    if (!next.ok) throw new Error(next.message)
    current = next.job.id
    stage = next.job.stage
  }
  if (stage !== "READY") throw new Error(`Expected READY, received ${stage}`)
}

async function readyLibrary() {
  const created = await createKnowledgeBase({
    workspaceId: "local",
    name: "Handbook",
    description: "Support articles",
    settings,
  })
  const notes = await uploadDocument(created.knowledgeBase.id, {
    workspaceId: "local",
    name: "notes.md",
    mediaType: "text/markdown",
    sizeBytes: 24,
  })
  const guide = await uploadDocument(created.knowledgeBase.id, {
    workspaceId: "local",
    name: "guide.txt",
    mediaType: "text/plain",
    sizeBytes: 12,
  })
  finish("local", created.knowledgeBase.id, notes.job.id)
  finish("local", created.knowledgeBase.id, guide.job.id)
  return created.knowledgeBase
}

describe("retrieval API", () => {
  it("ranks ready chunks by strategy and keeps citations inside the result set", async () => {
    const base = await readyLibrary()
    const keywordNotes = await retrieve(request(base.id, { strategy: "keyword", query: "notes", topK: 1 }))
    const keywordGuide = await retrieve(request(base.id, { strategy: "keyword", query: "guide", topK: 1 }))
    expect(keywordNotes.results[0]?.chunk.documentName).toBe("notes.md")
    expect(keywordGuide.results[0]?.chunk.documentName).toBe("guide.txt")
    expect(keywordNotes.results[0]?.chunk.score.kind).toBe("keyword")
    expect(Number.isInteger(keywordNotes.results[0]?.chunk.score.raw)).toBe(true)

    const vectorNotes = await retrieve(request(base.id, { strategy: "vector", query: "notes" }))
    const vectorGuide = await retrieve(request(base.id, { strategy: "vector", query: "guide" }))
    const notesScore = (query: "notes" | "guide") =>
      (query === "notes" ? vectorNotes : vectorGuide).results.find((item) => item.chunk.documentName === "notes.md")?.chunk.score.normalized
    expect(notesScore("notes")).not.toBe(notesScore("guide"))
    expect(vectorNotes.results[0]?.chunk.score.kind).toBe("vector")

    const hybrid = await retrieve(request(base.id, { strategy: "hybrid", query: "notes" }))
    const hybridScore = hybrid.results[0]?.chunk.score
    expect(hybridScore?.kind).toBe("hybrid")
    expect(hybridScore?.normalized).toBeCloseTo(((hybridScore?.vectorNormalized ?? 0) + (hybridScore?.keywordNormalized ?? 0)) / 2)

    const limited = await retrieve(request(base.id, { topK: 1, scoreThreshold: 0 }))
    expect(limited.results).toHaveLength(1)
    const filtered = await retrieve(
      request(base.id, { query: "simulated", filters: [{ key: "filename", op: "eq", value: "notes.md" }] }),
    )
    expect(filtered.results.length).toBeGreaterThan(0)
    expect(filtered.results.every((item) => item.chunk.documentName === "notes.md")).toBe(true)
    const missed = await retrieve(request(base.id, { query: "zzzz", scoreThreshold: 0.99 }))
    expect(missed.results).toHaveLength(0)
    expect(missed.notice).toMatch(/score threshold/)

    const reranked = await retrieve(request(base.id, { rerank: { enabled: true, model: "orbit-rerank-mini" } }))
    expect(reranked.timing.rerankMs).toBeGreaterThan(0)
    expect(reranked.results.every((item) => item.chunk.rerankScore?.kind === "rerank")).toBe(true)
    const plain = await retrieve(request(base.id))
    expect(plain.timing.rerankMs).toBe(0)
    expect(plain.timing.embeddingMs).toBeGreaterThan(0)
    const keywordTiming = await retrieve(request(base.id, { strategy: "keyword" }))
    expect(keywordTiming.timing.embeddingMs).toBe(0)
    expect(keywordTiming.trace.stages.find((stage) => stage.name === "query_embedding")?.skipped).toBe(true)

    expect(plain.answer?.citations.every((citation) => plain.results.some((item) => item.chunk.chunkId === citation.chunkId))).toBe(true)
    expect(plain.answer?.citations.every((citation) => plain.context.chunkIds.includes(citation.chunkId))).toBe(true)
    const silent = await retrieve(request(base.id, { generateAnswer: false }))
    expect(silent.answer).toBeNull()
    expect(silent.results.length).toBeGreaterThan(0)

    const repeated = await retrieve(request(base.id, { query: "notes", strategy: "vector" }))
    expect(repeated.results.map((item) => item.chunk.score)).toEqual(vectorNotes.results.map((item) => item.chunk.score))
    expect(repeated.requestId).not.toBe(vectorNotes.requestId)

    const saved = await getRagConfiguration("local")
    expect(saved.configuration.query).toBe("notes")
    expect(saved.configuration.strategy).toBe("vector")
  })

  it("returns no invented chunks for empty or unfinished documents and hides other workspaces", async () => {
    const empty = await createKnowledgeBase({
      workspaceId: "local",
      name: "Empty shelf",
      description: "",
      settings,
    })
    const nothing = await retrieve(request(empty.knowledgeBase.id))
    expect(nothing.results).toHaveLength(0)
    expect(nothing.notice).toMatch(/did not invent/)
    expect(nothing.answer?.citations).toEqual([])

    const pending = await uploadDocument(empty.knowledgeBase.id, {
      workspaceId: "local",
      name: "draft.md",
      mediaType: "text/markdown",
      sizeBytes: 8,
    })
    expect(pending.document.status).toBe("UPLOADED")
    const unread = await retrieve(request(empty.knowledgeBase.id))
    expect(unread.results).toHaveLength(0)

    const other = await createKnowledgeBase({
      workspaceId: "other",
      name: "Other shelf",
      description: "",
      settings,
    })
    const foreign = await uploadDocument(other.knowledgeBase.id, {
      workspaceId: "other",
      name: "secret.md",
      mediaType: "text/markdown",
      sizeBytes: 10,
    })
    finish("other", other.knowledgeBase.id, foreign.job.id)
    await expect(retrieve(request(other.knowledgeBase.id))).rejects.toMatchObject({
      code: "not_found",
      message: "Knowledge base not found.",
    })
    const isolated = await retrieve(request(other.knowledgeBase.id, { workspaceId: "other", query: "secret" }))
    expect(isolated.results.every((item) => item.chunk.documentName === "secret.md")).toBe(true)

    await expect(retrieve(request(empty.knowledgeBase.id, { query: "x" }))).rejects.toMatchObject({
      code: "validation_error",
    })
    await expect(retrieve(request(empty.knowledgeBase.id, { query: "rate limit please" }))).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
    })
  })

  it("fails closed in real mode and leaves the mock configuration in place", async () => {
    const base = await readyLibrary()
    await retrieve(request(base.id, { query: "notes" }))
    const previousMode = process.env.NEXT_PUBLIC_API_MODE
    const previousUrl = process.env.NEXT_PUBLIC_API_URL
    process.env.NEXT_PUBLIC_API_MODE = "real"
    delete process.env.NEXT_PUBLIC_API_URL
    try {
      await expect(retrieve(request(base.id))).rejects.toMatchObject({
        code: "api_unavailable",
        message: expect.stringContaining("Mock mode was not used"),
      })
    } finally {
      if (previousMode === undefined) delete process.env.NEXT_PUBLIC_API_MODE
      else process.env.NEXT_PUBLIC_API_MODE = previousMode
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
      else process.env.NEXT_PUBLIC_API_URL = previousUrl
    }
    expect((await getRagConfiguration("local")).configuration.query).toBe("notes")
  })
})

describe("RAG studio screen", () => {
  beforeEach(() => {
    navigation.push.mockReset()
  })

  it("runs a simulated retrieval from the workspace form", async () => {
    const user = userEvent.setup()
    const base = await readyLibrary()
    renderWithProviders(<RagStudioScreen />)
    expect(await screen.findByRole("heading", { name: "RAG Studio" })).toBeInTheDocument()
    expect(screen.getByText(/do not call a model/i)).toBeInTheDocument()
    expect(await screen.findByRole("radiogroup", { name: "Retrieval strategy" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Configuration" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Inspector" })).toBeInTheDocument()

    expect(await screen.findByRole("option", { name: "Handbook" })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("Knowledge base"), base.id)
    await user.type(screen.getByLabelText("Search query"), "notes")
    await user.click(screen.getByRole("button", { name: "Run retrieval" }))
    expect(await screen.findByText(/Simulated retrieval/)).toBeInTheDocument()
    expect(screen.getAllByText(/notes\.md/).length).toBeGreaterThan(0)
    expect(screen.getByRole("region", { name: "Generated answer" })).toHaveTextContent(/not produced by a model/)

    await user.clear(screen.getByLabelText("Search query"))
    await user.click(screen.getByRole("button", { name: "Run retrieval" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a query between 2 and 500 characters.")
  })
})

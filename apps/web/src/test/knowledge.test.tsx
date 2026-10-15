import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/features/auth/api/errors"
import {
  cancelIngestionJob,
  createKnowledgeBase,
  deleteDocument,
  deleteKnowledgeBase,
  getDocument,
  getKnowledgeBase,
  listDocuments,
  listKnowledgeBases,
  reindexKnowledgeBase,
  retryDocument,
  updateKnowledgeBase,
  uploadDocument,
} from "@/features/knowledge/api"
import { advanceIngestionJob } from "@/mocks/knowledge-store"
import { KnowledgeCreateScreen } from "@/features/knowledge/create-screen"
import { KnowledgeDetailScreen } from "@/features/knowledge/detail-screen"
import { KnowledgeLibraryScreen } from "@/features/knowledge/library-screen"
import type { KnowledgeBaseCreateRequest, KnowledgeListParams } from "@/features/knowledge/types"
import { inspectFile } from "@/features/knowledge/validate"
import { renderWithProviders } from "@/test/render"

const navigation = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/knowledge-bases",
}))

const settings: KnowledgeBaseCreateRequest["settings"] = {
  embeddingModel: "orbit-embed-small",
  chunkSize: 512,
  chunkOverlap: 64,
  retrieval: { topK: 4, scoreThreshold: 0.2 },
  metadataSchema: { source: "string" },
}

function listParams(overrides: Partial<KnowledgeListParams> = {}): KnowledgeListParams {
  return { workspaceId: "local", q: "", status: "all", model: "all", sort: "updated", page: 1, ...overrides }
}

function createInput(overrides: Partial<KnowledgeBaseCreateRequest> = {}): KnowledgeBaseCreateRequest {
  return { workspaceId: "local", name: "Handbook", description: "Support articles", settings, ...overrides }
}

function advance(workspaceId: string, knowledgeBaseId: string, jobId: string) {
  let current = jobId
  let stage = "UPLOADED"
  for (let guard = 0; guard < 8 && stage !== "READY" && stage !== "FAILED"; guard += 1) {
    const next = advanceIngestionJob(workspaceId, knowledgeBaseId, current)
    if (!next.ok) throw new Error(next.message)
    current = next.job.id
    stage = next.job.stage
    if (stage === "FAILED" || stage === "READY") return next
  }
  throw new Error(`Ingestion did not finish from ${stage}`)
}

describe("knowledge base API", () => {
  it("creates, updates, filters, paginates, and keeps counts aligned", async () => {
    const created = await createKnowledgeBase(createInput())
    const renamed = await updateKnowledgeBase("local", created.knowledgeBase.id, {
      name: "Handbook revised",
      description: "Support articles",
      settings,
    })
    expect(renamed.knowledgeBase.name).toBe("Handbook revised")
    expect(renamed.knowledgeBase.documentCount).toBe(0)
    expect(renamed.knowledgeBase.storageBytes).toBe(0)

    await expect(createKnowledgeBase(createInput({ name: "handbook revised" }))).rejects.toMatchObject({
      code: "duplicate_name",
      status: 409,
      message: "A knowledge base with this name already exists in this workspace.",
    })
    await expect(
      createKnowledgeBase(createInput({ settings: { ...settings, embeddingModel: "foreign-embed" as "orbit-embed-small" } })),
    ).rejects.toMatchObject({ message: "Choose a simulated embedding model." })
    await expect(
      createKnowledgeBase(createInput({ name: "Overlap", settings: { ...settings, chunkSize: 128, chunkOverlap: 128 } })),
    ).rejects.toMatchObject({ message: "Overlap must be smaller than the chunk size." })

    const uploaded = await uploadDocument(created.knowledgeBase.id, {
      workspaceId: "local",
      name: "notes.md",
      mediaType: "text/markdown",
      sizeBytes: 24,
    })
    const second = await uploadDocument(created.knowledgeBase.id, {
      workspaceId: "local",
      name: "guide.txt",
      mediaType: "text/plain",
      sizeBytes: 8,
    })
    const detail = await getKnowledgeBase("local", created.knowledgeBase.id)
    expect(detail.knowledgeBase.documentCount).toBe(2)
    expect(detail.knowledgeBase.storageBytes).toBe(32)
    expect(detail.knowledgeBase.ingestionStatus).toBe("processing")

    await deleteDocument("local", created.knowledgeBase.id, second.document.id)
    const afterDelete = await getKnowledgeBase("local", created.knowledgeBase.id)
    expect(afterDelete.knowledgeBase.documentCount).toBe(1)
    expect(afterDelete.knowledgeBase.storageBytes).toBe(24)
    await expect(getDocument("local", created.knowledgeBase.id, second.document.id)).rejects.toBeInstanceOf(ApiError)

    const before = await getDocument("local", created.knowledgeBase.id, uploaded.document.id)
    expect(before.document.status).toBe("UPLOADED")
    const still = await getDocument("local", created.knowledgeBase.id, uploaded.document.id)
    expect(still.document.status).toBe("UPLOADED")
    expect(still.job.updatedAt).toBe(before.job.updatedAt)

    const finished = await advance("local", created.knowledgeBase.id, uploaded.job.id)
    expect(finished.job.stage).toBe("READY")
    expect(finished.job.durationMs).toBe(2100)
    const again = advanceIngestionJob("local", created.knowledgeBase.id, finished.job.id)
    if (!again.ok) throw new Error(again.message)
    expect(again.job.durationMs).toBe(2100)
    const preview = await getDocument("local", created.knowledgeBase.id, uploaded.document.id)
    expect(preview.document.extractedText).toContain("not parsed from the file")
    expect(preview.chunks[0]?.content).toContain("Embeddings were not computed.")
    expect(preview.simulated).toBe(true)

    const listed = await listKnowledgeBases(listParams({ q: "revised" }))
    expect(listed.total).toBe(1)
    const repeated = await listKnowledgeBases(listParams({ q: "revised" }))
    expect(repeated.items[0]).toEqual(listed.items[0])

    await deleteKnowledgeBase("local", created.knowledgeBase.id)
    await expect(getDocument("local", created.knowledgeBase.id, uploaded.document.id)).rejects.toMatchObject({
      code: "not_found",
      message: "Document not found.",
    })
    expect((await listKnowledgeBases(listParams())).total).toBe(0)
  })

  it("paginates and filters a larger collection", async () => {
    for (let index = 0; index < 7; index += 1) {
      await createKnowledgeBase(
        createInput({
          name: `Collection ${index}`,
          settings: { ...settings, embeddingModel: index === 0 ? "orbit-embed-large" : "orbit-embed-small" },
        }),
      )
    }
    const first = await listKnowledgeBases(listParams())
    const second = await listKnowledgeBases(listParams({ page: 2 }))
    expect(first.total).toBe(7)
    expect(first.items).toHaveLength(6)
    expect(second.items).toHaveLength(1)
    const large = await listKnowledgeBases(listParams({ model: "orbit-embed-large" }))
    expect(large.total).toBe(1)
    expect(large.items[0]?.settings.embeddingModel).toBe("orbit-embed-large")
  })

  it("keeps workspaces apart and preserves a failed upload", async () => {
    const other = await createKnowledgeBase(createInput({ workspaceId: "other", name: "Other handbook" }))
    expect((await listKnowledgeBases(listParams())).total).toBe(0)
    await expect(getKnowledgeBase("local", other.knowledgeBase.id)).rejects.toMatchObject({
      code: "not_found",
      message: "Knowledge base not found.",
    })
    expect((await listKnowledgeBases(listParams({ workspaceId: "other" }))).items[0]?.id).toBe(other.knowledgeBase.id)

    const local = await createKnowledgeBase(createInput())
    await expect(
      uploadDocument(local.knowledgeBase.id, {
        workspaceId: "local",
        name: "empty.md",
        mediaType: "text/markdown",
        sizeBytes: 0,
      }),
    ).rejects.toMatchObject({ message: "empty.md is empty." })
    await expect(
      uploadDocument(local.knowledgeBase.id, {
        workspaceId: "local",
        name: "big.pdf",
        mediaType: "application/pdf",
        sizeBytes: 5_000_001,
      }),
    ).rejects.toMatchObject({ code: "file_too_large", status: 413, message: "big.pdf is larger than 5 MB." })
    await expect(
      uploadDocument(local.knowledgeBase.id, {
        workspaceId: "local",
        name: "photo.png",
        mediaType: "text/plain",
        sizeBytes: 10,
      }),
    ).rejects.toMatchObject({
      code: "invalid_file_type",
      status: 415,
      message: "photo.png is not a supported type. Use PDF, DOCX, TXT, or Markdown.",
    })
    await expect(
      uploadDocument(local.knowledgeBase.id, {
        workspaceId: "local",
        name: "fail-upload.md",
        mediaType: "text/markdown",
        sizeBytes: 12,
      }),
    ).rejects.toMatchObject({ message: "The simulated upload was rejected. The file was not stored." })
    expect((await listDocuments(local.knowledgeBase.id, { workspaceId: "local", q: "", status: "all", page: 1 })).total).toBe(0)
  })

  it("retries a failed ingestion as a new attempt and cancels a running job", async () => {
    const base = await createKnowledgeBase(createInput())
    const failed = await uploadDocument(base.knowledgeBase.id, {
      workspaceId: "local",
      name: "fail-once.md",
      mediaType: "text/markdown",
      sizeBytes: 20,
    })
    const first = await advance("local", base.knowledgeBase.id, failed.job.id)
    expect(first.job.stage).toBe("FAILED")
    expect(first.job.error).toMatch(/first attempt/)
    expect(first.document.extractedText).toContain("not parsed")

    const retried = await retryDocument("local", base.knowledgeBase.id, failed.document.id)
    expect(retried.job.attempt).toBe(2)
    expect(retried.job.stage).toBe("QUEUED")
    expect(retried.job.id).not.toBe(failed.job.id)
    const done = await advance("local", base.knowledgeBase.id, retried.job.id)
    expect(done.job.stage).toBe("READY")
    const detail = await getDocument("local", base.knowledgeBase.id, failed.document.id)
    expect(detail.jobs.map((job) => job.attempt)).toEqual([1, 2])
    expect(detail.chunks.length).toBeGreaterThan(0)

    const running = await uploadDocument(base.knowledgeBase.id, {
      workspaceId: "local",
      name: "pause.md",
      mediaType: "text/markdown",
      sizeBytes: 10,
    })
    const cancelled = await cancelIngestionJob("local", base.knowledgeBase.id, running.job.id)
    expect(cancelled.job.cancelled).toBe(true)
    expect(cancelled.job.stage).toBe("FAILED")
    const secondCancel = await cancelIngestionJob("local", base.knowledgeBase.id, running.job.id)
    expect(secondCancel.job.updatedAt).toBe(cancelled.job.updatedAt)

    const parseFail = await uploadDocument(base.knowledgeBase.id, {
      workspaceId: "local",
      name: "fail-parse.txt",
      mediaType: "text/plain",
      sizeBytes: 4,
    })
    const parsed = await advance("local", base.knowledgeBase.id, parseFail.job.id)
    expect(parsed.job.failedStage).toBe("PARSING")
    expect(parsed.job.errorCode).toBe("processing_failed")
    expect(parsed.document.extractedText).toBe("")

    await expect(retryDocument("local", base.knowledgeBase.id, failed.document.id)).rejects.toMatchObject({
      code: "invalid_job_transition",
      status: 409,
    })
    const saved = base.knowledgeBase.settings
    const changed = await updateKnowledgeBase("local", base.knowledgeBase.id, {
      name: base.knowledgeBase.name,
      description: base.knowledgeBase.description,
      settings: { ...saved, chunkSize: 256 },
    })
    expect(changed.knowledgeBase.reindexRequired).toBe(true)
    const blocker = await uploadDocument(base.knowledgeBase.id, {
      workspaceId: "local",
      name: "hold.md",
      mediaType: "text/markdown",
      sizeBytes: 6,
    })
    expect(blocker.document.status).toBe("UPLOADED")
    await expect(reindexKnowledgeBase("local", base.knowledgeBase.id)).rejects.toMatchObject({
      code: "invalid_job_transition",
      status: 409,
    })
    await deleteDocument("local", base.knowledgeBase.id, blocker.document.id)
    await deleteDocument("local", base.knowledgeBase.id, running.document.id)
    await deleteDocument("local", base.knowledgeBase.id, parseFail.document.id)
    const reindexed = await reindexKnowledgeBase("local", base.knowledgeBase.id)
    expect(reindexed.jobs).toHaveLength(1)
    expect(reindexed.jobs[0]?.id).not.toBe(done.job.id)
    expect(reindexed.jobs[0]?.attempt).toBe(3)
    expect(reindexed.jobs[0]?.stage).toBe("QUEUED")
  })

  it("rejects an unavailable real knowledge API without reading the mock store", async () => {
    const created = await createKnowledgeBase(createInput({ name: "Kept" }))
    const previousMode = process.env.NEXT_PUBLIC_API_MODE
    const previousUrl = process.env.NEXT_PUBLIC_API_URL
    process.env.NEXT_PUBLIC_API_MODE = "real"
    delete process.env.NEXT_PUBLIC_API_URL
    try {
      await expect(listKnowledgeBases(listParams())).rejects.toMatchObject({
        code: "api_unavailable",
        message: expect.stringContaining("Mock mode was not used"),
      })
    } finally {
      if (previousMode === undefined) delete process.env.NEXT_PUBLIC_API_MODE
      else process.env.NEXT_PUBLIC_API_MODE = previousMode
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
      else process.env.NEXT_PUBLIC_API_URL = previousUrl
    }
    const listed = await listKnowledgeBases(listParams())
    expect(listed.items.some((item) => item.id === created.knowledgeBase.id)).toBe(true)
  })

  it("rejects unsupported files before upload", () => {
    expect(inspectFile({ name: "photo.png", size: 10, type: "image/png" }).ok).toBe(false)
    expect(inspectFile({ name: "big.pdf", size: 5_000_001, type: "application/pdf" })).toMatchObject({
      message: "big.pdf is larger than 5 MB.",
    })
    expect(inspectFile({ name: "empty.md", size: 0, type: "text/markdown" })).toMatchObject({
      message: "empty.md is empty.",
    })
    expect(inspectFile({ name: "notes.md", size: 12, type: "" }).ok).toBe(true)
  })
})

describe("knowledge base screens", () => {
  beforeEach(() => {
    navigation.push.mockReset()
  })

  it("validates the form, then creates, renames, and deletes a knowledge base", async () => {
    const user = userEvent.setup()
    const { unmount } = renderWithProviders(<KnowledgeCreateScreen />)
    await user.click(screen.getByRole("button", { name: "Create knowledge base" }))
    expect(screen.getByText("Enter a name.")).toBeInTheDocument()

    await user.clear(screen.getByLabelText("Chunk overlap"))
    await user.type(screen.getByLabelText("Chunk overlap"), "512")
    await user.type(screen.getByLabelText("Name"), "Handbook")
    await user.click(screen.getByRole("button", { name: "Create knowledge base" }))
    expect(screen.getByText("Overlap must be smaller than the chunk size.")).toBeInTheDocument()

    await user.clear(screen.getByLabelText("Chunk overlap"))
    await user.type(screen.getByLabelText("Chunk overlap"), "64")
    await user.click(screen.getByRole("button", { name: "Create knowledge base" }))
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith("/knowledge-bases/kb_1")
    })
    unmount()

    renderWithProviders(<KnowledgeLibraryScreen />)
    expect(await screen.findByRole("link", { name: "Handbook" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Rename Handbook" }))
    const dialog = await screen.findByRole("dialog")
    await user.clear(screen.getByLabelText("Name"))
    await user.type(screen.getByLabelText("Name"), "Field notes")
    await user.click(screen.getByRole("button", { name: "Save name" }))
    expect(await screen.findByRole("link", { name: "Field notes" })).toBeInTheDocument()
    expect(dialog).not.toBeNull()

    await user.click(screen.getByRole("radio", { name: "Table" }))
    expect(screen.getByRole("table", { name: "Knowledge bases" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Delete Field notes" }))
    await user.click(screen.getByRole("button", { name: "Delete knowledge base" }))
    expect(await screen.findByText("No knowledge bases in this workspace yet.")).toBeInTheDocument()
  })

  it("uploads several documents and reports type, size, and upload failures", async () => {
    const user = userEvent.setup()
    const created = await createKnowledgeBase(createInput())
    renderWithProviders(<KnowledgeDetailScreen knowledgeBaseId={created.knowledgeBase.id} />)
    expect(await screen.findByRole("heading", { name: "Handbook" })).toBeInTheDocument()
    expect(screen.getByText(/no embeddings are computed/i)).toBeInTheDocument()

    const markdown = new File(["# notes"], "notes.md", { type: "text/markdown" })
    const text = new File(["hello"], "guide.txt", { type: "text/plain" })
    await user.upload(screen.getByLabelText("Upload documents"), [markdown, text])
    expect(await screen.findByRole("link", { name: "notes.md" })).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "guide.txt" })).toBeInTheDocument()
    expect(screen.getAllByText(/Upload 100%/)).toHaveLength(2)
    expect(screen.getAllByText(/Ingestion has not parsed the file/)).toHaveLength(2)
  })
})

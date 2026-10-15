import type { ApiErrorCode } from "@/features/auth/types"
import { DOCUMENT_PAGE_SIZE, KNOWLEDGE_PAGE_SIZE, stageDurationMs } from "@/features/knowledge/catalog"
import type {
  ActiveIngestionStage,
  DocumentChunk,
  DocumentDetail,
  DocumentListParams,
  DocumentListResponse,
  DocumentRecord,
  DocumentUploadRequest,
  DocumentUploadResponse,
  IngestionJob,
  IngestionRollup,
  IngestionStage,
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseDetail,
  KnowledgeBaseListResponse,
  KnowledgeBaseSettings,
  KnowledgeBaseUpdateRequest,
  KnowledgeListParams,
  MetadataSchema,
  ReindexResponse,
} from "@/features/knowledge/types"
import { isTerminalStage } from "@/features/knowledge/types"
import { assessKnowledgeRequest, extensionOf, isWorkspaceId, mediaTypeFor } from "@/features/knowledge/validate"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"

const STORAGE_KEY = "agentflow-mock-knowledge"
const MAX_DOCUMENT_BYTES = 5_000_000

const stageOrder: ActiveIngestionStage[] = ["UPLOADED", "QUEUED", "PARSING", "CHUNKING", "EMBEDDING", "INDEXING", "READY"]

type StoredBase = {
  id: string
  workspaceId: string
  name: string
  description: string
  settings: KnowledgeBaseSettings
  indexedFingerprint: string | null
  createdAt: string
  updatedAt: string
}

type Database = {
  sequence: number
  bases: StoredBase[]
  documents: DocumentRecord[]
  jobs: IngestionJob[]
  chunks: DocumentChunk[]
}

export type StoreFailure = {
  ok: false
  status: number
  code: ApiErrorCode
  message: string
}

function emptyDatabase(): Database {
  return { sequence: 1, bases: [], documents: [], jobs: [], chunks: [] }
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
    if (!parsed || typeof parsed.sequence !== "number" || !Array.isArray(parsed.bases) || !Array.isArray(parsed.documents)) {
      const seeded = emptyDatabase()
      writeDatabase(seeded)
      return seeded
    }
    parsed.jobs ??= []
    parsed.chunks ??= []
    for (const base of parsed.bases) base.indexedFingerprint ??= null
    for (const job of parsed.jobs) job.errorCode ??= null
    for (const chunk of parsed.chunks) {
      chunk.startOffset ??= 0
      chunk.endOffset ??= 0
    }
    return parsed
  } catch {
    const seeded = emptyDatabase()
    writeDatabase(seeded)
    return seeded
  }
}

function writeDatabase(database: Database) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
}

function stamp(sequence: number) {
  return new Date(Date.parse(SIMULATED_NOW) - (800 - sequence) * 1000).toISOString()
}

function nextId(database: Database, prefix: string) {
  const id = `${prefix}_${database.sequence}`
  database.sequence += 1
  return id
}

function copy<T>(value: T): T {
  return structuredClone(value)
}

function failure(status: number, code: StoreFailure["code"], message: string): StoreFailure {
  return { ok: false, status, code, message }
}

function rollup(documents: DocumentRecord[]): IngestionRollup {
  if (documents.length === 0) return "empty"
  if (documents.some((document) => !isTerminalStage(document.status))) return "processing"
  if (documents.some((document) => document.status === "FAILED")) return "attention"
  return "ready"
}

function presentBase(database: Database, base: StoredBase): KnowledgeBase {
  const documents = database.documents.filter(
    (document) => document.knowledgeBaseId === base.id && document.workspaceId === base.workspaceId,
  )
  return {
    id: base.id,
    workspaceId: base.workspaceId,
    name: base.name,
    description: base.description,
    settings: copy(base.settings),
    documentCount: documents.length,
    storageBytes: documents.reduce((sum, document) => sum + document.sizeBytes, 0),
    ingestionStatus: rollup(documents),
    reindexRequired: (base.indexedFingerprint ?? null) !== null && base.indexedFingerprint !== indexFingerprint(base.settings),
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    simulated: true,
  }
}

function findBase(database: Database, workspaceId: string, id: string) {
  return database.bases.find((base) => base.id === id && base.workspaceId === workspaceId) ?? null
}

function requireWorkspace(workspaceId: string): StoreFailure | null {
  if (!isWorkspaceId(workspaceId)) return failure(400, "validation_error", "A workspace id is required.")
  return null
}

function namesMatch(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
}

function indexFingerprint(settings: KnowledgeBaseSettings) {
  return JSON.stringify({
    embeddingModel: settings.embeddingModel,
    chunkSize: settings.chunkSize,
    chunkOverlap: settings.chunkOverlap,
  })
}

function progressFor(stage: ActiveIngestionStage) {
  return Math.round((stageOrder.indexOf(stage) / (stageOrder.length - 1)) * 100)
}

function nextStage(stage: IngestionStage): ActiveIngestionStage | null {
  if (stage === "FAILED" || stage === "READY") return null
  const index = stageOrder.indexOf(stage)
  return stageOrder[index + 1] ?? null
}

function metadataFor(schema: MetadataSchema, name: string, mediaType: string) {
  const fields = Object.entries(schema).map(([key, kind]) => {
    if (kind === "number") return [key, "1"] as const
    if (kind === "boolean") return [key, "true"] as const
    return [key, "simulated"] as const
  })
  return Object.fromEntries([...fields, ["filename", name], ["mediaType", mediaType]])
}

function buildExtract(document: DocumentRecord, settings: KnowledgeBaseSettings) {
  return `Simulated extract of ${document.name}. This text was not parsed from the file. The mock ingestion service recorded ${document.sizeBytes} bytes for ${settings.embeddingModel}.`
}

function writeChunks(database: Database, document: DocumentRecord, settings: KnowledgeBaseSettings) {
  database.chunks = database.chunks.filter((chunk) => chunk.documentId !== document.id)
  const size = settings.chunkSize
  const step = Math.max(1, size - settings.chunkOverlap)
  const windows: string[] = []
  const extract = document.extractedText
  if (!extract) windows.push("")
  else {
    for (let start = 0; start < extract.length; start += step) {
      windows.push(extract.slice(start, start + size))
      if (start + size >= extract.length) break
    }
  }
  let start = 0
  windows.slice(0, 12).forEach((content, index) => {
    const end = start + content.length
    database.chunks.push({
      id: nextId(database, "chk"),
      documentId: document.id,
      index,
      content: `${content} Simulated chunk ${index + 1}. Embeddings were not computed.`,
      tokenCount: Math.max(1, Math.round(content.length / 4)),
      startOffset: start,
      endOffset: end,
      metadata: { ...document.metadata, chunk: String(index + 1) },
      simulated: true,
    })
    start += step
  })
}

function failureFor(name: string, stage: ActiveIngestionStage, attempt: number) {
  const lowered = name.toLowerCase()
  if (stage === "PARSING" && lowered.includes("fail-parse")) {
    return "Simulated parser could not read this file. No text was extracted."
  }
  if (stage === "EMBEDDING" && lowered.includes("fail-once") && attempt === 1) {
    return "Simulated embedding failed on the first attempt. Retry to continue. No vectors were written."
  }
  return null
}

function syncDocument(document: DocumentRecord, job: IngestionJob, at: string) {
  document.jobId = job.id
  document.status = job.stage
  document.progress = job.progress
  document.attempt = job.attempt
  document.error = job.error
  document.updatedAt = at
}

function touchBase(base: StoredBase, at: string) {
  base.updatedAt = at
}

export function listKnowledgeBases(params: KnowledgeListParams): KnowledgeBaseListResponse {
  const database = readDatabase()
  const query = params.q.trim().toLocaleLowerCase()
  const items = database.bases
    .filter((base) => base.workspaceId === params.workspaceId)
    .map((base) => presentBase(database, base))
    .filter((base) => (params.status === "all" ? true : base.ingestionStatus === params.status))
    .filter((base) => (params.model === "all" ? true : base.settings.embeddingModel === params.model))
    .filter((base) => (query ? `${base.name} ${base.description}`.toLocaleLowerCase().includes(query) : true))
    .sort((left, right) => {
      if (params.sort === "name") return left.name.localeCompare(right.name)
      if (params.sort === "documents") return right.documentCount - left.documentCount || left.name.localeCompare(right.name)
      if (params.sort === "storage") return right.storageBytes - left.storageBytes || left.name.localeCompare(right.name)
      return right.updatedAt.localeCompare(left.updatedAt)
    })
  const start = (params.page - 1) * KNOWLEDGE_PAGE_SIZE
  return {
    simulated: true,
    workspaceId: params.workspaceId,
    page: params.page,
    pageSize: KNOWLEDGE_PAGE_SIZE,
    total: items.length,
    items: items.slice(start, start + KNOWLEDGE_PAGE_SIZE),
  }
}

export function getKnowledgeBase(workspaceId: string, id: string): KnowledgeBaseDetail | StoreFailure {
  const invalid = requireWorkspace(workspaceId)
  if (invalid) return invalid
  const database = readDatabase()
  const base = findBase(database, workspaceId, id)
  if (!base) return failure(404, "not_found", "Knowledge base not found.")
  const activeJobs = database.jobs.filter(
    (job) => job.knowledgeBaseId === id && job.workspaceId === workspaceId && !isTerminalStage(job.stage),
  )
  return { simulated: true, knowledgeBase: presentBase(database, base), activeJobs: copy(activeJobs) }
}

export function createKnowledgeBase(input: KnowledgeBaseCreateRequest): { ok: true; knowledgeBase: KnowledgeBase } | StoreFailure {
  const invalid = requireWorkspace(input.workspaceId)
  if (invalid) return invalid
  const assessed = assessKnowledgeRequest(input)
  if (!assessed.ok) return failure(400, "validation_error", assessed.message)
  const database = readDatabase()
  const duplicate = database.bases.some(
    (base) => base.workspaceId === input.workspaceId && namesMatch(base.name, assessed.name),
  )
  if (duplicate) return failure(409, "duplicate_name", "A knowledge base with this name already exists in this workspace.")
  const at = stamp(database.sequence)
  const base: StoredBase = {
    id: nextId(database, "kb"),
    workspaceId: input.workspaceId,
    name: assessed.name,
    description: assessed.description,
    settings: assessed.settings,
    indexedFingerprint: null,
    createdAt: at,
    updatedAt: at,
  }
  database.bases.push(base)
  writeDatabase(database)
  return { ok: true, knowledgeBase: presentBase(database, base) }
}

export function updateKnowledgeBase(
  workspaceId: string,
  id: string,
  input: KnowledgeBaseUpdateRequest,
): { ok: true; knowledgeBase: KnowledgeBase } | StoreFailure {
  const invalid = requireWorkspace(workspaceId)
  if (invalid) return invalid
  const assessed = assessKnowledgeRequest(input)
  if (!assessed.ok) return failure(400, "validation_error", assessed.message)
  const database = readDatabase()
  const base = findBase(database, workspaceId, id)
  if (!base) return failure(404, "not_found", "Knowledge base not found.")
  const duplicate = database.bases.some(
    (item) => item.workspaceId === workspaceId && item.id !== id && namesMatch(item.name, assessed.name),
  )
  if (duplicate) return failure(409, "duplicate_name", "A knowledge base with this name already exists in this workspace.")
  base.name = assessed.name
  base.description = assessed.description
  base.settings = assessed.settings
  base.updatedAt = stamp(database.sequence)
  database.sequence += 1
  writeDatabase(database)
  return { ok: true, knowledgeBase: presentBase(database, base) }
}

export function deleteKnowledgeBase(workspaceId: string, id: string): { ok: true } | StoreFailure {
  const invalid = requireWorkspace(workspaceId)
  if (invalid) return invalid
  const database = readDatabase()
  const base = findBase(database, workspaceId, id)
  if (!base) return failure(404, "not_found", "Knowledge base not found.")
  const documentIds = new Set(
    database.documents.filter((document) => document.knowledgeBaseId === id).map((document) => document.id),
  )
  database.bases = database.bases.filter((item) => item.id !== id)
  database.documents = database.documents.filter((document) => document.knowledgeBaseId !== id)
  database.jobs = database.jobs.filter((job) => job.knowledgeBaseId !== id)
  database.chunks = database.chunks.filter((chunk) => !documentIds.has(chunk.documentId))
  writeDatabase(database)
  return { ok: true }
}

export function listDocuments(knowledgeBaseId: string, params: DocumentListParams): DocumentListResponse | StoreFailure {
  const invalid = requireWorkspace(params.workspaceId)
  if (invalid) return invalid
  const database = readDatabase()
  const base = findBase(database, params.workspaceId, knowledgeBaseId)
  if (!base) return failure(404, "not_found", "Knowledge base not found.")
  const query = params.q.trim().toLocaleLowerCase()
  const items = database.documents
    .filter((document) => document.knowledgeBaseId === knowledgeBaseId && document.workspaceId === params.workspaceId)
    .filter((document) => (params.status === "all" ? true : document.status === params.status))
    .filter((document) => (query ? document.name.toLocaleLowerCase().includes(query) : true))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const start = (params.page - 1) * DOCUMENT_PAGE_SIZE
  return {
    simulated: true,
    workspaceId: params.workspaceId,
    knowledgeBaseId,
    page: params.page,
    pageSize: DOCUMENT_PAGE_SIZE,
    total: items.length,
    items: copy(items.slice(start, start + DOCUMENT_PAGE_SIZE)),
  }
}

export function getDocument(workspaceId: string, knowledgeBaseId: string, documentId: string): DocumentDetail | StoreFailure {
  const invalid = requireWorkspace(workspaceId)
  if (invalid) return invalid
  const database = readDatabase()
  const document = database.documents.find(
    (item) => item.id === documentId && item.knowledgeBaseId === knowledgeBaseId && item.workspaceId === workspaceId,
  )
  if (!document) return failure(404, "not_found", "Document not found.")
  const jobs = database.jobs
    .filter((job) => job.documentId === documentId && job.workspaceId === workspaceId)
    .sort((left, right) => left.attempt - right.attempt)
  const job = jobs.find((item) => item.id === document.jobId) ?? jobs[jobs.length - 1]
  if (!job) return failure(404, "not_found", "Ingestion job not found.")
  const chunks = database.chunks
    .filter((chunk) => chunk.documentId === documentId)
    .sort((left, right) => left.index - right.index)
  return { simulated: true, document: copy(document), job: copy(job), jobs: copy(jobs), chunks: copy(chunks) }
}

export function uploadDocument(
  knowledgeBaseId: string,
  input: DocumentUploadRequest,
): DocumentUploadResponse | StoreFailure {
  const invalid = requireWorkspace(input.workspaceId)
  if (invalid) return invalid
  if (typeof input.name !== "string" || !input.name.trim()) return failure(400, "validation_error", "Enter a file name.")
  if (typeof input.sizeBytes !== "number" || input.sizeBytes <= 0) return failure(400, "validation_error", `${input.name} is empty.`)
  if (input.sizeBytes > MAX_DOCUMENT_BYTES) return failure(413, "file_too_large", `${input.name} is larger than 5 MB.`)
  const extension = extensionOf(input.name)
  if (!extension || mediaTypeFor(extension) !== input.mediaType) {
    return failure(415, "invalid_file_type", `${input.name} is not a supported type. Use PDF, DOCX, TXT, or Markdown.`)
  }
  if (input.name.toLowerCase().includes("rate-limit")) {
    return failure(429, "rate_limited", "The knowledge service applied a rate limit. Wait and retry this upload.")
  }
  if (input.name.toLowerCase().includes("fail-upload")) {
    return failure(502, "processing_failed", "The simulated upload was rejected. The file was not stored.")
  }
  const database = readDatabase()
  const base = findBase(database, input.workspaceId, knowledgeBaseId)
  if (!base) return failure(404, "not_found", "Knowledge base not found.")
  const at = stamp(database.sequence)
  const documentId = nextId(database, "doc")
  const jobId = nextId(database, "job")
  const job: IngestionJob = {
    id: jobId,
    workspaceId: input.workspaceId,
    knowledgeBaseId,
    documentId,
    attempt: 1,
    stage: "UPLOADED",
    failedStage: null,
    progress: 0,
    durationMs: 0,
    error: null,
    errorCode: null,
    cancelled: false,
    startedAt: at,
    updatedAt: at,
    simulated: true,
  }
  const document: DocumentRecord = {
    id: documentId,
    workspaceId: input.workspaceId,
    knowledgeBaseId,
    jobId,
    name: input.name.trim(),
    extension,
    mediaType: input.mediaType,
    sizeBytes: input.sizeBytes,
    status: "UPLOADED",
    progress: 0,
    attempt: 1,
    error: null,
    extractedText: "",
    metadata: metadataFor(base.settings.metadataSchema, input.name.trim(), input.mediaType),
    createdAt: at,
    updatedAt: at,
    simulated: true,
  }
  const sessionId = nextId(database, "upl")
  database.jobs.push(job)
  database.documents.push(document)
  touchBase(base, at)
  writeDatabase(database)
  return {
    simulated: true,
    document: copy(document),
    job: copy(job),
    session: {
      id: sessionId,
      workspaceId: input.workspaceId,
      knowledgeBaseId,
      name: document.name,
      mediaType: document.mediaType,
      sizeBytes: document.sizeBytes,
      status: "completed",
      uploadUrl: null,
      expiresAt: null,
      simulated: true,
    },
  }
}

export function deleteDocument(workspaceId: string, knowledgeBaseId: string, documentId: string): { ok: true } | StoreFailure {
  const invalid = requireWorkspace(workspaceId)
  if (invalid) return invalid
  const database = readDatabase()
  const document = database.documents.find(
    (item) => item.id === documentId && item.knowledgeBaseId === knowledgeBaseId && item.workspaceId === workspaceId,
  )
  if (!document) return failure(404, "not_found", "Document not found.")
  const base = findBase(database, workspaceId, knowledgeBaseId)
  database.documents = database.documents.filter((item) => item.id !== documentId)
  database.jobs = database.jobs.filter((job) => job.documentId !== documentId)
  database.chunks = database.chunks.filter((chunk) => chunk.documentId !== documentId)
  if (base) touchBase(base, stamp(database.sequence))
  database.sequence += 1
  writeDatabase(database)
  return { ok: true }
}

function currentJobs(database: Database) {
  return database.jobs.filter((job) => {
    const document = database.documents.find((item) => item.id === job.documentId && item.workspaceId === job.workspaceId)
    return Boolean(document && document.jobId === job.id && job.stage !== "READY" && job.stage !== "FAILED")
  })
}

function stepJob(database: Database, job: IngestionJob) {
  const document = database.documents.find((item) => item.id === job.documentId)
  const base = findBase(database, job.workspaceId, job.knowledgeBaseId)
  if (!document || !base || document.jobId !== job.id || job.stage === "READY" || job.stage === "FAILED") return
  const upcoming = nextStage(job.stage)
  if (!upcoming) return
  const at = stamp(database.sequence)
  database.sequence += 1
  job.durationMs += stageDurationMs[job.stage]
  job.updatedAt = at
  const reason = failureFor(document.name, upcoming, job.attempt)
  if (reason) {
    job.failedStage = upcoming
    job.stage = "FAILED"
    job.error = reason
    job.errorCode = "processing_failed"
    job.cancelled = false
  } else {
    job.stage = upcoming
    job.failedStage = null
    job.error = null
    job.errorCode = null
    job.progress = progressFor(upcoming)
    if (upcoming === "PARSING") document.extractedText = buildExtract(document, base.settings)
    if (upcoming === "CHUNKING") writeChunks(database, document, base.settings)
    if (upcoming === "READY") base.indexedFingerprint = indexFingerprint(base.settings)
  }
  syncDocument(document, job, at)
  touchBase(base, at)
}

/** Test and mock-worker entry. One call moves one current attempt by one stage. */
export function advanceIngestionJob(
  workspaceId: string,
  knowledgeBaseId: string,
  jobId: string,
): { ok: true; job: IngestionJob; document: DocumentRecord } | StoreFailure {
  const invalid = requireWorkspace(workspaceId)
  if (invalid) return invalid
  const database = readDatabase()
  const job = database.jobs.find((item) => item.id === jobId && item.knowledgeBaseId === knowledgeBaseId && item.workspaceId === workspaceId)
  if (!job) return failure(404, "not_found", "Ingestion job not found.")
  const document = database.documents.find((item) => item.id === job.documentId)
  if (!document) return failure(404, "not_found", "Document not found.")
  stepJob(database, job)
  writeDatabase(database)
  return { ok: true, job: copy(job), document: copy(document) }
}

/** Moves every current attempt in the mock store forward one stage. The UI does not call this. */
export function advanceDueIngestionJobs() {
  const database = readDatabase()
  const jobs = currentJobs(database)
  if (jobs.length === 0) return 0
  for (const job of jobs) stepJob(database, job)
  writeDatabase(database)
  return jobs.length
}

export function cancelIngestionJob(
  workspaceId: string,
  knowledgeBaseId: string,
  jobId: string,
): { ok: true; job: IngestionJob; document: DocumentRecord } | StoreFailure {
  const invalid = requireWorkspace(workspaceId)
  if (invalid) return invalid
  const database = readDatabase()
  const job = database.jobs.find((item) => item.id === jobId && item.knowledgeBaseId === knowledgeBaseId && item.workspaceId === workspaceId)
  if (!job) return failure(404, "not_found", "Ingestion job not found.")
  const document = database.documents.find((item) => item.id === job.documentId)
  const base = findBase(database, workspaceId, knowledgeBaseId)
  if (!document || !base) return failure(404, "not_found", "Document not found.")
  if (job.cancelled) return { ok: true, job: copy(job), document: copy(document) }
  if (job.stage === "READY" || job.stage === "FAILED" || document.jobId !== job.id) {
    return failure(409, "invalid_job_transition", "This ingestion job is already finished.")
  }
  const at = stamp(database.sequence)
  database.sequence += 1
  job.failedStage = job.stage
  job.stage = "FAILED"
  job.error = "Ingestion was cancelled. No embedding was written."
  job.errorCode = null
  job.cancelled = true
  job.updatedAt = at
  syncDocument(document, job, at)
  touchBase(base, at)
  writeDatabase(database)
  return { ok: true, job: copy(job), document: copy(document) }
}

export function retryIngestion(
  workspaceId: string,
  knowledgeBaseId: string,
  documentId: string,
): DocumentUploadResponse | StoreFailure {
  const invalid = requireWorkspace(workspaceId)
  if (invalid) return invalid
  const database = readDatabase()
  const document = database.documents.find(
    (item) => item.id === documentId && item.knowledgeBaseId === knowledgeBaseId && item.workspaceId === workspaceId,
  )
  if (!document) return failure(404, "not_found", "Document not found.")
  if (document.status !== "FAILED") return failure(409, "invalid_job_transition", "Only a failed document can be retried.")
  if (currentJobs(database).some((job) => job.documentId === document.id)) {
    return failure(409, "invalid_job_transition", "An ingestion attempt is already running for this document.")
  }
  const base = findBase(database, workspaceId, knowledgeBaseId)
  if (!base) return failure(404, "not_found", "Knowledge base not found.")
  const at = stamp(database.sequence)
  const job: IngestionJob = {
    id: nextId(database, "job"),
    workspaceId,
    knowledgeBaseId,
    documentId,
    attempt: document.attempt + 1,
    stage: "QUEUED",
    failedStage: null,
    progress: progressFor("QUEUED"),
    durationMs: 0,
    error: null,
    errorCode: null,
    cancelled: false,
    startedAt: at,
    updatedAt: at,
    simulated: true,
  }
  database.chunks = database.chunks.filter((chunk) => chunk.documentId !== documentId)
  document.extractedText = ""
  document.error = null
  database.jobs.push(job)
  syncDocument(document, job, at)
  touchBase(base, at)
  writeDatabase(database)
  return { simulated: true, document: copy(document), job: copy(job), session: null }
}

export function reindexKnowledgeBase(workspaceId: string, knowledgeBaseId: string): ReindexResponse | StoreFailure {
  const invalid = requireWorkspace(workspaceId)
  if (invalid) return invalid
  const database = readDatabase()
  const base = findBase(database, workspaceId, knowledgeBaseId)
  if (!base) return failure(404, "not_found", "Knowledge base not found.")
  const documents = database.documents.filter(
    (document) => document.knowledgeBaseId === knowledgeBaseId && document.workspaceId === workspaceId,
  )
  if (documents.length === 0) return failure(409, "invalid_job_transition", "There are no documents to reindex.")
  if (documents.some((document) => !isTerminalStage(document.status))) {
    return failure(409, "invalid_job_transition", "An ingestion attempt is already running.")
  }
  const at = stamp(database.sequence)
  const jobs = documents.map((document) => {
    const job: IngestionJob = {
      id: nextId(database, "job"),
      workspaceId,
      knowledgeBaseId,
      documentId: document.id,
      attempt: document.attempt + 1,
      stage: "QUEUED",
      failedStage: null,
      progress: progressFor("QUEUED"),
      durationMs: 0,
      error: null,
      errorCode: null,
      cancelled: false,
      startedAt: at,
      updatedAt: at,
      simulated: true,
    }
    database.chunks = database.chunks.filter((chunk) => chunk.documentId !== document.id)
    document.extractedText = ""
    document.error = null
    database.jobs.push(job)
    syncDocument(document, job, at)
    return job
  })
  touchBase(base, at)
  writeDatabase(database)
  return { simulated: true, jobs: copy(jobs) }
}

export function listIndexedChunks(workspaceId: string, knowledgeBaseId: string) {
  const invalid = requireWorkspace(workspaceId)
  if (invalid) return invalid
  const database = readDatabase()
  const base = findBase(database, workspaceId, knowledgeBaseId)
  if (!base) return failure(404, "not_found", "Knowledge base not found.")
  const readyIds = new Set(
    database.documents
      .filter((document) => document.knowledgeBaseId === knowledgeBaseId && document.workspaceId === workspaceId && document.status === "READY")
      .map((document) => document.id),
  )
  const names = new Map(
    database.documents
      .filter((document) => document.workspaceId === workspaceId && document.knowledgeBaseId === knowledgeBaseId)
      .map((document) => [document.id, document.name]),
  )
  const chunks = database.chunks
    .filter((chunk) => readyIds.has(chunk.documentId))
    .map((chunk) => ({
      ...copy(chunk),
      documentName: names.get(chunk.documentId) ?? "Document",
      embeddingModel: base.settings.embeddingModel,
    }))
    .sort((left, right) => left.documentId.localeCompare(right.documentId) || left.index - right.index)
  return { ok: true as const, chunks }
}

const ingestionWorkerFlag = "__agentflowMockIngestionWorker"

function bootIngestionWorker() {
  if (process.env.VITEST === "true" || typeof window === "undefined") return
  const host = globalThis as typeof globalThis & { [ingestionWorkerFlag]?: boolean }
  if (host[ingestionWorkerFlag]) return
  host[ingestionWorkerFlag] = true
  const loop = () => {
    try {
      advanceDueIngestionJobs()
    } finally {
      window.setTimeout(loop, 700)
    }
  }
  window.setTimeout(loop, 700)
}

bootIngestionWorker()

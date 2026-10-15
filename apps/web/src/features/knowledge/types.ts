import type { ApiErrorBody } from "@/features/auth/types"

export const ingestionStages = [
  "UPLOADED",
  "QUEUED",
  "PARSING",
  "CHUNKING",
  "EMBEDDING",
  "INDEXING",
  "READY",
  "FAILED",
] as const

export type IngestionStage = (typeof ingestionStages)[number]
export type ActiveIngestionStage = Exclude<IngestionStage, "FAILED">

export type EmbeddingModelId = "orbit-embed-small" | "orbit-embed-large"
export type DocumentExtension = "pdf" | "docx" | "txt" | "md"
export type DocumentMediaType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain"
  | "text/markdown"

export type MetadataFieldType = "string" | "number" | "boolean"
export type MetadataSchema = Record<string, MetadataFieldType>

export type KnowledgeBaseSettings = {
  embeddingModel: EmbeddingModelId
  chunkSize: number
  chunkOverlap: number
  retrieval: {
    topK: number
    scoreThreshold: number
  }
  metadataSchema: MetadataSchema
}

export type IngestionRollup = "empty" | "processing" | "ready" | "attention"

export type KnowledgeBase = {
  id: string
  workspaceId: string
  name: string
  description: string
  settings: KnowledgeBaseSettings
  documentCount: number
  storageBytes: number
  ingestionStatus: IngestionRollup
  /** True when saved chunk or embedding settings differ from the settings that last reached READY. */
  reindexRequired: boolean
  createdAt: string
  updatedAt: string
  simulated: true
}

export type KnowledgeBaseCreateRequest = {
  workspaceId: string
  name: string
  description: string
  settings: KnowledgeBaseSettings
}

export type KnowledgeBaseUpdateRequest = {
  name: string
  description: string
  settings: KnowledgeBaseSettings
}

export type PaginatedResponse<TItem> = {
  page: number
  pageSize: number
  total: number
  items: TItem[]
}

export type KnowledgeBaseListResponse = PaginatedResponse<KnowledgeBase> & {
  simulated: true
  workspaceId: string
}

export type KnowledgeListParams = {
  workspaceId: string
  q: string
  status: "all" | IngestionRollup
  model: "all" | EmbeddingModelId
  sort: "name" | "updated" | "documents" | "storage"
  page: number
}

export type DocumentRecord = {
  id: string
  workspaceId: string
  knowledgeBaseId: string
  jobId: string
  name: string
  extension: DocumentExtension
  mediaType: DocumentMediaType
  sizeBytes: number
  status: IngestionStage
  progress: number
  attempt: number
  error: string | null
  extractedText: string
  metadata: Record<string, string>
  createdAt: string
  updatedAt: string
  simulated: true
}

export type DocumentUploadRequest = {
  workspaceId: string
  name: string
  mediaType: DocumentMediaType
  sizeBytes: number
}

export type IngestionJob = {
  id: string
  workspaceId: string
  knowledgeBaseId: string
  documentId: string
  attempt: number
  stage: IngestionStage
  failedStage: ActiveIngestionStage | null
  progress: number
  durationMs: number
  error: string | null
  errorCode: "processing_failed" | null
  cancelled: boolean
  startedAt: string
  updatedAt: string
  simulated: true
}

export type DocumentUploadResponse = {
  simulated: true
  document: DocumentRecord
  job: IngestionJob
  /** Set when the mock collapsed the production upload session. Null on retry. */
  session: UploadSession | null
}

export type ReindexResponse = {
  simulated: true
  jobs: IngestionJob[]
}

export type DocumentChunk = {
  id: string
  documentId: string
  index: number
  content: string
  tokenCount: number
  /** Character offsets into the simulated extract, not into the file bytes. */
  startOffset: number
  endOffset: number
  metadata: Record<string, string>
  simulated: true
}

export type UploadSessionStatus = "open" | "uploaded" | "completed" | "expired" | "rejected"

/** Production step 1. The mock upload path does not require the UI to call this. */
export type UploadSessionCreateRequest = {
  workspaceId: string
  name: string
  mediaType: DocumentMediaType
  sizeBytes: number
}

export type UploadSession = {
  id: string
  workspaceId: string
  knowledgeBaseId: string
  name: string
  mediaType: DocumentMediaType
  sizeBytes: number
  status: UploadSessionStatus
  /** Presigned object-storage URL in production. Null when the mock stores metadata only. */
  uploadUrl: string | null
  expiresAt: string | null
  simulated: true
}

/** Production step 3, after the client PUTs bytes to `uploadUrl`. */
export type UploadCompleteRequest = {
  workspaceId: string
  sessionId: string
}

export type DocumentListParams = {
  workspaceId: string
  q: string
  status: "all" | IngestionStage
  page: number
}

export type DocumentListResponse = PaginatedResponse<DocumentRecord> & {
  simulated: true
  workspaceId: string
  knowledgeBaseId: string
}

export type KnowledgeBaseDetail = {
  simulated: true
  knowledgeBase: KnowledgeBase
  activeJobs: IngestionJob[]
}

export type DocumentDetail = {
  simulated: true
  document: DocumentRecord
  job: IngestionJob
  jobs: IngestionJob[]
  chunks: DocumentChunk[]
}

export type KnowledgeFormValues = {
  name: string
  description: string
  embeddingModel: string
  chunkSize: string
  chunkOverlap: string
  topK: string
  scoreThreshold: string
  metadataSchema: string
}

export type KnowledgeField = keyof KnowledgeFormValues

/** Shared error body. `ApiError` in `@/features/auth/api/errors` is the runtime class. */
export type ApiError = ApiErrorBody

export function isTerminalStage(stage: IngestionStage) {
  return stage === "READY" || stage === "FAILED"
}

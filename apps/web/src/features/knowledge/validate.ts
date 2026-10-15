import { embeddingModels, MAX_DOCUMENT_BYTES } from "@/features/knowledge/catalog"
import type {
  DocumentExtension,
  DocumentListParams,
  DocumentMediaType,
  EmbeddingModelId,
  KnowledgeBaseSettings,
  KnowledgeField,
  KnowledgeFormValues,
  KnowledgeListParams,
  MetadataSchema,
} from "@/features/knowledge/types"

const extensions: Record<DocumentExtension, DocumentMediaType> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
}

const listStatuses = new Set(["all", "empty", "processing", "ready", "attention"])
const listModels = new Set(["all", "orbit-embed-small", "orbit-embed-large"])
const listSorts = new Set(["name", "updated", "documents", "storage"])
const documentStatuses = new Set([
  "all",
  "UPLOADED",
  "QUEUED",
  "PARSING",
  "CHUNKING",
  "EMBEDDING",
  "INDEXING",
  "READY",
  "FAILED",
])

export function isWorkspaceId(value: string) {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)
}

export function extensionOf(name: string): DocumentExtension | null {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim())
  const extension = match?.[1]?.toLowerCase()
  if (extension === "pdf" || extension === "docx" || extension === "txt" || extension === "md") return extension
  return null
}

export function mediaTypeFor(extension: DocumentExtension) {
  return extensions[extension]
}

export function inspectFile(file: { name: string; size: number; type: string }) {
  if (file.size <= 0) return { ok: false as const, message: `${file.name} is empty.` }
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false as const, message: `${file.name} is larger than 5 MB.` }
  const extension = extensionOf(file.name)
  if (!extension) {
    return {
      ok: false as const,
      message: `${file.name} is not a supported type. Use PDF, DOCX, TXT, or Markdown.`,
    }
  }
  if (file.type && /^(image|video|audio)\//.test(file.type)) {
    return { ok: false as const, message: `${file.name} does not match the ${extension.toUpperCase()} type.` }
  }
  return { ok: true as const, extension, mediaType: mediaTypeFor(extension) }
}

export function metadataSchemaError(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return "Enter a JSON object."
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    return "Enter valid JSON."
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "Enter a JSON object."
  const entries = Object.entries(parsed)
  if (entries.length > 12) return "Use 12 metadata fields or fewer."
  for (const [key, field] of entries) {
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(key)) {
      return "Metadata keys must start with a letter and use lowercase letters, numbers, or underscores."
    }
    if (field !== "string" && field !== "number" && field !== "boolean") {
      return "Metadata values must be string, number, or boolean."
    }
  }
  return null
}

function parseSchema(value: string): MetadataSchema | null {
  if (metadataSchemaError(value)) return null
  return JSON.parse(value) as MetadataSchema
}

export function assessKnowledgeForm(values: KnowledgeFormValues) {
  const errors: Partial<Record<KnowledgeField, string>> = {}
  const name = values.name.trim()
  const description = values.description.trim()
  if (name.length < 2) errors.name = "Enter a name."
  else if (name.length > 80) errors.name = "Use 80 characters or fewer."
  if (description.length > 500) errors.description = "Use 500 characters or fewer."

  const model = embeddingModels.find((item) => item.id === values.embeddingModel)
  if (!model) errors.embeddingModel = "Choose a simulated embedding model."

  const chunkSize = Number(values.chunkSize)
  const chunkOverlap = Number(values.chunkOverlap)
  const topK = Number(values.topK)
  const scoreThreshold = Number(values.scoreThreshold)

  if (!Number.isInteger(chunkSize)) errors.chunkSize = "Chunk size must be a whole number."
  else if (chunkSize < 128) errors.chunkSize = "Chunk size must be at least 128."
  else if (chunkSize > 2048) errors.chunkSize = "Chunk size must be 2048 or less."

  if (!Number.isInteger(chunkOverlap)) errors.chunkOverlap = "Overlap must be a whole number."
  else if (chunkOverlap < 0) errors.chunkOverlap = "Overlap cannot be negative."
  else if (!errors.chunkSize && chunkOverlap >= chunkSize) errors.chunkOverlap = "Overlap must be smaller than the chunk size."

  if (!Number.isInteger(topK) || topK < 1 || topK > 20) errors.topK = "Top K must be between 1 and 20."
  if (!Number.isFinite(scoreThreshold) || scoreThreshold < 0 || scoreThreshold > 1) {
    errors.scoreThreshold = "Score threshold must be between 0 and 1."
  }

  const schemaMessage = metadataSchemaError(values.metadataSchema)
  if (schemaMessage) errors.metadataSchema = schemaMessage

  if (Object.keys(errors).length > 0 || !model) return { ok: false as const, errors }

  const settings: KnowledgeBaseSettings = {
    embeddingModel: model.id,
    chunkSize,
    chunkOverlap,
    retrieval: { topK, scoreThreshold },
    metadataSchema: parseSchema(values.metadataSchema) ?? {},
  }

  return { ok: true as const, errors, name, description, settings }
}

export function assessKnowledgeRequest(input: {
  name?: unknown
  description?: unknown
  settings?: unknown
}): { ok: true; name: string; description: string; settings: KnowledgeBaseSettings } | { ok: false; message: string } {
  if (!input || typeof input !== "object") return { ok: false, message: "Enter a name." }
  const settings = input.settings
  if (!settings || typeof settings !== "object") return { ok: false, message: "Choose a simulated embedding model." }
  const record = settings as Partial<KnowledgeBaseSettings> & { retrieval?: { topK?: unknown; scoreThreshold?: unknown } }
  const retrieval = record.retrieval
  const assessed = assessKnowledgeForm({
    name: typeof input.name === "string" ? input.name : "",
    description: typeof input.description === "string" ? input.description : "",
    embeddingModel: typeof record.embeddingModel === "string" ? record.embeddingModel : "",
    chunkSize: typeof record.chunkSize === "number" ? String(record.chunkSize) : "",
    chunkOverlap: typeof record.chunkOverlap === "number" ? String(record.chunkOverlap) : "",
    topK: typeof retrieval?.topK === "number" ? String(retrieval.topK) : "",
    scoreThreshold: typeof retrieval?.scoreThreshold === "number" ? String(retrieval.scoreThreshold) : "",
    metadataSchema: record.metadataSchema ? JSON.stringify(record.metadataSchema) : "",
  })
  if (!assessed.ok) {
    const message = Object.values(assessed.errors)[0]
    return { ok: false, message: message ?? "Enter a name." }
  }
  return { ok: true, name: assessed.name, description: assessed.description, settings: assessed.settings }
}

export function isKnowledgeListQuery(value: {
  workspaceId: string
  q: string
  status: string
  model: string
  sort: string
  page: number
}): value is KnowledgeListParams {
  return (
    isWorkspaceId(value.workspaceId) &&
    value.q.length <= 200 &&
    listStatuses.has(value.status) &&
    listModels.has(value.model) &&
    listSorts.has(value.sort) &&
    Number.isInteger(value.page) &&
    value.page >= 1
  )
}

export function isDocumentListQuery(value: {
  workspaceId: string
  q: string
  status: string
  page: number
}): value is DocumentListParams {
  return (
    isWorkspaceId(value.workspaceId) &&
    value.q.length <= 200 &&
    documentStatuses.has(value.status) &&
    Number.isInteger(value.page) &&
    value.page >= 1
  )
}

export function isEmbeddingModel(value: string): value is EmbeddingModelId {
  return value === "orbit-embed-small" || value === "orbit-embed-large"
}

export function formValuesFromSettings(input: {
  name: string
  description: string
  settings: KnowledgeBaseSettings
}): KnowledgeFormValues {
  return {
    name: input.name,
    description: input.description,
    embeddingModel: input.settings.embeddingModel,
    chunkSize: String(input.settings.chunkSize),
    chunkOverlap: String(input.settings.chunkOverlap),
    topK: String(input.settings.retrieval.topK),
    scoreThreshold: String(input.settings.retrieval.scoreThreshold),
    metadataSchema: JSON.stringify(input.settings.metadataSchema, null, 2),
  }
}

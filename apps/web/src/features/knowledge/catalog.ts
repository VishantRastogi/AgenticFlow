import type { ActiveIngestionStage, EmbeddingModelId, IngestionStage } from "@/features/knowledge/types"

export const KNOWLEDGE_PAGE_SIZE = 6
export const DOCUMENT_PAGE_SIZE = 8
export const MAX_DOCUMENT_BYTES = 5_000_000

export const embeddingModels: readonly {
  id: EmbeddingModelId
  label: string
  dimensions: number
  note: string
}[] = [
  {
    id: "orbit-embed-small",
    label: "Orbit Embed Small",
    dimensions: 384,
    note: "Simulated embedding model. No vectors are computed.",
  },
  {
    id: "orbit-embed-large",
    label: "Orbit Embed Large",
    dimensions: 1024,
    note: "Simulated embedding model. No vectors are computed.",
  },
]

export const stageDurationMs: Record<ActiveIngestionStage, number> = {
  UPLOADED: 200,
  QUEUED: 300,
  PARSING: 400,
  CHUNKING: 500,
  EMBEDDING: 400,
  INDEXING: 300,
  READY: 0,
}

export const simulatedDurationBudgetMs = Object.values(stageDurationMs).reduce((sum, value) => sum + value, 0)

const stageLabels: Record<IngestionStage, string> = {
  UPLOADED: "Uploaded",
  QUEUED: "Queued",
  PARSING: "Parsing",
  CHUNKING: "Chunking",
  EMBEDDING: "Embedding",
  INDEXING: "Indexing",
  READY: "Ready",
  FAILED: "Failed",
}

export function stageLabel(stage: IngestionStage) {
  return stageLabels[stage]
}

export function embeddingModel(id: string) {
  return embeddingModels.find((model) => model.id === id) ?? null
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatTimestamp(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso))
}

export const emptyKnowledgeForm: KnowledgeFormDefaults = {
  name: "",
  description: "",
  embeddingModel: "orbit-embed-small",
  chunkSize: "512",
  chunkOverlap: "64",
  topK: "4",
  scoreThreshold: "0.2",
  metadataSchema: '{\n  "source": "string"\n}',
}

type KnowledgeFormDefaults = {
  name: string
  description: string
  embeddingModel: string
  chunkSize: string
  chunkOverlap: string
  topK: string
  scoreThreshold: string
  metadataSchema: string
}

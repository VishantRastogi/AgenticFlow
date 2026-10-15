import { callContract } from "@/features/api/real-adapter"
import type {
  DocumentDetail,
  DocumentListParams,
  DocumentListResponse,
  DocumentUploadRequest,
  DocumentUploadResponse,
  IngestionJob,
  KnowledgeBase,
  ReindexResponse,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseDetail,
  KnowledgeBaseListResponse,
  KnowledgeBaseUpdateRequest,
  KnowledgeListParams,
  DocumentRecord,
  DocumentChunk,
} from "@/features/knowledge/types"

export function listKnowledgeBases(params: KnowledgeListParams) {
  return callContract<KnowledgeBaseListResponse>("knowledge.bases.list", { query: params })
}

export function getKnowledgeBase(workspaceId: string, id: string) {
  return callContract<KnowledgeBaseDetail>("knowledge.bases.get", {
    params: { id },
    query: { workspaceId },
  })
}

export function createKnowledgeBase(input: KnowledgeBaseCreateRequest) {
  return callContract<{ simulated: true; knowledgeBase: KnowledgeBase }>("knowledge.bases.create", {
    query: { workspaceId: input.workspaceId },
    body: input,
  })
}

export function updateKnowledgeBase(workspaceId: string, id: string, input: KnowledgeBaseUpdateRequest) {
  return callContract<{ simulated: true; knowledgeBase: KnowledgeBase }>("knowledge.bases.update", {
    params: { id },
    query: { workspaceId },
    body: input,
  })
}

export function deleteKnowledgeBase(workspaceId: string, id: string) {
  return callContract<void>("knowledge.bases.delete", { params: { id }, query: { workspaceId } })
}

export function listDocuments(knowledgeBaseId: string, params: DocumentListParams) {
  return callContract<DocumentListResponse>("knowledge.documents.list", {
    params: { id: knowledgeBaseId },
    query: params,
  })
}

export function getDocument(workspaceId: string, knowledgeBaseId: string, documentId: string) {
  return callContract<DocumentDetail>("knowledge.documents.get", {
    params: { id: knowledgeBaseId, documentId },
    query: { workspaceId },
  })
}

export function uploadDocument(knowledgeBaseId: string, input: DocumentUploadRequest) {
  return callContract<DocumentUploadResponse>("knowledge.documents.upload", {
    params: { id: knowledgeBaseId },
    query: { workspaceId: input.workspaceId },
    body: input,
  })
}

export function deleteDocument(workspaceId: string, knowledgeBaseId: string, documentId: string) {
  return callContract<void>("knowledge.documents.delete", {
    params: { id: knowledgeBaseId, documentId },
    query: { workspaceId },
  })
}

export function retryDocument(workspaceId: string, knowledgeBaseId: string, documentId: string) {
  return callContract<DocumentUploadResponse>("knowledge.documents.retry", {
    params: { id: knowledgeBaseId, documentId },
    query: { workspaceId },
  })
}

export function reindexKnowledgeBase(workspaceId: string, knowledgeBaseId: string) {
  return callContract<ReindexResponse>("knowledge.bases.reindex", {
    params: { id: knowledgeBaseId },
    query: { workspaceId },
  })
}

export function cancelIngestionJob(workspaceId: string, knowledgeBaseId: string, jobId: string) {
  return callContract<{ simulated: true; job: IngestionJob; document: DocumentRecord }>("knowledge.jobs.cancel", {
    params: { id: knowledgeBaseId, jobId },
    query: { workspaceId },
  })
}

export function listChunks(workspaceId: string, knowledgeBaseId: string, documentId: string) {
  return callContract<{ simulated: true; chunks: DocumentChunk[] }>("knowledge.chunks.list", {
    params: { id: knowledgeBaseId, documentId },
    query: { workspaceId },
  })
}

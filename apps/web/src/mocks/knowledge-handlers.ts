import { http, HttpResponse } from "msw"
import type { ApiErrorBody } from "@/features/auth/types"
import type { DocumentUploadRequest, KnowledgeBaseCreateRequest, KnowledgeBaseUpdateRequest } from "@/features/knowledge/types"
import { isDocumentListQuery, isKnowledgeListQuery, isWorkspaceId } from "@/features/knowledge/validate"
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
  retryIngestion,
  updateKnowledgeBase,
  uploadDocument,
  type StoreFailure,
} from "@/mocks/knowledge-store"

function error(status: number, code: ApiErrorBody["code"], message: string) {
  return HttpResponse.json({ code, message }, { status })
}

function fromFailure(result: StoreFailure) {
  return error(result.status, result.code, result.message)
}

function isFailure(result: unknown): result is StoreFailure {
  return (
    typeof result === "object" &&
    result !== null &&
    "ok" in result &&
    result.ok === false &&
    "status" in result &&
    typeof result.status === "number"
  )
}

function workspaceOf(request: Request) {
  return new URL(request.url).searchParams.get("workspaceId") ?? ""
}

function pageOf(request: Request) {
  const raw = new URL(request.url).searchParams.get("page") ?? "1"
  return Number(raw)
}

export const knowledgeHandlers = [
  http.get("*/api/knowledge-bases", ({ request }) => {
    const url = new URL(request.url)
    const query = {
      workspaceId: url.searchParams.get("workspaceId") ?? "",
      q: url.searchParams.get("q") ?? "",
      status: url.searchParams.get("status") ?? "all",
      model: url.searchParams.get("model") ?? "all",
      sort: url.searchParams.get("sort") ?? "updated",
      page: pageOf(request),
    }
    if (!isKnowledgeListQuery(query)) return error(400, "validation_error", "Knowledge base filters are not supported.")
    return HttpResponse.json(listKnowledgeBases(query))
  }),

  http.post("*/api/knowledge-bases", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as KnowledgeBaseCreateRequest | null
    const workspaceId = workspaceOf(request)
    if (!body || body.workspaceId !== workspaceId) {
      return error(400, "validation_error", "Workspace scope does not match.")
    }
    const result = createKnowledgeBase(body)
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json({ simulated: true, knowledgeBase: result.knowledgeBase }, { status: 201 })
  }),

  http.get("*/api/knowledge-bases/:id/documents/:documentId/chunks", ({ params, request }) => {
    const detail = getDocument(workspaceOf(request), String(params.id), String(params.documentId))
    if (isFailure(detail)) return fromFailure(detail)
    return HttpResponse.json({ simulated: true, chunks: detail.chunks })
  }),

  http.get("*/api/knowledge-bases/:id/documents/:documentId", ({ params, request }) => {
    const detail = getDocument(workspaceOf(request), String(params.id), String(params.documentId))
    if (isFailure(detail)) return fromFailure(detail)
    return HttpResponse.json(detail)
  }),

  http.delete("*/api/knowledge-bases/:id/documents/:documentId", ({ params, request }) => {
    const result = deleteDocument(workspaceOf(request), String(params.id), String(params.documentId))
    if (isFailure(result)) return fromFailure(result)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post("*/api/knowledge-bases/:id/documents/:documentId/retry", ({ params, request }) => {
    const result = retryIngestion(workspaceOf(request), String(params.id), String(params.documentId))
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json(result, { status: 201 })
  }),

  http.get("*/api/knowledge-bases/:id/documents", ({ params, request }) => {
    const url = new URL(request.url)
    const query = {
      workspaceId: url.searchParams.get("workspaceId") ?? "",
      q: url.searchParams.get("q") ?? "",
      status: url.searchParams.get("status") ?? "all",
      page: pageOf(request),
    }
    if (!isDocumentListQuery(query)) return error(400, "validation_error", "Document filters are not supported.")
    const result = listDocuments(String(params.id), query)
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json(result)
  }),

  http.post("*/api/knowledge-bases/:id/documents", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as DocumentUploadRequest | null
    const workspaceId = workspaceOf(request)
    if (!body || body.workspaceId !== workspaceId || !isWorkspaceId(workspaceId)) {
      return error(400, "validation_error", "Workspace scope does not match.")
    }
    const result = uploadDocument(String(params.id), body)
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json(result, { status: 201 })
  }),

  http.post("*/api/knowledge-bases/:id/jobs/:jobId/cancel", ({ params, request }) => {
    const result = cancelIngestionJob(workspaceOf(request), String(params.id), String(params.jobId))
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json({ simulated: true, job: result.job, document: result.document })
  }),

  http.post("*/api/knowledge-bases/:id/reindex", ({ params, request }) => {
    const result = reindexKnowledgeBase(workspaceOf(request), String(params.id))
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json(result)
  }),

  http.get("*/api/knowledge-bases/:id", ({ params, request }) => {
    const result = getKnowledgeBase(workspaceOf(request), String(params.id))
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json(result)
  }),

  http.patch("*/api/knowledge-bases/:id", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as KnowledgeBaseUpdateRequest | null
    if (!body) return error(400, "validation_error", "Enter a name.")
    const result = updateKnowledgeBase(workspaceOf(request), String(params.id), body)
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json({ simulated: true, knowledgeBase: result.knowledgeBase })
  }),

  http.delete("*/api/knowledge-bases/:id", ({ params, request }) => {
    const result = deleteKnowledgeBase(workspaceOf(request), String(params.id))
    if (isFailure(result)) return fromFailure(result)
    return new HttpResponse(null, { status: 204 })
  }),
]

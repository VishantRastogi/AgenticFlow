import { http, HttpResponse } from "msw"
import type { ApiErrorBody } from "@/features/auth/types"
import type { RetrievalRequest } from "@/features/rag/types"
import type { StoreFailure } from "@/mocks/knowledge-store"
import { getRagConfiguration, retrieve, saveRagConfiguration } from "@/mocks/rag-store"

function error(status: number, code: ApiErrorBody["code"], message: string) {
  return HttpResponse.json({ code, message }, { status })
}

function fromFailure(result: StoreFailure) {
  return error(result.status, result.code, result.message)
}

function isFailure(result: unknown): result is StoreFailure {
  return typeof result === "object" && result !== null && "ok" in result && result.ok === false
}

export const ragHandlers = [
  http.get("*/api/rag/configuration", ({ request }) => {
    const result = getRagConfiguration(new URL(request.url).searchParams.get("workspaceId") ?? "")
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json(result)
  }),

  http.patch("*/api/rag/configuration", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as RetrievalRequest | null
    const workspaceId = new URL(request.url).searchParams.get("workspaceId") ?? ""
    if (!body || body.workspaceId !== workspaceId) return error(400, "validation_error", "Workspace scope does not match.")
    const result = saveRagConfiguration(body)
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json(result)
  }),

  http.post("*/api/rag/retrievals", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as RetrievalRequest | null
    const workspaceId = new URL(request.url).searchParams.get("workspaceId") ?? ""
    if (!body || body.workspaceId !== workspaceId) return error(400, "validation_error", "Workspace scope does not match.")
    const result = retrieve(body)
    if (isFailure(result)) return fromFailure(result)
    return HttpResponse.json(result)
  }),
]

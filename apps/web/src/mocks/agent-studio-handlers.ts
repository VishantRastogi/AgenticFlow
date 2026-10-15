import { http, HttpResponse } from "msw"
import type { ApiErrorBody } from "@/features/auth/types"
import { toolCatalog } from "@/features/agents/studio-catalog"
import type { AgentConfiguration, AgentPublishRequest, AgentRollbackRequest, AgentTestRequest } from "@/features/agents/studio-types"
import {
  getAgentStudio,
  publishAgentStudio,
  rollbackAgentStudio,
  saveAgentStudio,
  testAgentStudio,
} from "@/mocks/agent-studio-store"
import type { StoreFailure } from "@/mocks/knowledge-store"

function error(status: number, code: ApiErrorBody["code"], message: string) {
  return HttpResponse.json({ code, message }, { status })
}

function isFailure(result: unknown): result is StoreFailure {
  return typeof result === "object" && result !== null && "ok" in result && (result as StoreFailure).ok === false
}

function workspaceOf(request: Request) {
  return new URL(request.url).searchParams.get("workspaceId") ?? ""
}

export const agentStudioHandlers = [
  http.get("*/api/agent-tools", ({ request }) => {
    const workspaceId = workspaceOf(request)
    if (!workspaceId) return error(400, "validation_error", "A workspace id is required.")
    return HttpResponse.json({ simulated: true, workspaceId, tools: toolCatalog })
  }),

  http.get("*/api/agents/:id/studio", ({ params, request }) => {
    const result = getAgentStudio(workspaceOf(request), String(params.id))
    if (isFailure(result)) return error(result.status, result.code, result.message)
    return HttpResponse.json(result)
  }),

  http.patch("*/api/agents/:id/studio", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as { workspaceId?: string; draft?: AgentConfiguration } | null
    if (!body || body.workspaceId !== workspaceOf(request) || !body.draft) {
      return error(400, "validation_error", "Workspace scope does not match.")
    }
    const result = saveAgentStudio(body.workspaceId, String(params.id), body.draft)
    if (isFailure(result)) return error(result.status, result.code, result.message)
    return HttpResponse.json(result)
  }),

  http.post("*/api/agents/:id/studio/publish", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as AgentPublishRequest | null
    if (!body || body.workspaceId !== workspaceOf(request)) return error(400, "validation_error", "Workspace scope does not match.")
    const result = publishAgentStudio(String(params.id), body)
    if (isFailure(result)) return error(result.status, result.code, result.message)
    return HttpResponse.json(result)
  }),

  http.post("*/api/agents/:id/studio/rollback", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as AgentRollbackRequest | null
    if (!body || body.workspaceId !== workspaceOf(request)) return error(400, "validation_error", "Workspace scope does not match.")
    const result = rollbackAgentStudio(String(params.id), body)
    if (isFailure(result)) return error(result.status, result.code, result.message)
    return HttpResponse.json(result)
  }),

  http.post("*/api/agents/:id/studio/tests", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as AgentTestRequest | null
    if (!body || body.workspaceId !== workspaceOf(request)) return error(400, "validation_error", "Workspace scope does not match.")
    const result = testAgentStudio(String(params.id), body)
    if (isFailure(result)) return error(result.status, result.code, result.message)
    return HttpResponse.json(result)
  }),
]

import { http, HttpResponse } from "msw"
import type { ApiErrorBody } from "@/features/auth/types"
import { isExecutionListQuery, queryExecutions, EXECUTION_PAGE_SIZE } from "@/features/executions/query"
import { filterStructuredLogs } from "@/features/executions/observatory"
import { projectExecution } from "@/features/executions/project"
import type { ExecutionDetail, ExecutionListParams } from "@/features/executions/types"
import { isWorkspaceId } from "@/features/knowledge/validate"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"
import { auditActor, recordAudit } from "@/mocks/audit-store"
import { cancelObservatoryExecution, observatoryBundle, observatoryDetail, observatorySummaries, retryObservatoryExecution } from "@/mocks/execution-observatory"
import {
  cancelStoredExecution,
  executionCursor,
  listAgents,
  listExecutions,
  retryStoredExecution,
  tickStoredExecution,
} from "@/mocks/operations-store"

function error(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

function workspaceOrLocal(request: Request) {
  return new URL(request.url).searchParams.get("workspaceId") || "local"
}

function detailFor(id: string) {
  const record = listExecutions().find((execution) => execution.id === id)
  const agent = record ? listAgents().find((item) => item.id === record.agentId) : null
  if (!record || !agent) return null
  return projectExecution({
    record,
    agentName: agent.name,
    agentStatus: agent.status,
    retryPolicy: agent.retryPolicy,
    cursor: executionCursor(id, record),
    asOf: SIMULATED_NOW,
  })
}

function view(id: string, workspaceId: string): ExecutionDetail | null {
  if (!isWorkspaceId(workspaceId)) return null
  if (workspaceId === "local") {
    const catalog = detailFor(id)
    if (catalog) return catalog
  }
  return observatoryDetail(workspaceId, id)
}

function missing() {
  return error(404, { code: "unknown", message: "This execution is not in the history." })
}

const severities = new Set(["all", "debug", "info", "warn", "error"])

export const executionHandlers = [
  http.get("*/api/executions", ({ request }) => {
    const url = new URL(request.url)
    const workspaceId = workspaceOrLocal(request)
    if (!isWorkspaceId(workspaceId)) return error(400, { code: "validation_error", message: "A workspace id is required." })
    const query = {
      q: url.searchParams.get("q") ?? "",
      agent: url.searchParams.get("agent") ?? "all",
      environment: url.searchParams.get("environment") ?? "all",
      status: url.searchParams.get("status") ?? "all",
      range: url.searchParams.get("range") ?? "all",
      sort: url.searchParams.get("sort") ?? "newest",
      page: Number(url.searchParams.get("page") ?? "1"),
    }
    if (!isExecutionListQuery(query)) {
      return error(400, { code: "validation_error", message: "Execution filters are not supported." })
    }
    const agents = listAgents()
    const records = workspaceId === "local" ? listExecutions() : []
    const page = queryExecutions(records, agents, query satisfies ExecutionListParams, SIMULATED_NOW, observatorySummaries(workspaceId))
    return HttpResponse.json({
      ...page,
      agents: agents.map((agent) => ({ id: agent.id, name: agent.name })),
      page: query.page,
      pageSize: EXECUTION_PAGE_SIZE,
      asOf: SIMULATED_NOW,
      simulated: true,
    })
  }),

  http.get("*/api/executions/:id/logs", ({ params, request }) => {
    const url = new URL(request.url)
    const severity = url.searchParams.get("severity") ?? "all"
    if (!severities.has(severity)) return error(400, { code: "validation_error", message: "Log filters are not supported." })
    const workspaceId = workspaceOrLocal(request)
    const execution = view(String(params.id), workspaceId)
    const bundle = execution ? bundleFor(execution, workspaceId) : null
    if (!execution || !bundle) return missing()
    return HttpResponse.json({
      simulated: true,
      executionId: execution.id,
      logs: filterStructuredLogs(bundle.logs, severity as "all" | "debug" | "info" | "warn" | "error", url.searchParams.get("q") ?? ""),
    })
  }),

  http.get("*/api/executions/:id/traces", ({ params, request }) => {
    const execution = view(String(params.id), workspaceOrLocal(request))
    const bundle = execution ? bundleFor(execution, workspaceOrLocal(request)) : null
    if (!execution || !bundle) return missing()
    return HttpResponse.json({ simulated: true, trace: bundle.trace, attempts: bundle.attempts })
  }),

  http.get("*/api/executions/:id/models", ({ params, request }) => {
    const execution = view(String(params.id), workspaceOrLocal(request))
    const bundle = execution ? bundleFor(execution, workspaceOrLocal(request)) : null
    if (!execution || !bundle) return missing()
    return HttpResponse.json({ simulated: true, executionId: execution.id, models: bundle.models, guardrails: bundle.guardrails })
  }),

  http.get("*/api/executions/:id/tools", ({ params, request }) => {
    const execution = view(String(params.id), workspaceOrLocal(request))
    const bundle = execution ? bundleFor(execution, workspaceOrLocal(request)) : null
    if (!execution || !bundle) return missing()
    return HttpResponse.json({ simulated: true, executionId: execution.id, tools: bundle.tools })
  }),

  http.get("*/api/executions/:id/retrievals", ({ params, request }) => {
    const execution = view(String(params.id), workspaceOrLocal(request))
    const bundle = execution ? bundleFor(execution, workspaceOrLocal(request)) : null
    if (!execution || !bundle) return missing()
    return HttpResponse.json({ simulated: true, executionId: execution.id, retrievals: bundle.retrievals, costs: bundle.costs, errors: bundle.errors })
  }),

  http.get("*/api/executions/:id", ({ params, request }) => {
    const execution = view(String(params.id), workspaceOrLocal(request))
    if (!execution) return missing()
    return HttpResponse.json({ execution, simulated: true })
  }),

  http.post("*/api/executions/:id/tick", ({ params, request }) => {
    if (workspaceOrLocal(request) !== "local") return missing()
    const result = tickStoredExecution(String(params.id))
    if ("error" in result) return missing()
    const execution = detailFor(result.execution.id)
    if (!execution) return missing()
    return HttpResponse.json({ execution, simulated: true })
  }),

  http.post("*/api/executions/:id/cancel", ({ params, request }) => {
    const workspaceId = workspaceOrLocal(request)
    const id = String(params.id)
    if (workspaceId === "local" && listExecutions().some((execution) => execution.id === id)) {
      const result = cancelStoredExecution(id)
      if ("error" in result && result.error === "missing") return missing()
      if ("error" in result && "reason" in result) {
        return error(409, { code: "validation_error", message: result.reason ?? "This execution cannot change state." })
      }
      if (!("execution" in result)) return missing()
      const execution = detailFor(result.execution.id)
      if (!execution) return missing()
      recordAudit({
        actor: auditActor(request),
        action: "execution.cancelled",
        resourceType: "execution",
        resourceId: execution.id,
        outcome: "succeeded",
        detail: `${execution.id} was cancelled.`,
        fields: { status: "cancelled" },
      })
      return HttpResponse.json({ execution, simulated: true })
    }
    const result = cancelObservatoryExecution(workspaceId, id)
    if (!result.ok) {
      if (result.status === 404) return missing()
      return error(result.status, { code: result.code, message: result.message })
    }
    return HttpResponse.json({ execution: result.execution, simulated: true })
  }),

  http.post("*/api/executions/:id/retry", ({ params, request }) => {
    const workspaceId = workspaceOrLocal(request)
    const id = String(params.id)
    if (workspaceId === "local" && listExecutions().some((execution) => execution.id === id)) {
      const result = retryStoredExecution(id)
      if ("error" in result && result.error === "missing") return missing()
      if ("error" in result && "reason" in result) {
        return error(409, { code: "validation_error", message: result.reason ?? "This execution cannot change state." })
      }
      if (!("execution" in result)) return missing()
      const execution = detailFor(result.execution.id)
      if (!execution) return missing()
      recordAudit({
        actor: auditActor(request),
        action: "execution.retried",
        resourceType: "execution",
        resourceId: execution.id,
        outcome: "succeeded",
        detail: `${execution.id} was queued from ${execution.retry.retryOf ?? "a previous run"}.`,
        fields: { attempt: String(execution.retry.attempt) },
      })
      return HttpResponse.json({ execution, simulated: true }, { status: 201 })
    }
    const result = retryObservatoryExecution(workspaceId, id)
    if (!result.ok) {
      if (result.status === 404) return missing()
      return error(result.status, { code: result.code, message: result.message })
    }
    return HttpResponse.json({ execution: result.execution, simulated: true }, { status: 201 })
  }),
]

function bundleFor(execution: ExecutionDetail, workspaceId: string) {
  const catalog = execution.source === "agent_test" || execution.source === "workflow" || execution.source === "workflow_plan" ? null : execution
  return observatoryBundle(workspaceId, execution.id, catalog)
}

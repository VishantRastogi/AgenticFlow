import { http, HttpResponse } from "msw"
import type { ApiErrorBody } from "@/features/auth/types"
import { isExecutionListQuery, queryExecutions, EXECUTION_PAGE_SIZE } from "@/features/executions/query"
import { projectExecution } from "@/features/executions/project"
import type { ExecutionListParams } from "@/features/executions/types"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"
import { auditActor, recordAudit } from "@/mocks/audit-store"
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

export const executionHandlers = [
  http.get("*/api/executions", ({ request }) => {
    const url = new URL(request.url)
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
    const page = queryExecutions(listExecutions(), agents, query satisfies ExecutionListParams, SIMULATED_NOW)
    return HttpResponse.json({
      ...page,
      agents: agents.map((agent) => ({ id: agent.id, name: agent.name })),
      page: query.page,
      pageSize: EXECUTION_PAGE_SIZE,
      asOf: SIMULATED_NOW,
      simulated: true,
    })
  }),

  http.get("*/api/executions/:id", ({ params }) => {
    const execution = detailFor(String(params.id))
    if (!execution) return error(404, { code: "unknown", message: "This execution is not in the history." })
    return HttpResponse.json({ execution, simulated: true })
  }),

  http.post("*/api/executions/:id/tick", ({ params }) => {
    const result = tickStoredExecution(String(params.id))
    if ("error" in result) return error(404, { code: "unknown", message: "This execution is not in the history." })
    const execution = detailFor(result.execution.id)
    if (!execution) return error(404, { code: "unknown", message: "This execution is not in the history." })
    return HttpResponse.json({ execution, simulated: true })
  }),

  http.post("*/api/executions/:id/cancel", ({ params, request }) => {
    const result = cancelStoredExecution(String(params.id))
    if ("error" in result && result.error === "missing") {
      return error(404, { code: "unknown", message: "This execution is not in the history." })
    }
    if ("error" in result && "reason" in result) {
      return error(409, { code: "validation_error", message: result.reason ?? "This execution cannot change state." })
    }
    if (!("execution" in result)) return error(404, { code: "unknown", message: "This execution is not in the history." })
    const execution = detailFor(result.execution.id)
    if (!execution) return error(404, { code: "unknown", message: "This execution is not in the history." })
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
  }),

  http.post("*/api/executions/:id/retry", ({ params, request }) => {
    const result = retryStoredExecution(String(params.id))
    if ("error" in result && result.error === "missing") {
      return error(404, { code: "unknown", message: "This execution is not in the history." })
    }
    if ("error" in result && "reason" in result) {
      return error(409, { code: "validation_error", message: result.reason ?? "This execution cannot change state." })
    }
    if (!("execution" in result)) return error(404, { code: "unknown", message: "This execution is not in the history." })
    const execution = detailFor(result.execution.id)
    if (!execution) return error(404, { code: "unknown", message: "This execution is not in the history." })
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
  }),
]

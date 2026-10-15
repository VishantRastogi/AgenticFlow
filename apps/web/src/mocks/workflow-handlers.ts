import { http, HttpResponse } from "msw"
import type { ApiErrorBody } from "@/features/auth/types"
import { isWorkflowGraph } from "@/features/workflows/graph"
import { isWorkflowListQuery, queryWorkflows } from "@/features/workflows/query"
import type { WorkflowWriteInput } from "@/features/workflows/types"
import { auditActor, recordAudit } from "@/mocks/audit-store"
import {
  createStoredWorkflow,
  deleteStoredWorkflow,
  getStoredWorkflow,
  listWorkflows,
  publishStoredWorkflow,
  startStoredRun,
  updateStoredWorkflow,
} from "@/mocks/workflow-store"
import {
  cancelWorkflowExecution,
  decideWorkflowApproval,
  getWorkflowStudio,
  listWorkflowExecutions,
  publishWorkflowStudio,
  rollbackWorkflowStudio,
  startWorkflowExecution,
  validateWorkflowStudio,
} from "@/mocks/workflow-studio-store"
import type { WorkflowApprovalDecision, WorkflowExecutionRequest, WorkflowPublishRequest, WorkflowRollbackRequest } from "@/features/workflows/studio-types"
import type { StoreFailure } from "@/mocks/knowledge-store"

function error(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

function readWrite(body: Partial<WorkflowWriteInput>) {
  const name = body.name?.trim() ?? ""
  const description = body.description?.trim() ?? ""
  if (name.length < 2 || name.length > 64 || description.length > 280 || !isWorkflowGraph(body.graph)) return null
  return { name, description, graph: body.graph }
}

function isFailure(result: unknown): result is StoreFailure {
  return typeof result === "object" && result !== null && "ok" in result && (result as StoreFailure).ok === false
}

function workspaceOf(request: Request) {
  return new URL(request.url).searchParams.get("workspaceId") ?? ""
}

export const workflowHandlers = [
  http.get("*/api/workflows/:id/studio", ({ params, request }) => {
    const result = getWorkflowStudio(workspaceOf(request), String(params.id))
    if (isFailure(result)) return error(result.status, { code: result.code, message: result.message })
    return HttpResponse.json(result)
  }),

  http.get("*/api/workflows/:id/validation", ({ params, request }) => {
    const result = validateWorkflowStudio(workspaceOf(request), String(params.id))
    if (isFailure(result)) return error(result.status, { code: result.code, message: result.message })
    return HttpResponse.json(result)
  }),

  http.post("*/api/workflows/:id/studio/publish", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as WorkflowPublishRequest | null
    if (!body || body.workspaceId !== workspaceOf(request)) return error(400, { code: "validation_error", message: "Workspace scope does not match." })
    const result = publishWorkflowStudio(String(params.id), body)
    if (isFailure(result)) return error(result.status, { code: result.code, message: result.message })
    return HttpResponse.json(result)
  }),

  http.post("*/api/workflows/:id/studio/rollback", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as WorkflowRollbackRequest | null
    if (!body || body.workspaceId !== workspaceOf(request)) return error(400, { code: "validation_error", message: "Workspace scope does not match." })
    const result = rollbackWorkflowStudio(String(params.id), body)
    if (isFailure(result)) return error(result.status, { code: result.code, message: result.message })
    return HttpResponse.json(result)
  }),

  http.get("*/api/workflows/:id/executions", ({ params, request }) => {
    const result = listWorkflowExecutions(workspaceOf(request), String(params.id))
    if (isFailure(result)) return error(result.status, { code: result.code, message: result.message })
    return HttpResponse.json(result)
  }),

  http.post("*/api/workflows/:id/executions/:executionId/approval", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as WorkflowApprovalDecision | null
    if (!body || body.workspaceId !== workspaceOf(request)) return error(400, { code: "validation_error", message: "Workspace scope does not match." })
    const result = decideWorkflowApproval(String(params.id), String(params.executionId), body)
    if (isFailure(result)) return error(result.status, { code: result.code, message: result.message })
    return HttpResponse.json(result)
  }),

  http.post("*/api/workflows/:id/executions/:executionId/cancel", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as { workspaceId?: string } | null
    if (!body || body.workspaceId !== workspaceOf(request)) return error(400, { code: "validation_error", message: "Workspace scope does not match." })
    const result = cancelWorkflowExecution(String(params.id), String(params.executionId), body.workspaceId)
    if (isFailure(result)) return error(result.status, { code: result.code, message: result.message })
    return HttpResponse.json(result)
  }),

  http.post("*/api/workflows/:id/executions", async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as WorkflowExecutionRequest | null
    if (!body || body.workspaceId !== workspaceOf(request)) return error(400, { code: "validation_error", message: "Workspace scope does not match." })
    const result = startWorkflowExecution(String(params.id), body)
    if (isFailure(result)) return error(result.status, { code: result.code, message: result.message })
    return HttpResponse.json(result, { status: 201 })
  }),

  http.get("*/api/workflows", ({ request }) => {
    const url = new URL(request.url)
    const query = {
      q: url.searchParams.get("q") ?? "",
      status: url.searchParams.get("status") ?? "all",
      page: Number(url.searchParams.get("page") ?? "1"),
    }
    if (!isWorkflowListQuery(query)) {
      return error(400, { code: "validation_error", message: "Workflow filters are not supported." })
    }
    return HttpResponse.json({ ...queryWorkflows(listWorkflows(), query), simulated: true })
  }),

  http.post("*/api/workflows", async ({ request }) => {
    const parsed = readWrite((await request.json()) as Partial<WorkflowWriteInput>)
    if (!parsed) return error(400, { code: "validation_error", message: "Enter a workflow name and a graph." })
    const workflow = createStoredWorkflow(parsed)
    recordAudit({
      actor: auditActor(request),
      action: "workflow.created",
      resourceType: "workflow",
      resourceId: workflow.id,
      outcome: "succeeded",
      detail: `${workflow.name} was drafted.`,
      fields: { name: workflow.name },
    })
    return HttpResponse.json({ workflow }, { status: 201 })
  }),

  http.get("*/api/workflows/:id", ({ params }) => {
    const workflow = getStoredWorkflow(String(params.id))
    if (!workflow) return error(404, { code: "unknown", message: "This workflow is not in the catalog." })
    return HttpResponse.json({ workflow, simulated: true })
  }),

  http.patch("*/api/workflows/:id", async ({ params, request }) => {
    const body = (await request.json()) as Partial<WorkflowWriteInput> & { status?: string }
    if (body.status === "published") {
      return error(400, { code: "validation_error", message: "Use publish to mark a workflow published." })
    }
    const name = body.name?.trim()
    const description = body.description?.trim()
    if ((name !== undefined && (name.length < 2 || name.length > 64)) || (description !== undefined && description.length > 280)) {
      return error(400, { code: "validation_error", message: "Check the workflow name and description." })
    }
    if (body.graph !== undefined && !isWorkflowGraph(body.graph)) {
      return error(400, { code: "validation_error", message: "The workflow graph is not valid." })
    }
    const workflow = updateStoredWorkflow(String(params.id), {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(body.graph ? { graph: body.graph } : {}),
      ...(body.status === "draft" ? { status: "draft" as const } : {}),
    })
    if (!workflow) return error(404, { code: "unknown", message: "This workflow is not in the catalog." })
    recordAudit({
      actor: auditActor(request),
      action: "workflow.updated",
      resourceType: "workflow",
      resourceId: workflow.id,
      outcome: "succeeded",
      detail: `${workflow.name} was saved.`,
      fields: { status: workflow.status },
    })
    return HttpResponse.json({ workflow })
  }),

  http.post("*/api/workflows/:id/publish", ({ params, request }) => {
    const result = publishStoredWorkflow(String(params.id))
    if (result.error === "missing") return error(404, { code: "unknown", message: "This workflow is not in the catalog." })
    if (result.error === "invalid") {
      return error(400, { code: "validation_error", message: result.issues[0]?.message ?? "This workflow is not ready to publish." })
    }
    if (!result.workflow) return error(404, { code: "unknown", message: "This workflow is not in the catalog." })
    recordAudit({
      actor: auditActor(request),
      action: "workflow.published",
      resourceType: "workflow",
      resourceId: result.workflow.id,
      outcome: "succeeded",
      detail: `${result.workflow.name} was published.`,
      fields: { version: String(result.workflow.version) },
    })
    return HttpResponse.json({ workflow: result.workflow })
  }),

  http.post("*/api/workflows/:id/runs", ({ params, request }) => {
    const result = startStoredRun(String(params.id))
    if (result.error === "missing") return error(404, { code: "unknown", message: "This workflow is not in the catalog." })
    if (result.error === "invalid") {
      return error(400, { code: "validation_error", message: result.issues[0]?.message ?? "This workflow cannot run yet." })
    }
    recordAudit({
      actor: auditActor(request),
      action: "workflow.run_started",
      resourceType: "workflow",
      resourceId: String(params.id),
      outcome: "succeeded",
      detail: "A simulated workflow run was recorded.",
      fields: { runId: result.run.id },
    })
    return HttpResponse.json({ run: result.run }, { status: 201 })
  }),

  http.delete("*/api/workflows/:id", ({ params, request }) => {
    const id = String(params.id)
    if (!deleteStoredWorkflow(id)) {
      return error(404, { code: "unknown", message: "This workflow is not in the catalog." })
    }
    recordAudit({
      actor: auditActor(request),
      action: "workflow.deleted",
      resourceType: "workflow",
      resourceId: id,
      outcome: "succeeded",
      detail: "Workflow removed from the catalog.",
    })
    return new HttpResponse(null, { status: 204 })
  }),
]

import { callContract } from "@/features/api/real-adapter"
import type {
  WorkflowApprovalDecision,
  WorkflowExecutionList,
  WorkflowExecutionRecord,
  WorkflowExecutionRequest,
  WorkflowPublishRequest,
  WorkflowRollbackRequest,
  WorkflowStudioRecord,
  WorkflowValidationResult,
} from "@/features/workflows/studio-types"
import type {
  WorkflowListParams,
  WorkflowListResponse,
  WorkflowRecord,
  WorkflowRun,
  WorkflowWriteInput,
} from "@/features/workflows/types"

export function listWorkflows(params: WorkflowListParams) {
  return callContract<WorkflowListResponse>("workflows.list", {
    query: { q: params.q, status: params.status, page: params.page },
  })
}

export function getWorkflow(id: string) {
  return callContract<{ workflow: WorkflowRecord; simulated: true }>("workflows.get", { params: { id } })
}

export function createWorkflow(input: WorkflowWriteInput) {
  return callContract<{ workflow: WorkflowRecord }>("workflows.create", { body: input })
}

export function updateWorkflow(id: string, input: Partial<WorkflowWriteInput> & { status?: "draft" }) {
  return callContract<{ workflow: WorkflowRecord }>("workflows.update", { params: { id }, body: input })
}

export function deleteWorkflow(id: string) {
  return callContract<void>("workflows.delete", { params: { id } })
}

export function publishWorkflow(id: string) {
  return callContract<{ workflow: WorkflowRecord }>("workflows.publish", { params: { id } })
}

export function startWorkflowRun(id: string) {
  return callContract<{ run: WorkflowRun }>("workflows.run", { params: { id } })
}

export function getWorkflowStudio(workspaceId: string, id: string) {
  return callContract<WorkflowStudioRecord>("workflows.studio.get", { params: { id }, query: { workspaceId } })
}

export function validateWorkflowDraft(workspaceId: string, id: string) {
  return callContract<WorkflowValidationResult>("workflows.validation", { params: { id }, query: { workspaceId } })
}

export function publishWorkflowSnapshot(id: string, input: WorkflowPublishRequest) {
  return callContract<WorkflowStudioRecord>("workflows.studio.publish", {
    params: { id },
    query: { workspaceId: input.workspaceId },
    body: input,
  })
}

export function rollbackWorkflowSnapshot(id: string, input: WorkflowRollbackRequest) {
  return callContract<WorkflowStudioRecord>("workflows.studio.rollback", {
    params: { id },
    query: { workspaceId: input.workspaceId },
    body: input,
  })
}

export function listWorkflowExecutions(workspaceId: string, id: string) {
  return callContract<WorkflowExecutionList>("workflows.executions.list", { params: { id }, query: { workspaceId } })
}

export function startWorkflowExecution(id: string, input: WorkflowExecutionRequest, signal?: AbortSignal) {
  return callContract<WorkflowExecutionRecord>("workflows.executions.start", {
    params: { id },
    query: { workspaceId: input.workspaceId },
    body: input,
    signal,
  })
}

export function decideWorkflowApproval(id: string, executionId: string, input: WorkflowApprovalDecision) {
  return callContract<WorkflowExecutionRecord>("workflows.executions.approval", {
    params: { id, executionId },
    query: { workspaceId: input.workspaceId },
    body: input,
  })
}

export function cancelWorkflowExecution(id: string, executionId: string, workspaceId: string) {
  return callContract<WorkflowExecutionRecord>("workflows.executions.cancel", {
    params: { id, executionId },
    query: { workspaceId },
    body: { workspaceId },
  })
}

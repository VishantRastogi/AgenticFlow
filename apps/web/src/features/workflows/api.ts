import { callContract } from "@/features/api/real-adapter"
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

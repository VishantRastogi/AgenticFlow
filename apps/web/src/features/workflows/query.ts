import type { WorkflowListParams, WorkflowRecord, WorkflowSummary } from "@/features/workflows/types"

export const WORKFLOW_PAGE_SIZE = 6

export function isWorkflowListQuery(value: { q: string; status: string; page: number }): value is WorkflowListParams {
  return (value.status === "all" || value.status === "draft" || value.status === "published") && Number.isInteger(value.page) && value.page >= 1
}

export function queryWorkflows(workflows: WorkflowRecord[], query: WorkflowListParams) {
  const q = query.q.trim().toLowerCase()
  const rows = workflows
    .filter((workflow) => {
      const matchesQuery = q.length === 0 || workflow.name.toLowerCase().includes(q) || workflow.description.toLowerCase().includes(q)
      const matchesStatus = query.status === "all" || workflow.status === query.status
      return matchesQuery && matchesStatus
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const start = (query.page - 1) * WORKFLOW_PAGE_SIZE
  return {
    workflows: rows.slice(start, start + WORKFLOW_PAGE_SIZE).map(summarize),
    page: query.page,
    pageSize: WORKFLOW_PAGE_SIZE,
    total: rows.length,
  }
}

function summarize(workflow: WorkflowRecord): WorkflowSummary {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    version: workflow.version,
    updatedAt: workflow.updatedAt,
  }
}

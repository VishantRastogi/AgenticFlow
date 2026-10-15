import type { WorkflowGraph, WorkflowIssue } from "@/features/workflows/types"

export type WorkflowVersionSnapshot = {
  version: string
  publishedAt: string
  note: string
  graph: WorkflowGraph
  immutable: true
}

export type WorkflowStudioRecord = {
  simulated: true
  workspaceId: string
  workflowId: string
  publishedVersion: string | null
  versions: WorkflowVersionSnapshot[]
}

export type WorkflowPublishRequest = {
  workspaceId: string
  version: string
  note: string
}

export type WorkflowRollbackRequest = {
  workspaceId: string
  version: string
}

export type WorkflowValidationResult = {
  simulated: true
  workspaceId: string
  workflowId: string
  ok: boolean
  issues: WorkflowIssue[]
}

export type WorkflowExecutionStatus = "queued" | "running" | "waiting_for_approval" | "completed" | "failed" | "cancelled"

export type WorkflowNodeExecution = {
  nodeId: string
  status: "completed" | "failed" | "waiting_for_approval" | "cancelled"
  attempt: number
  branch: string | null
  durationMs: number
  tokens: number
  input: string
  output: string | null
  detail: string
}

export type WorkflowExecutionRecord = {
  id: string
  traceId: string
  simulated: true
  workspaceId: string
  workflowId: string
  workflowVersion: string
  status: WorkflowExecutionStatus
  timeline: WorkflowExecutionStatus[]
  nodes: WorkflowNodeExecution[]
  startedAt: string
  durationMs: number
  totalTokens: number
  estimatedCostUsd: number
  pendingApproval: { nodeId: string; role: string; message: string } | null
  notice: string
}

export type WorkflowExecutionRequest = {
  workspaceId: string
  version: string
}

export type WorkflowApprovalDecision = {
  workspaceId: string
  decision: "approve" | "reject"
  role: string
}

export type WorkflowExecutionList = {
  simulated: true
  workspaceId: string
  workflowId: string
  executions: WorkflowExecutionRecord[]
}

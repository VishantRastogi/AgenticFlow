export const workflowNodeKinds = [
  "trigger",
  "browser",
  "api",
  "model",
  "condition",
  "delay",
  "approval",
  "output",
] as const

export type WorkflowNodeKind = (typeof workflowNodeKinds)[number]
export type WorkflowStatus = "draft" | "published"
export type BrowserAction = "navigate" | "click" | "type"
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
export type NodeRunStatus = "idle" | "running" | "succeeded" | "failed"
export type RunOutcome = "succeeded" | "failed"

export type WorkflowNodeData = {
  label: string
  event?: string
  url?: string
  action?: BrowserAction
  method?: HttpMethod
  model?: string
  prompt?: string
  expression?: string
  durationMs?: number
  assignee?: string
}

export type WorkflowNode = {
  id: string
  type: WorkflowNodeKind
  position: { x: number; y: number }
  data: WorkflowNodeData
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
}

export type WorkflowGraph = {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export type WorkflowIssue = {
  code: "missing_trigger" | "missing_output" | "unreachable" | "invalid_connection" | "required"
  nodeId?: string
  edgeId?: string
  message: string
}

export type WorkflowSummary = {
  id: string
  name: string
  description: string
  status: WorkflowStatus
  version: number
  updatedAt: string
}

export type WorkflowRecord = WorkflowSummary & {
  graph: WorkflowGraph
}

export type WorkflowListResponse = {
  workflows: WorkflowSummary[]
  page: number
  pageSize: number
  total: number
  simulated: true
}

export type WorkflowListParams = {
  q: string
  status: "all" | WorkflowStatus
  page: number
}

export type WorkflowWriteInput = {
  name: string
  description: string
  graph: WorkflowGraph
}

export type RunStep = {
  nodeId: string
  outcome: RunOutcome
}

export type WorkflowRun = {
  id: string
  workflowId: string
  status: RunOutcome
  steps: RunStep[]
  startedAt: string
  simulated: true
}

export type PlaybackFrame = {
  nodeStatus: Record<string, NodeRunStatus>
  activeEdgeId: string | null
  litEdgeIds: string[]
}

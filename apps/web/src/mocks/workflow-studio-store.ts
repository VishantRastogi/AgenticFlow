import type { ApiErrorCode } from "@/features/auth/types"
import { toolCatalog } from "@/features/agents/studio-catalog"
import { simulateWorkflow } from "@/features/workflows/execution"
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
import type { WorkflowGraph } from "@/features/workflows/types"
import { validateWorkflow, type WorkflowReferenceIndex } from "@/features/workflows/validate"
import { isWorkspaceId } from "@/features/knowledge/validate"
import { getAgentStudio } from "@/mocks/agent-studio-store"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"
import { listIndexedChunks, listKnowledgeBases, type StoreFailure } from "@/mocks/knowledge-store"
import { listAgents } from "@/mocks/operations-store"
import { getStoredWorkflow, updateStoredWorkflow } from "@/mocks/workflow-store"

const STORAGE_KEY = "agentflow-mock-workflow-studio"

type RecordBody = {
  publishedVersion: string | null
  versions: WorkflowStudioRecord["versions"]
}

type Database = {
  sequence: number
  records: Record<string, RecordBody>
  executions: WorkflowExecutionRecord[]
}

function emptyDatabase(): Database {
  return { sequence: 1, records: {}, executions: [] }
}

function readDatabase(): Database {
  if (typeof localStorage === "undefined") return emptyDatabase()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyDatabase()
  try {
    const parsed = JSON.parse(raw) as Database
    if (!parsed || typeof parsed.sequence !== "number" || !parsed.records) return emptyDatabase()
    if (!Array.isArray(parsed.executions)) parsed.executions = []
    return parsed
  } catch {
    return emptyDatabase()
  }
}

function writeDatabase(database: Database) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
}

function failure(status: number, code: ApiErrorCode, message: string): StoreFailure {
  return { ok: false, status, code, message }
}

function key(workspaceId: string, workflowId: string) {
  return `${workspaceId}:${workflowId}`
}

function requireWorkflow(workspaceId: string, workflowId: string): StoreFailure | null {
  if (!isWorkspaceId(workspaceId)) return failure(400, "validation_error", "A workspace id is required.")
  if (!getStoredWorkflow(workflowId)) return failure(404, "not_found", "Workflow not found.")
  return null
}

function referenceIndex(workspaceId: string): WorkflowReferenceIndex {
  const knowledgeBaseIds: string[] = []
  let page = 1
  let total = 1
  while (knowledgeBaseIds.length < total && page < 20) {
    const listed = listKnowledgeBases({ workspaceId, q: "", status: "all", model: "all", sort: "name", page })
    total = listed.total
    knowledgeBaseIds.push(...listed.items.map((item) => item.id))
    if (listed.items.length === 0) break
    page += 1
  }
  const agents = listAgents().map((agent) => {
    const studio = getAgentStudio(workspaceId, agent.id)
    return { id: agent.id, versions: "versions" in studio ? studio.versions.map((version) => version.version) : [] }
  })
  return { knowledgeBaseIds, toolIds: toolCatalog.map((tool) => tool.id), agents }
}

function present(workspaceId: string, workflowId: string, database: Database): WorkflowStudioRecord {
  const record = database.records[key(workspaceId, workflowId)] ?? { publishedVersion: null, versions: [] }
  return {
    simulated: true,
    workspaceId,
    workflowId,
    publishedVersion: record.publishedVersion,
    versions: structuredClone(record.versions),
  }
}

export function getWorkflowStudio(workspaceId: string, workflowId: string): WorkflowStudioRecord | StoreFailure {
  const invalid = requireWorkflow(workspaceId, workflowId)
  if (invalid) return invalid
  return present(workspaceId, workflowId, readDatabase())
}

export function validateWorkflowStudio(workspaceId: string, workflowId: string): WorkflowValidationResult | StoreFailure {
  const invalid = requireWorkflow(workspaceId, workflowId)
  if (invalid) return invalid
  const workflow = getStoredWorkflow(workflowId)
  if (!workflow) return failure(404, "not_found", "Workflow not found.")
  const issues = validateWorkflow(workflow.graph, referenceIndex(workspaceId))
  return { simulated: true, workspaceId, workflowId, ok: issues.length === 0, issues }
}

function graphFor(database: Database, workspaceId: string, workflowId: string, version: string): WorkflowGraph | StoreFailure {
  const workflow = getStoredWorkflow(workflowId)
  if (!workflow) return failure(404, "not_found", "Workflow not found.")
  if (!version || version === "draft") return structuredClone(workflow.graph)
  const snapshot = database.records[key(workspaceId, workflowId)]?.versions.find((item) => item.version === version)
  if (!snapshot) return failure(404, "not_found", "Published workflow version not found.")
  return structuredClone(snapshot.graph)
}

export function publishWorkflowStudio(workflowId: string, input: WorkflowPublishRequest): WorkflowStudioRecord | StoreFailure {
  const invalid = requireWorkflow(input.workspaceId, workflowId)
  if (invalid) return invalid
  if (!/^\d+\.\d+\.\d+$/.test(input.version?.trim() ?? "")) return failure(400, "validation_error", "Use a version like 1.0.0.")
  const note = input.note?.trim() ?? ""
  if (note.length < 4 || note.length > 160) return failure(400, "validation_error", "Enter a publish note between 4 and 160 characters.")
  const workflow = getStoredWorkflow(workflowId)
  if (!workflow) return failure(404, "not_found", "Workflow not found.")
  const issues = validateWorkflow(workflow.graph, referenceIndex(input.workspaceId))
  if (issues.length > 0) return failure(400, "validation_error", issues[0]?.message ?? "This workflow is not ready to publish.")
  const database = readDatabase()
  const current = database.records[key(input.workspaceId, workflowId)] ?? { publishedVersion: null, versions: [] }
  if (current.versions.some((version) => version.version === input.version.trim())) {
    return failure(409, "invalid_job_transition", "That workflow version is already published and cannot be changed.")
  }
  current.versions = [
    {
      version: input.version.trim(),
      publishedAt: SIMULATED_NOW,
      note,
      graph: structuredClone(workflow.graph),
      immutable: true,
    },
    ...current.versions,
  ]
  current.publishedVersion = input.version.trim()
  database.records[key(input.workspaceId, workflowId)] = current
  writeDatabase(database)
  return present(input.workspaceId, workflowId, database)
}

export function rollbackWorkflowStudio(workflowId: string, input: WorkflowRollbackRequest): WorkflowStudioRecord | StoreFailure {
  const invalid = requireWorkflow(input.workspaceId, workflowId)
  if (invalid) return invalid
  const database = readDatabase()
  const current = database.records[key(input.workspaceId, workflowId)]
  const source = current?.versions.find((version) => version.version === input.version)
  if (!current || !source) return failure(404, "not_found", "Published workflow version not found.")
  updateStoredWorkflow(workflowId, { graph: structuredClone(source.graph), status: "draft" })
  return present(input.workspaceId, workflowId, database)
}

function chunksFor(workspaceId: string, knowledgeBaseId: string) {
  const indexed = listIndexedChunks(workspaceId, knowledgeBaseId)
  return indexed.ok ? indexed.chunks.map((chunk) => chunk.id) : []
}

export function startWorkflowExecution(workflowId: string, input: WorkflowExecutionRequest): WorkflowExecutionRecord | StoreFailure {
  const invalid = requireWorkflow(input.workspaceId, workflowId)
  if (invalid) return invalid
  const database = readDatabase()
  const graph = graphFor(database, input.workspaceId, workflowId, input.version || "draft")
  if ("ok" in graph && graph.ok === false) return graph
  const issues = validateWorkflow(graph as WorkflowGraph, referenceIndex(input.workspaceId))
  if (issues.length > 0) return failure(400, "validation_error", issues[0]?.message ?? "This workflow is not ready to run.")
  database.sequence += 1
  const refs = referenceIndex(input.workspaceId)
  const execution = simulateWorkflow(graph as WorkflowGraph, {
    workflowId,
    workspaceId: input.workspaceId,
    workflowVersion: input.version?.trim() || "draft",
    id: `wfx_${database.sequence}`,
    traceId: `trc_wf_${database.sequence}`,
    startedAt: SIMULATED_NOW,
    decisions: {},
    chunks: (knowledgeBaseId) => chunksFor(input.workspaceId, knowledgeBaseId),
    toolIds: refs.toolIds,
    publishedAgents: refs.agents,
    requirePublishedAgents: Boolean(input.version && input.version !== "draft"),
  })
  database.executions = [execution, ...database.executions]
  writeDatabase(database)
  return execution
}

export function decideWorkflowApproval(workflowId: string, executionId: string, input: WorkflowApprovalDecision): WorkflowExecutionRecord | StoreFailure {
  const invalid = requireWorkflow(input.workspaceId, workflowId)
  if (invalid) return invalid
  const database = readDatabase()
  const current = database.executions.find((item) => item.id === executionId && item.workflowId === workflowId && item.workspaceId === input.workspaceId)
  if (!current || !current.pendingApproval) return failure(404, "not_found", "Execution not found.")
  if (current.status !== "waiting_for_approval") return failure(409, "invalid_job_transition", "This execution is not waiting for approval.")
  if (input.role !== current.pendingApproval.role) return failure(400, "validation_error", "This role cannot approve the step.")
  if (input.decision !== "approve" && input.decision !== "reject") return failure(400, "validation_error", "Choose approve or reject.")
  const graph = graphFor(database, input.workspaceId, workflowId, current.workflowVersion)
  if ("ok" in graph && graph.ok === false) return graph
  const decisions = Object.fromEntries(current.nodes.filter((node) => node.branch === "approve" || node.branch === "reject").map((node) => [node.nodeId, node.branch as "approve" | "reject"]))
  decisions[current.pendingApproval.nodeId] = input.decision
  const refs = referenceIndex(input.workspaceId)
  const next = simulateWorkflow(graph as WorkflowGraph, {
    workflowId,
    workspaceId: input.workspaceId,
    workflowVersion: current.workflowVersion,
    id: current.id,
    traceId: current.traceId,
    startedAt: current.startedAt,
    decisions,
    chunks: (knowledgeBaseId) => chunksFor(input.workspaceId, knowledgeBaseId),
    toolIds: refs.toolIds,
    publishedAgents: refs.agents,
    requirePublishedAgents: current.workflowVersion !== "draft",
  })
  database.executions = database.executions.map((item) => (item.id === current.id && item.workspaceId === current.workspaceId ? next : item))
  writeDatabase(database)
  return next
}

export function cancelWorkflowExecution(workflowId: string, executionId: string, workspaceId: string): WorkflowExecutionRecord | StoreFailure {
  const invalid = requireWorkflow(workspaceId, workflowId)
  if (invalid) return invalid
  const database = readDatabase()
  const current = database.executions.find((item) => item.id === executionId && item.workflowId === workflowId && item.workspaceId === workspaceId)
  if (!current) return failure(404, "not_found", "Execution not found.")
  if (current.status === "completed" || current.status === "failed" || current.status === "cancelled") {
    return failure(409, "invalid_job_transition", "This execution can no longer be cancelled.")
  }
  current.status = "cancelled"
  current.timeline = [...current.timeline, "cancelled"]
  if (current.pendingApproval) {
    current.nodes = current.nodes.map((node) => (node.nodeId === current.pendingApproval?.nodeId ? { ...node, status: "cancelled" } : node))
    current.pendingApproval = null
  }
  writeDatabase(database)
  return structuredClone(current)
}

export function listWorkflowExecutions(workspaceId: string, workflowId: string): WorkflowExecutionList | StoreFailure {
  const invalid = requireWorkflow(workspaceId, workflowId)
  if (invalid) return invalid
  return {
    simulated: true,
    workspaceId,
    workflowId,
    executions: readDatabase().executions.filter((item) => item.workspaceId === workspaceId && item.workflowId === workflowId),
  }
}

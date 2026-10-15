import { isWorkflowGraph } from "@/features/workflows/graph"
import { planWorkflowRun } from "@/features/workflows/simulate"
import type { WorkflowGraph, WorkflowRecord, WorkflowRun, WorkflowWriteInput } from "@/features/workflows/types"
import { isWorkspaceId } from "@/features/knowledge/validate"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"
import { workflowFixture } from "@/mocks/fixtures/workflows"

const DEFAULT_WORKSPACE = "local"

const STORAGE_KEY = "agentflow-mock-workflows"

type Overlay = {
  sequence: number
  created: WorkflowRecord[]
  patches: Record<string, Partial<WorkflowRecord>>
  deletedIds: string[]
  runs: WorkflowRun[]
}

function emptyOverlay(): Overlay {
  return { sequence: 0, created: [], patches: {}, deletedIds: [], runs: [] }
}

function isOverlay(value: unknown): value is Overlay {
  if (!value || typeof value !== "object") return false
  const overlay = value as Partial<Overlay>
  return Array.isArray(overlay.created) && overlay.patches !== undefined && Array.isArray(overlay.deletedIds) && Array.isArray(overlay.runs)
}

function readOverlay(): Overlay {
  if (typeof localStorage === "undefined") return emptyOverlay()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyOverlay()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isOverlay(parsed)) return parsed
  } catch {
    return emptyOverlay()
  }
  return emptyOverlay()
}

function writeOverlay(overlay: Overlay) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay))
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "workflow"
}

function workspaceOf(workflow: WorkflowRecord) {
  return workflow.workspaceId ?? DEFAULT_WORKSPACE
}

function allWorkflows(): WorkflowRecord[] {
  const overlay = readOverlay()
  const deleted = new Set(overlay.deletedIds)
  const base = workflowFixture
    .filter((workflow) => !deleted.has(workflow.id))
    .map((workflow) => applyPatch(workflow, overlay.patches[workflow.id]))
  const known = new Set(base.map((workflow) => workflow.id))
  const created = overlay.created
    .filter((workflow) => !deleted.has(workflow.id) && !known.has(workflow.id))
    .map((workflow) => applyPatch(workflow, overlay.patches[workflow.id]))
  return [...base, ...created]
}

export function listWorkflows(workspaceId = DEFAULT_WORKSPACE): WorkflowRecord[] {
  return allWorkflows().filter((workflow) => workspaceOf(workflow) === workspaceId)
}

export function getStoredWorkflow(id: string, workspaceId = DEFAULT_WORKSPACE) {
  return listWorkflows(workspaceId).find((workflow) => workflow.id === id) ?? null
}

export function createStoredWorkflow(input: WorkflowWriteInput) {
  const workspaceId = input.workspaceId?.trim() || DEFAULT_WORKSPACE
  if (!isWorkspaceId(workspaceId)) return null
  const overlay = readOverlay()
  overlay.sequence += 1
  const workflow: WorkflowRecord = {
    id: `wf_${slug(input.name)}_${overlay.sequence}`,
    name: input.name.trim(),
    description: input.description.trim(),
    status: "draft",
    version: 1,
    updatedAt: SIMULATED_NOW,
    graph: input.graph,
    workspaceId,
  }
  overlay.created.push(workflow)
  writeOverlay(overlay)
  return workflow
}

export function updateStoredWorkflow(id: string, patch: Partial<WorkflowWriteInput> & { status?: "draft" }, workspaceId = DEFAULT_WORKSPACE) {
  const current = getStoredWorkflow(id, workspaceId)
  if (!current) return null
  const overlay = readOverlay()
  const next: WorkflowRecord = {
    ...current,
    ...patch,
    name: patch.name?.trim() ?? current.name,
    description: patch.description?.trim() ?? current.description,
    graph: patch.graph ?? current.graph,
    status: patch.status === "draft" ? "draft" : current.status,
    updatedAt: SIMULATED_NOW,
  }
  overlay.patches[id] = next
  writeOverlay(overlay)
  return getStoredWorkflow(id, workspaceId)
}

export function deleteStoredWorkflow(id: string, workspaceId = DEFAULT_WORKSPACE) {
  if (!getStoredWorkflow(id, workspaceId)) return false
  const overlay = readOverlay()
  overlay.deletedIds = [...new Set([...overlay.deletedIds, id])]
  overlay.created = overlay.created.filter((workflow) => workflow.id !== id)
  writeOverlay(overlay)
  return true
}

export function applyPublishedRelease(id: string, workspaceId = DEFAULT_WORKSPACE, version?: number) {
  const current = getStoredWorkflow(id, workspaceId)
  if (!current) return null
  const overlay = readOverlay()
  const next: WorkflowRecord = {
    ...current,
    status: "published",
    version: version ?? current.version + 1,
    updatedAt: SIMULATED_NOW,
  }
  overlay.patches[id] = next
  writeOverlay(overlay)
  return getStoredWorkflow(id, workspaceId)
}

export function startStoredRun(id: string, workspaceId = DEFAULT_WORKSPACE, graph?: WorkflowGraph) {
  const current = getStoredWorkflow(id, workspaceId)
  if (!current) return { error: "missing" as const }
  const executable = graph ?? current.graph
  if (!isWorkflowGraph(executable)) return { error: "invalid" as const, issues: [] }
  const plan = planWorkflowRun(executable)
  if (!plan.ok) return { error: "invalid" as const, issues: plan.issues }

  const overlay = readOverlay()
  const failed = plan.steps.some((step) => step.outcome === "failed")
  const run: WorkflowRun = {
    id: `run_${overlay.runs.length + 1}`,
    workflowId: id,
    status: failed ? "failed" : "succeeded",
    steps: plan.steps,
    startedAt: SIMULATED_NOW,
    simulated: true,
  }
  overlay.runs.push(run)
  writeOverlay(overlay)
  return { run }
}

export function listStoredRuns(workspaceId = DEFAULT_WORKSPACE): WorkflowRun[] {
  const ids = new Set(listWorkflows(workspaceId).map((workflow) => workflow.id))
  return readOverlay().runs.filter((run) => ids.has(run.workflowId))
}

function applyPatch(workflow: WorkflowRecord, patch?: Partial<WorkflowRecord>) {
  if (!patch) return workflow
  return { ...workflow, ...patch, graph: patch.graph ?? workflow.graph }
}

export function readStoredGraph(value: unknown): WorkflowGraph | null {
  return isWorkflowGraph(value) ? value : null
}

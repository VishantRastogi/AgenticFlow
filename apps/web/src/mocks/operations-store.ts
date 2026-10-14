import type { AgentRecord, ExecutionRecord, ExecutionStatus } from "@/features/dashboard/types"
import type { AgentProfile, AgentVersion } from "@/features/agents/types"
import { advanceExecution, cancelPermission, defaultCursor, durationFromId, retryPermission } from "@/features/executions/lifecycle"
import { SIMULATED_NOW, operationsFixture } from "@/mocks/fixtures/operations"

const STORAGE_KEY = "agentflow-mock-operations"

type ExecutionPatch = {
  status?: ExecutionStatus
  durationMs?: number | null
  cursor?: number
  attempt?: number
  retryOf?: string | null
}

type Overlay = {
  sequence: number
  created: AgentRecord[]
  patches: Record<string, Partial<AgentRecord>>
  deletedIds: string[]
  executions: ExecutionRecord[]
  versions: Record<string, AgentVersion[]>
  executionPatches?: Record<string, ExecutionPatch>
}

const profileDefaults = {
  description: "Created from Mission Control.",
  type: "operator" as const,
  timeoutMs: 30000,
  retryPolicy: "fixed" as const,
  version: "0.1.0",
  configuration: { model: "orbit-small" } as Record<string, unknown>,
  updatedAt: SIMULATED_NOW,
}

function emptyOverlay(): Overlay {
  return { sequence: 0, created: [], patches: {}, deletedIds: [], executions: [], versions: {} }
}

function isOverlay(value: unknown): value is Overlay {
  if (!value || typeof value !== "object") return false
  const overlay = value as Partial<Overlay>
  return Array.isArray(overlay.created) && overlay.patches !== undefined && Array.isArray(overlay.deletedIds)
}

function isLegacyCatalog(value: unknown): value is { agents: AgentRecord[] } {
  if (!value || typeof value !== "object") return false
  return Array.isArray((value as { agents?: unknown }).agents)
}

export function completeProfile(agent: AgentRecord): AgentProfile {
  return {
    id: agent.id,
    name: agent.name,
    environment: agent.environment,
    status: agent.status,
    description: agent.description ?? profileDefaults.description,
    type: agent.type ?? profileDefaults.type,
    timeoutMs: agent.timeoutMs ?? profileDefaults.timeoutMs,
    retryPolicy: agent.retryPolicy ?? profileDefaults.retryPolicy,
    version: agent.version ?? profileDefaults.version,
    configuration: agent.configuration ?? profileDefaults.configuration,
    updatedAt: agent.updatedAt ?? profileDefaults.updatedAt,
  }
}

function readOverlay(): Overlay {
  if (typeof localStorage === "undefined") return emptyOverlay()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyOverlay()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (isOverlay(parsed)) return parsed
    if (isLegacyCatalog(parsed)) {
      return { ...emptyOverlay(), sequence: parsed.agents.length, created: parsed.agents }
    }
  } catch {
    return emptyOverlay()
  }

  return emptyOverlay()
}

function writeOverlay(overlay: Overlay) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay))
}

function applyPatch(agent: AgentProfile, patch?: Partial<AgentRecord>) {
  if (!patch) return agent
  return completeProfile({ ...agent, ...patch })
}

export function listAgents(): AgentProfile[] {
  const overlay = readOverlay()
  const deleted = new Set(overlay.deletedIds)
  const base = operationsFixture.agents
    .filter((agent) => !deleted.has(agent.id))
    .map((agent) => applyPatch(completeProfile(agent), overlay.patches[agent.id]))
  const known = new Set(base.map((agent) => agent.id))
  const created = overlay.created
    .filter((agent) => !deleted.has(agent.id) && !known.has(agent.id))
    .map((agent) => applyPatch(completeProfile(agent), overlay.patches[agent.id]))
  return [...base, ...created]
}

export function listExecutions(): ExecutionRecord[] {
  const overlay = readOverlay()
  const deleted = new Set(overlay.deletedIds)
  const patches = overlay.executionPatches ?? {}
  return [...operationsFixture.executions, ...overlay.executions]
    .filter((execution) => !deleted.has(execution.agentId))
    .map((execution) => applyExecutionPatch(execution, patches[execution.id]))
}

export function executionCursor(id: string, record: ExecutionRecord) {
  const patch = readOverlay().executionPatches?.[id]
  return patch?.cursor ?? defaultCursor(record.status)
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "agent"
}

export function createStoredAgent(input: {
  name: string
  environment: AgentRecord["environment"]
  description?: string
  type?: AgentProfile["type"]
  timeoutMs?: number
  retryPolicy?: AgentProfile["retryPolicy"]
  version?: string
  configuration?: Record<string, unknown>
}) {
  const overlay = readOverlay()
  overlay.sequence += 1
  const agent = completeProfile({
    id: `agt_${slug(input.name)}_${overlay.sequence}`,
    name: input.name.trim(),
    environment: input.environment,
    status: "idle",
    description: input.description,
    type: input.type,
    timeoutMs: input.timeoutMs,
    retryPolicy: input.retryPolicy,
    version: input.version,
    configuration: input.configuration,
    updatedAt: SIMULATED_NOW,
  })
  overlay.created.push(agent)
  overlay.versions[agent.id] = [{ version: agent.version, updatedAt: agent.updatedAt, note: "Created in Agent Studio" }]
  writeOverlay(overlay)
  return agent
}

export function updateStoredAgent(id: string, patch: Partial<AgentRecord>) {
  const current = listAgents().find((agent) => agent.id === id)
  if (!current) return null
  const overlay = readOverlay()
  const nextPatch = { ...(overlay.patches[id] ?? {}), ...patch, updatedAt: SIMULATED_NOW }
  overlay.patches[id] = nextPatch
  if (patch.version && patch.version !== current.version) {
    const history = overlay.versions[id] ?? defaultVersions(current)
    overlay.versions[id] = [
      { version: patch.version, updatedAt: SIMULATED_NOW, note: "Updated in Agent Studio" },
      ...history.filter((item) => item.version !== patch.version),
    ]
  }
  writeOverlay(overlay)
  return listAgents().find((agent) => agent.id === id) ?? null
}

export function deleteStoredAgent(id: string) {
  if (!listAgents().some((agent) => agent.id === id)) return false
  const overlay = readOverlay()
  overlay.deletedIds = [...new Set([...overlay.deletedIds, id])]
  overlay.created = overlay.created.filter((agent) => agent.id !== id)
  writeOverlay(overlay)
  return true
}

export function triggerStoredExecution(id: string) {
  const agent = listAgents().find((item) => item.id === id)
  if (!agent) return { error: "missing" as const }
  if (agent.status === "paused") return { error: "paused" as const }

  const overlay = readOverlay()
  const failed = agent.status === "error"
  const execution: ExecutionRecord = {
    id: `exe_trig_${overlay.executions.length + 1}`,
    agentId: agent.id,
    environment: agent.environment,
    status: failed ? "failed" : "succeeded",
    startedAt: new Date(Date.parse(SIMULATED_NOW) - overlay.executions.length * 1000).toISOString(),
    durationMs: failed ? 2400 : 900,
  }
  overlay.executions.push(execution)
  writeOverlay(overlay)
  return { execution }
}

export function versionsFor(agent: AgentProfile) {
  const stored = readOverlay().versions[agent.id]
  return stored?.length ? stored : defaultVersions(agent)
}

function defaultVersions(agent: AgentProfile): AgentVersion[] {
  return [
    { version: agent.version, updatedAt: agent.updatedAt, note: "Current configuration" },
    { version: previousVersion(agent.version), updatedAt: agent.updatedAt, note: "Previous release" },
  ]
}

export function tickStoredExecution(id: string) {
  const current = listExecutions().find((execution) => execution.id === id)
  const agent = current ? listAgents().find((item) => item.id === current.agentId) : null
  if (!current || !agent) return { error: "missing" as const }
  const cursor = executionCursor(id, current)
  const next = advanceExecution({ status: current.status, cursor }, agent.status)
  if (next.status === current.status && next.cursor === cursor) return { execution: current }
  const overlay = readOverlay()
  overlay.executionPatches = overlay.executionPatches ?? {}
  overlay.executionPatches[id] = {
    ...(overlay.executionPatches[id] ?? {}),
    status: next.status,
    cursor: next.cursor,
    durationMs: next.status === "completed" || next.status === "failed" ? (current.durationMs ?? durationFromId(current.id)) : null,
  }
  writeOverlay(overlay)
  return { execution: listExecutions().find((execution) => execution.id === id) ?? current }
}

export function cancelStoredExecution(id: string) {
  const current = listExecutions().find((execution) => execution.id === id)
  if (!current) return { error: "missing" as const }
  const permission = cancelPermission(current.status)
  if (!permission.allowed) return { error: "invalid" as const, reason: permission.reason }
  const overlay = readOverlay()
  overlay.executionPatches = overlay.executionPatches ?? {}
  overlay.executionPatches[id] = {
    ...(overlay.executionPatches[id] ?? {}),
    status: "cancelled",
    cursor: executionCursor(id, current),
    durationMs: current.durationMs ?? durationFromId(current.id),
  }
  writeOverlay(overlay)
  return { execution: listExecutions().find((execution) => execution.id === id) ?? current }
}

export function retryStoredExecution(id: string) {
  const current = listExecutions().find((execution) => execution.id === id)
  const agent = current ? listAgents().find((item) => item.id === current.agentId) : null
  if (!current || !agent) return { error: "missing" as const }
  const attempt = current.attempt ?? 1
  const permission = retryPermission({ status: current.status, attempt, policy: agent.retryPolicy })
  if (!permission.allowed) return { error: "invalid" as const, reason: permission.reason }
  const overlay = readOverlay()
  const execution: ExecutionRecord = {
    id: `exe_retry_${overlay.executions.length + 1}`,
    agentId: current.agentId,
    environment: current.environment,
    status: "queued",
    startedAt: SIMULATED_NOW,
    durationMs: null,
    attempt: attempt + 1,
    retryOf: current.id,
  }
  overlay.executions.push(execution)
  writeOverlay(overlay)
  return { execution }
}

function applyExecutionPatch(execution: ExecutionRecord, patch?: ExecutionPatch): ExecutionRecord {
  if (!patch) return execution
  return {
    ...execution,
    status: patch.status ?? execution.status,
    durationMs: patch.durationMs === undefined ? execution.durationMs : patch.durationMs,
    attempt: patch.attempt ?? execution.attempt,
    retryOf: patch.retryOf === undefined ? execution.retryOf : patch.retryOf,
    cursor: patch.cursor ?? execution.cursor,
  }
}

function previousVersion(version: string) {
  const [major = "0", minor = "0", patch = "0"] = version.split(".")
  const patchNumber = Number(patch)
  if (Number.isFinite(patchNumber) && patchNumber > 0) return `${major}.${minor}.${patchNumber - 1}`
  return "0.9.0"
}

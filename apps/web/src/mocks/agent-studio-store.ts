import type { ApiErrorCode } from "@/features/auth/types"
import { defaultAgentConfiguration } from "@/features/agents/studio-catalog"
import type {
  AgentConfiguration,
  AgentExecutionStep,
  AgentPublishRequest,
  AgentRollbackRequest,
  AgentStudioRecord,
  AgentTestRequest,
  AgentTestResponse,
  AgentVersionSnapshot,
} from "@/features/agents/studio-types"
import { assessAgentConfiguration } from "@/features/agents/studio-validate"
import { agentModel } from "@/features/agents/studio-catalog"
import { isWorkspaceId } from "@/features/knowledge/validate"
import { listIndexedChunks, type StoreFailure } from "@/mocks/knowledge-store"
import { listAgents, updateStoredAgent } from "@/mocks/operations-store"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"

const STORAGE_KEY = "agentflow-mock-agent-studio"

type Database = {
  sequence: number
  records: Record<string, { draft: AgentConfiguration; publishedVersion: string | null; versions: AgentVersionSnapshot[] }>
}

function emptyDatabase(): Database {
  return { sequence: 1, records: {} }
}

function readDatabase(): Database {
  if (typeof localStorage === "undefined") return emptyDatabase()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyDatabase()
  try {
    const parsed = JSON.parse(raw) as Database
    if (!parsed || typeof parsed.sequence !== "number" || !parsed.records) return emptyDatabase()
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

function key(workspaceId: string, agentId: string) {
  return `${workspaceId}:${agentId}`
}

function requireScope(workspaceId: string, agentId: string): StoreFailure | null {
  if (!isWorkspaceId(workspaceId)) return failure(400, "validation_error", "A workspace id is required.")
  if (!listAgents().some((agent) => agent.id === agentId)) return failure(404, "not_found", "Agent not found.")
  return null
}

function warningsFor(workspaceId: string, knowledge: AgentConfiguration["knowledge"]) {
  const warnings: string[] = []
  for (const binding of knowledge) {
    const indexed = listIndexedChunks(workspaceId, binding.knowledgeBaseId)
    if (!indexed.ok) {
      warnings.push("An attached knowledge base was not found in this workspace.")
      continue
    }
    if (indexed.chunks.length === 0) warnings.push(`${binding.knowledgeBaseId} has no READY documents. Retrieval will not invent chunks.`)
  }
  return warnings
}

function present(workspaceId: string, agentId: string, database: Database): AgentStudioRecord {
  const record = database.records[key(workspaceId, agentId)] ?? {
    draft: defaultAgentConfiguration(),
    publishedVersion: null,
    versions: [],
  }
  return {
    simulated: true,
    workspaceId,
    agentId,
    draft: structuredClone(record.draft),
    publishedVersion: record.publishedVersion,
    versions: structuredClone(record.versions),
    warnings: warningsFor(workspaceId, record.draft.knowledge),
  }
}

export function getAgentStudio(workspaceId: string, agentId: string): AgentStudioRecord | StoreFailure {
  const invalid = requireScope(workspaceId, agentId)
  if (invalid) return invalid
  return present(workspaceId, agentId, readDatabase())
}

export function saveAgentStudio(workspaceId: string, agentId: string, draft: AgentConfiguration): AgentStudioRecord | StoreFailure {
  const invalid = requireScope(workspaceId, agentId)
  if (invalid) return invalid
  const assessed = assessAgentConfiguration(draft)
  if (!assessed.ok) return failure(400, "validation_error", assessed.message)
  for (const binding of assessed.configuration.knowledge) {
    const indexed = listIndexedChunks(workspaceId, binding.knowledgeBaseId)
    if (!indexed.ok) return failure(404, "not_found", "Knowledge base not found.")
  }
  const database = readDatabase()
  const current = database.records[key(workspaceId, agentId)] ?? {
    draft: defaultAgentConfiguration(),
    publishedVersion: null,
    versions: [],
  }
  current.draft = assessed.configuration
  database.records[key(workspaceId, agentId)] = current
  writeDatabase(database)
  return present(workspaceId, agentId, database)
}

export function publishAgentStudio(agentId: string, input: AgentPublishRequest): AgentStudioRecord | StoreFailure {
  const invalid = requireScope(input.workspaceId, agentId)
  if (invalid) return invalid
  if (!/^\d+\.\d+\.\d+$/.test(input.version?.trim() ?? "")) return failure(400, "validation_error", "Use a version like 1.0.0.")
  const note = input.note?.trim() ?? ""
  if (note.length < 4 || note.length > 160) return failure(400, "validation_error", "Enter a publish note between 4 and 160 characters.")
  const database = readDatabase()
  const current = database.records[key(input.workspaceId, agentId)] ?? {
    draft: defaultAgentConfiguration(),
    publishedVersion: null,
    versions: [],
  }
  const assessed = assessAgentConfiguration(current.draft)
  if (!assessed.ok) return failure(400, "validation_error", assessed.message)
  if (current.versions.some((version) => version.version === input.version.trim())) {
    return failure(409, "invalid_job_transition", "That version is already published and cannot be changed.")
  }
  const snapshot: AgentVersionSnapshot = {
    version: input.version.trim(),
    publishedAt: SIMULATED_NOW,
    note,
    configuration: structuredClone(assessed.configuration),
    immutable: true,
  }
  current.versions = [snapshot, ...current.versions]
  current.publishedVersion = snapshot.version
  current.draft = assessed.configuration
  database.records[key(input.workspaceId, agentId)] = current
  writeDatabase(database)
  updateStoredAgent(agentId, { version: snapshot.version })
  return present(input.workspaceId, agentId, database)
}

export function rollbackAgentStudio(agentId: string, input: AgentRollbackRequest): AgentStudioRecord | StoreFailure {
  const invalid = requireScope(input.workspaceId, agentId)
  if (invalid) return invalid
  const database = readDatabase()
  const current = database.records[key(input.workspaceId, agentId)]
  const source = current?.versions.find((version) => version.version === input.version)
  if (!current || !source) return failure(404, "not_found", "Published version not found.")
  current.draft = structuredClone(source.configuration)
  writeDatabase(database)
  return present(input.workspaceId, agentId, database)
}

function configurationFor(record: Database["records"][string] | undefined, version: string): AgentConfiguration | StoreFailure {
  if (!version || version === "draft") return record?.draft ?? defaultAgentConfiguration()
  const published = record?.versions.find((item) => item.version === version)
  if (!published) return failure(404, "not_found", "Published version not found.")
  return structuredClone(published.configuration)
}

export function testAgentStudio(agentId: string, input: AgentTestRequest): AgentTestResponse | StoreFailure {
  const invalid = requireScope(input.workspaceId, agentId)
  if (invalid) return invalid
  if (typeof input.input !== "string" || input.input.trim().length < 2) return failure(400, "validation_error", "Enter a test input.")
  if (/\brate limit\b/i.test(input.input)) {
    return failure(429, "rate_limited", "The simulated agent runtime applied a rate limit. Wait and retry this test.")
  }
  const database = readDatabase()
  const record = database.records[key(input.workspaceId, agentId)]
  const selected = configurationFor(record, input.version || "draft")
  if ("ok" in selected && selected.ok === false) return selected
  const configuration = selected as AgentConfiguration
  const databaseAfter = readDatabase()
  databaseAfter.sequence += 1
  const requestId = `agt_test_${databaseAfter.sequence}`
  writeDatabase(databaseAfter)
  return simulate(requestId, input.workspaceId, agentId, input.version || "draft", input.input.trim(), configuration)
}

function simulate(
  requestId: string,
  workspaceId: string,
  agentId: string,
  version: string,
  text: string,
  configuration: AgentConfiguration,
): AgentTestResponse {
  const steps: AgentExecutionStep[] = []
  let tokens = 0
  let duration = 0
  let cost = 0
  const rate = agentModel(configuration.model.model)?.ratePer1k ?? 0.002
  let status: AgentTestResponse["status"] = "completed"
  let error: string | null = null

  const room = (nextTokens: number, nextDuration: number) => {
    if (steps.length >= configuration.execution.maxSteps) return "steps"
    if (duration + nextDuration > configuration.execution.timeoutMs || duration + nextDuration > configuration.execution.maxDurationMs) return "timeout"
    if (tokens + nextTokens > configuration.execution.maxTokenBudget) return "tokens"
    const nextCost = Math.round(((tokens + nextTokens) / 1000) * rate * 1_000_000) / 1_000_000
    if (nextCost > configuration.execution.budgetUsd) return "budget"
    return null
  }

  const push = (step: Omit<AgentExecutionStep, "id" | "index">) => {
    const blocked = room(step.tokens, step.durationMs)
    if (blocked) {
      status = "limited"
      if (blocked !== "steps") {
        steps.push({
          id: `${requestId}_${steps.length + 1}`,
          index: steps.length + 1,
          kind: "limit",
          title: "Execution limit",
          detail:
            blocked === "timeout"
              ? "Timeout reached. No further simulated steps ran."
              : blocked === "tokens"
                ? "Token budget reached. No further simulated steps ran."
                : "Cost budget reached. No further simulated steps ran.",
          durationMs: 0,
          tokens: 0,
        })
      }
      return false
    }
    tokens += step.tokens
    duration += step.durationMs
    cost = Math.round((tokens / 1000) * rate * 1_000_000) / 1_000_000
    steps.push({ ...step, id: `${requestId}_${steps.length + 1}`, index: steps.length + 1 })
    return true
  }

  const masked = configuration.guardrails.maskSensitiveData && /secret|password|\b\d{12,}\b/i.test(text)
  const continued = push({
    kind: "validate",
    title: "Validate input",
    detail: masked
      ? "Sensitive text was masked in this simulated trace. Enforcement still belongs to the runtime."
      : "Input accepted by the simulated policy. The runtime enforces this for real calls.",
    durationMs: 5,
    tokens: 8,
  })

  if (continued && /fail this run/i.test(text)) {
    status = "failed"
    error = "The simulated runtime stopped this test. No tool was executed."
    push({
      kind: "error",
      title: "Simulated failure",
      detail: error,
      durationMs: 4,
      tokens: 2,
    })
  } else if (continued) {
    for (const binding of configuration.knowledge) {
      const indexed = listIndexedChunks(workspaceId, binding.knowledgeBaseId)
      const chunkIds = indexed.ok ? indexed.chunks.slice(0, binding.topK).map((chunk) => chunk.id) : []
      const ok = push({
        kind: "retrieve",
        title: "Retrieve knowledge",
        detail:
          chunkIds.length === 0
            ? `${binding.knowledgeBaseId} contributed no READY chunks. Nothing was invented.`
            : `Simulated ${binding.strategy} retrieval returned ${chunkIds.length} ready chunk${chunkIds.length === 1 ? "" : "s"}.`,
        durationMs: 12,
        tokens: 20,
        chunkIds,
      })
      if (!ok) break
    }
    const allowed = configuration.tools.filter(
      (tool) => tool.enabled && configuration.guardrails.allowedToolIds.includes(tool.id),
    )
    let calls = 0
    for (const tool of allowed) {
      if (calls >= configuration.execution.maxToolCalls) break
      if (configuration.model.toolCalling === "none") break
      calls += 1
      const sideEffect = tool.permission === "side_effect"
      const ok = push({
        kind: "tool",
        title: tool.name,
        detail: sideEffect
          ? "Side effect was not performed. No credentials were read, and no request left the browser."
          : "Read-only tool was simulated. No code was evaluated.",
        durationMs: 8,
        tokens: 12,
        toolId: tool.id,
      })
      if (!ok) break
    }
    if (status === "completed") {
      push({
        kind: "respond",
        title: "Simulated response",
        detail: `Simulated answer for “${masked ? "[masked]" : text.slice(0, 80)}”. This was not produced by ${configuration.model.model}.`,
        durationMs: 15,
        tokens: Math.min(configuration.model.maxOutputTokens, 40),
      })
    }
  }

  return {
    simulated: true,
    requestId,
    workspaceId,
    agentId,
    version,
    status,
    steps,
    usage: { promptTokens: Math.min(tokens, 24), completionTokens: Math.max(tokens - 24, 0), totalTokens: tokens },
    latencyMs: duration,
    estimatedCostUsd: cost,
    error,
    notice: "Simulated agent test. No model, tool, or memory service was called.",
  }
}

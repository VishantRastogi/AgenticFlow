import type { AgentExecutionStep, AgentTestRunRecord } from "@/features/agents/studio-types"
import type { RetryPolicy } from "@/features/dashboard/types"
import type { ExecutionDetail, ExecutionLog, ExecutionPermission, ExecutionStep, ExecutionSummary, ObservatoryStatus } from "@/features/executions/types"
import { layoutSpans, structuredLog } from "@/features/executions/observatory"
import type {
  CostBreakdown,
  ExecutionAttempt,
  ExecutionError,
  GuardrailDecision,
  ModelInvocation,
  ObservatoryBundle,
  RetrievalInvocation,
  ToolInvocation,
  TraceSpan,
} from "@/features/executions/observatory-types"
import type { WorkflowExecutionRecord, WorkflowNodeExecution } from "@/features/workflows/studio-types"
import type { WorkflowGraph, WorkflowRun } from "@/features/workflows/types"
import { listAllAgentTestRuns, retryAgentTestRun } from "@/mocks/agent-studio-store"
import { listAgents, listExecutions } from "@/mocks/operations-store"
import { getStoredWorkflow, listStoredRuns, listWorkflows } from "@/mocks/workflow-store"
import {
  cancelWorkflowExecution,
  getWorkflowExecution,
  getWorkflowStudio,
  listWorkspaceWorkflowExecutions,
  retryWorkflowExecution,
} from "@/mocks/workflow-studio-store"
import type { StoreFailure } from "@/mocks/knowledge-store"

const emptyCosts: CostBreakdown = { modelUsd: null, toolUsd: null, retrievalUsd: null, totalUsd: null }

export function observatorySummaries(workspaceId: string): ExecutionSummary[] {
  const agents = new Map(listAgents().map((agent) => [agent.id, agent.name]))
  const workflows = new Map(listWorkflows(workspaceId).map((workflow) => [workflow.id, workflow.name]))
  const agentRows = listAllAgentTestRuns(workspaceId).map((run) => agentSummary(run, agents.get(run.agentId) ?? run.agentId))
  const workflowRows = listWorkspaceWorkflowExecutions(workspaceId).map((execution) =>
    workflowSummary(execution, workflows.get(execution.workflowId) ?? execution.workflowId),
  )
  const planRows = listStoredRuns(workspaceId).map((run) => planSummary(run, workflows.get(run.workflowId) ?? run.workflowId, workspaceId))
  const seen = new Set<string>()
  return [...agentRows, ...workflowRows, ...planRows].filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })
}

export function observatoryDetail(workspaceId: string, executionId: string): ExecutionDetail | null {
  const summary = observatorySummaries(workspaceId).find((item) => item.id === executionId)
  if (!summary) return null
  const bundle = observatoryBundle(workspaceId, executionId, null)
  if (!bundle) return null
  const logs = bundle.logs.map(toExecutionLog)
  const steps = bundle.trace.spans.filter((span) => span.parentSpanId).map(toStep)
  const error = bundle.errors[0] ? { message: bundle.errors[0].message, step: bundle.errors[0].step ?? "Run" } : null
  const attempt = summary.attempt
  return {
    ...summary,
    finishedAt: summary.durationMs === null ? null : new Date(Date.parse(summary.startedAt) + summary.durationMs).toISOString(),
    workflowId: summary.workflowId ?? null,
    input: {
      agentId: summary.agentId,
      environment: summary.environment,
      attempt,
      source: summary.retryOf ? "retry" : summary.source === "workflow" || summary.source === "workflow_plan" ? "workflow" : "agent-studio",
    },
    output: error ? null : lastOutput(workspaceId, executionId),
    error,
    retry: { attempt, maxAttempts: Math.max(attempt, 1), policy: "fixed" satisfies RetryPolicy, retryOf: summary.retryOf },
    steps: steps.length > 0 ? steps : [{ id: "recorded", label: "Recorded", status: summary.status === "failed" ? "failed" : "completed", at: summary.startedAt }],
    logs,
    permissions: permissionsFor(summary.status),
  }
}

export function observatoryBundle(workspaceId: string, executionId: string, catalog: ExecutionDetail | null): ObservatoryBundle | null {
  if (catalog && catalog.id === executionId) return catalogBundle(catalog)
  const agent = listAllAgentTestRuns(workspaceId).find((run) => run.runId === executionId)
  if (agent) return agentBundle(agent)
  const workflow = getWorkflowExecution(workspaceId, executionId)
  if (workflow) return workflowBundle(workflow)
  const plan = listStoredRuns(workspaceId).find((run) => run.id === executionId)
  if (plan) return planBundle(plan, workspaceId)
  return null
}

export function cancelObservatoryExecution(workspaceId: string, executionId: string) {
  const workflow = getWorkflowExecution(workspaceId, executionId)
  if (workflow) {
    const result = cancelWorkflowExecution(workflow.workflowId, workflow.id, workspaceId)
    if (isFailure(result)) return result
    const detail = observatoryDetail(workspaceId, executionId)
    if (!detail) return { ok: false as const, status: 404, code: "not_found" as const, message: "Execution not found." }
    return { ok: true as const, execution: detail }
  }
  if (observatorySummaries(workspaceId).some((item) => item.id === executionId)) {
    return { ok: false as const, status: 409, code: "invalid_job_transition" as const, message: "This execution can no longer be cancelled." }
  }
  return { ok: false as const, status: 404, code: "unknown" as const, message: "This execution is not in the history." }
}

export function retryObservatoryExecution(workspaceId: string, executionId: string) {
  const workflow = getWorkflowExecution(workspaceId, executionId)
  if (workflow) {
    const result = retryWorkflowExecution(workspaceId, executionId)
    if (isFailure(result)) return result
    const detail = observatoryDetail(workspaceId, result.id)
    if (!detail) return { ok: false as const, status: 404, code: "not_found" as const, message: "Execution not found." }
    return { ok: true as const, execution: detail }
  }
  const agent = listAllAgentTestRuns(workspaceId).find((run) => run.runId === executionId)
  if (agent) {
    const result = retryAgentTestRun(workspaceId, executionId)
    if (isFailure(result)) return result
    const detail = observatoryDetail(workspaceId, result.runId)
    if (!detail) return { ok: false as const, status: 404, code: "not_found" as const, message: "Execution not found." }
    return { ok: true as const, execution: detail }
  }
  if (listStoredRuns(workspaceId).some((run) => run.id === executionId)) {
    return { ok: false as const, status: 409, code: "invalid_job_transition" as const, message: "Retry is available after a failure or cancellation." }
  }
  return { ok: false as const, status: 404, code: "unknown" as const, message: "This execution is not in the history." }
}

function catalogBundle(detail: ExecutionDetail): ObservatoryBundle {
  return {
    executionId: detail.id,
    workspaceId: detail.workspaceId ?? "local",
    simulated: true,
    logs: detail.logs.map((log) =>
      structuredLog({
        id: log.id,
        timestamp: log.at,
        severity: log.severity,
        serviceName: "nodejs-job-service",
        traceId: detail.traceId ?? null,
        spanId: null,
        message: log.message,
        details: {},
      }),
    ),
    trace: { executionId: detail.id, traceId: detail.traceId ?? null, spans: [], simulated: true },
    models: [],
    tools: [],
    retrievals: [],
    guardrails: [],
    costs: emptyCosts,
    errors: detail.error ? [{ message: detail.error.message, step: detail.error.step, spanId: null, at: detail.finishedAt }] : [],
    attempts: catalogAttempts(detail.id),
  }
}

function agentBundle(run: AgentTestRunRecord): ObservatoryBundle {
  const spans = layoutSpans({
    traceId: run.traceId,
    executionId: run.runId,
    startedAt: run.startedAt,
    simulated: true,
    root: { operationName: "agent.test", serviceName: "python-agent-runtime", status: run.status === "completed" ? "ok" : "error" },
    children: run.steps.map((step) => ({
      operationName: step.kind,
      serviceName: serviceFor(step.kind),
      durationMs: step.durationMs,
      status: step.kind === "error" || step.kind === "limit" ? "error" : "ok",
      attributes: { kind: step.kind },
    })),
  })
  const models = run.steps.flatMap((step, index) => (step.kind === "respond" && run.usage ? [modelFromAgent(run, spans[index + 1], step)] : []))
  const tools = run.steps.flatMap((step, index) => (step.kind === "tool" ? [toolFrom(run.runId, spans[index + 1], step.toolId ?? null, step.durationMs, 1, null)] : []))
  const retrievals = run.steps.flatMap((step, index) =>
    step.kind === "retrieve" ? [retrievalFrom(run.runId, spans[index + 1], null, step.durationMs, step.chunkIds ?? [])] : [],
  )
  const guardrails = run.steps.flatMap((step, index) =>
    step.kind === "limit" ? [guardrail(run.runId, spans[index + 1], step.detail || "A limit stopped the test.")] : [],
  )
  return finishBundle({
    executionId: run.runId,
    workspaceId: run.workspaceId,
    traceId: run.traceId,
    spans,
    logs: logsFrom(run.runId, run.traceId, spans, run.steps.map((step) => ({ message: step.detail || step.title, details: { detail: step.detail } }))),
    models,
    tools,
    retrievals,
    guardrails,
    totalUsd: run.estimatedCostUsd ?? null,
    errors: run.error ? [{ message: run.error, step: "respond", spanId: models[0]?.spanId ?? null, at: run.startedAt }] : [],
    attempts: attemptsFrom(listAllAgentTestRuns(run.workspaceId).map(agentAttempt), run.runId),
  })
}

function workflowBundle(execution: WorkflowExecutionRecord): ObservatoryBundle {
  const graph = graphFor(execution)
  const described = execution.nodes.map((node) => ({ node, definition: graph?.nodes.find((item) => item.id === node.nodeId) }))
  const spans = layoutSpans({
    traceId: execution.traceId,
    executionId: execution.id,
    startedAt: execution.startedAt,
    simulated: true,
    root: { operationName: "workflow.execute", serviceName: "nodejs-job-service", status: execution.status === "failed" ? "error" : "ok" },
    children: described.map(({ node, definition }) => ({
      operationName: definition?.type ?? node.nodeId,
      serviceName: serviceFor(definition?.type ?? "step"),
      durationMs: node.durationMs,
      status: node.status === "failed" ? "error" : node.status === "completed" ? "ok" : "unset",
      attributes: { nodeId: node.nodeId },
    })),
  })
  const models: ModelInvocation[] = []
  const tools: ToolInvocation[] = []
  const retrievals: RetrievalInvocation[] = []
  described.forEach(({ node, definition }, index) => {
    const span = spans[index + 1]
    const kind = definition?.type
    if (!span || !kind) return
    if ((kind === "llm" || kind === "model") && node.tokens > 0) models.push(modelFromNode(execution, span, node, textField(definition.data, "provider")))
    if (kind === "tool") tools.push(toolFrom(execution.id, span, textField(definition.data, "toolId"), node.durationMs, node.attempt, node.status === "failed" ? node.detail : null))
    if (kind === "rag") retrievals.push(retrievalFrom(execution.id, span, textField(definition.data, "knowledgeBaseId"), node.durationMs, []))
  })
  const errors = described.flatMap(({ node }, index) =>
    node.status === "failed" ? [{ message: node.detail || "The step failed.", step: node.nodeId, spanId: spans[index + 1]?.spanId ?? null, at: execution.startedAt }] : [],
  )
  return finishBundle({
    executionId: execution.id,
    workspaceId: execution.workspaceId,
    traceId: execution.traceId,
    spans,
    logs: logsFrom(
      execution.id,
      execution.traceId,
      spans,
      described.map(({ node }) => ({ message: node.detail || node.nodeId, details: { input: node.input, output: node.output } })),
    ),
    models,
    tools,
    retrievals,
    guardrails: [],
    totalUsd: execution.estimatedCostUsd,
    errors,
    attempts: attemptsFrom(listWorkspaceWorkflowExecutions(execution.workspaceId).map(workflowAttempt), execution.id),
  })
}

function planBundle(run: WorkflowRun, workspaceId: string): ObservatoryBundle {
  return {
    executionId: run.id,
    workspaceId,
    simulated: true,
    logs: run.steps.map((step, index) =>
      structuredLog({
        id: `${run.id}_log_${index}`,
        timestamp: run.startedAt,
        severity: step.outcome === "failed" ? "error" : "info",
        serviceName: "nodejs-job-service",
        traceId: null,
        spanId: null,
        message: `${step.nodeId} ${step.outcome}.`,
        details: {},
      }),
    ),
    trace: { executionId: run.id, traceId: null, spans: [], simulated: true },
    models: [],
    tools: [],
    retrievals: [],
    guardrails: [],
    costs: emptyCosts,
    errors: run.status === "failed" ? [{ message: "The workflow plan failed.", step: run.steps.find((step) => step.outcome === "failed")?.nodeId ?? null, spanId: null, at: run.startedAt }] : [],
    attempts: [{ id: run.id, attempt: 1, retryOf: null, status: run.status === "failed" ? "failed" : "completed", startedAt: run.startedAt }],
  }
}

function agentSummary(run: AgentTestRunRecord, name: string): ExecutionSummary {
  return {
    id: run.runId,
    agentId: run.agentId,
    agentName: name,
    environment: "sandbox",
    status: run.status === "completed" ? "completed" : "failed",
    startedAt: run.startedAt,
    durationMs: run.durationMs,
    attempt: run.attempt ?? 1,
    retryOf: run.retryOf ?? null,
    progress: run.status === "completed" ? 100 : 100,
    simulated: true,
    source: "agent_test",
    versionLabel: recordedVersion(run.agentVersion),
    traceId: run.traceId,
    workspaceId: run.workspaceId,
    tokenCount: run.usage?.totalTokens ?? null,
    estimatedCostUsd: run.estimatedCostUsd ?? null,
    model: run.model ?? null,
    workflowId: null,
  }
}

function workflowSummary(execution: WorkflowExecutionRecord, name: string): ExecutionSummary {
  return {
    id: execution.id,
    agentId: "",
    agentName: name,
    environment: "sandbox",
    status: execution.status,
    startedAt: execution.startedAt,
    durationMs: execution.durationMs,
    attempt: execution.attempt ?? 1,
    retryOf: execution.retryOf ?? null,
    progress: execution.status === "completed" || execution.status === "failed" || execution.status === "cancelled" ? 100 : execution.status === "waiting_for_approval" ? 50 : 20,
    simulated: true,
    source: "workflow",
    versionLabel: recordedVersion(execution.workflowVersion),
    traceId: execution.traceId,
    workspaceId: execution.workspaceId,
    tokenCount: execution.totalTokens,
    estimatedCostUsd: execution.estimatedCostUsd,
    model: null,
    workflowId: execution.workflowId,
  }
}

function planSummary(run: WorkflowRun, name: string, workspaceId: string): ExecutionSummary {
  return {
    id: run.id,
    agentId: "",
    agentName: name,
    environment: "sandbox",
    status: run.status === "failed" ? "failed" : "completed",
    startedAt: run.startedAt,
    durationMs: null,
    attempt: 1,
    retryOf: null,
    progress: 100,
    simulated: true,
    source: "workflow_plan",
    versionLabel: null,
    traceId: null,
    workspaceId,
    tokenCount: null,
    estimatedCostUsd: null,
    model: null,
    workflowId: run.workflowId,
  }
}

function finishBundle(input: {
  executionId: string
  workspaceId: string
  traceId: string
  spans: TraceSpan[]
  logs: ObservatoryBundle["logs"]
  models: ModelInvocation[]
  tools: ToolInvocation[]
  retrievals: RetrievalInvocation[]
  guardrails: GuardrailDecision[]
  totalUsd: number | null
  errors: ExecutionError[]
  attempts: ExecutionAttempt[]
}): ObservatoryBundle {
  const spanIds = new Set(input.spans.map((span) => span.spanId))
  return {
    executionId: input.executionId,
    workspaceId: input.workspaceId,
    simulated: true,
    logs: input.logs,
    trace: { executionId: input.executionId, traceId: input.traceId, spans: input.spans.filter((span) => span.attributes.executionId === input.executionId), simulated: true },
    models: input.models.filter((item) => spanIds.has(item.spanId)),
    tools: input.tools.filter((item) => spanIds.has(item.spanId)),
    retrievals: input.retrievals.filter((item) => spanIds.has(item.spanId)),
    guardrails: input.guardrails.filter((item) => spanIds.has(item.spanId)),
    costs: { ...emptyCosts, totalUsd: input.totalUsd },
    errors: input.errors,
    attempts: input.attempts,
  }
}

function logsFrom(
  executionId: string,
  traceId: string,
  spans: TraceSpan[],
  messages: { message: string; details: Record<string, unknown> }[],
) {
  return messages.map((message, index) =>
    structuredLog({
      id: `${executionId}_log_${index}`,
      timestamp: spans[index + 1]?.startTime ?? spans[0]?.startTime ?? new Date(0).toISOString(),
      severity: spans[index + 1]?.status === "error" ? "error" : "info",
      serviceName: spans[index + 1]?.serviceName ?? "nodejs-job-service",
      traceId,
      spanId: spans[index + 1]?.spanId ?? null,
      message: message.message,
      details: message.details,
    }),
  )
}

function modelFromAgent(run: AgentTestRunRecord, span: TraceSpan | undefined, step: AgentExecutionStep): ModelInvocation {
  return {
    id: `mdl_${run.runId}_${step.id}`,
    executionId: run.runId,
    spanId: span?.spanId ?? "",
    provider: run.provider ?? null,
    model: run.model ?? null,
    usage: {
      promptTokens: run.usage?.promptTokens ?? null,
      completionTokens: run.usage?.completionTokens ?? null,
      totalTokens: run.usage?.totalTokens ?? null,
    },
    timeToFirstTokenMs: null,
    generationLatencyMs: step.durationMs,
    estimatedCostUsd: null,
    error: run.error ?? null,
    attempt: run.attempt ?? 1,
    simulated: true,
  }
}

function modelFromNode(execution: WorkflowExecutionRecord, span: TraceSpan, node: WorkflowNodeExecution, provider: string | null): ModelInvocation {
  return {
    id: `mdl_${execution.id}_${node.nodeId}`,
    executionId: execution.id,
    spanId: span.spanId,
    provider,
    model: null,
    usage: { promptTokens: null, completionTokens: null, totalTokens: node.tokens },
    timeToFirstTokenMs: null,
    generationLatencyMs: node.durationMs,
    estimatedCostUsd: null,
    error: node.status === "failed" ? node.detail : null,
    attempt: node.attempt,
    simulated: true,
  }
}

function toolFrom(executionId: string, span: TraceSpan | undefined, toolId: string | null, durationMs: number, attempt: number, error: string | null): ToolInvocation {
  return {
    id: `tool_${executionId}_${span?.spanId ?? attempt}`,
    executionId,
    spanId: span?.spanId ?? "",
    toolId,
    durationMs,
    status: error ? "error" : "ok",
    attempt,
    error,
    simulated: true,
  }
}

function retrievalFrom(executionId: string, span: TraceSpan | undefined, knowledgeBaseId: string | null, durationMs: number, chunkIds: string[]): RetrievalInvocation {
  return {
    id: `ret_${executionId}_${span?.spanId ?? "step"}`,
    executionId,
    spanId: span?.spanId ?? "",
    knowledgeBaseId,
    durationMs,
    embeddingDurationMs: null,
    rerankDurationMs: null,
    chunkIds,
    simulated: true,
  }
}

function guardrail(executionId: string, span: TraceSpan | undefined, decision: string): GuardrailDecision {
  return { id: `guard_${executionId}_${span?.spanId ?? "step"}`, executionId, spanId: span?.spanId ?? "", decision, simulated: true }
}

function graphFor(execution: WorkflowExecutionRecord): WorkflowGraph | null {
  if (!execution.workflowVersion || execution.workflowVersion === "draft") {
    return getStoredWorkflow(execution.workflowId, execution.workspaceId)?.graph ?? null
  }
  const studio = getWorkflowStudio(execution.workspaceId, execution.workflowId)
  if (isFailure(studio)) return null
  return studio.versions.find((version) => version.version === execution.workflowVersion)?.graph ?? null
}

function catalogAttempts(id: string): ExecutionAttempt[] {
  return attemptsFrom(
    listExecutions().map((record) => ({
      id: record.id,
      attempt: record.attempt ?? 1,
      retryOf: record.retryOf ?? null,
      status: record.status === "succeeded" ? "completed" : record.status === "running" || record.status === "queued" || record.status === "failed" || record.status === "cancelled" ? record.status : "completed",
      startedAt: record.startedAt,
    })),
    id,
  )
}

function attemptsFrom(rows: ExecutionAttempt[], id: string): ExecutionAttempt[] {
  const root = chainRoot(rows, id)
  return rows.filter((row) => chainRoot(rows, row.id) === root)
}

function chainRoot(rows: ExecutionAttempt[], id: string) {
  let current = rows.find((row) => row.id === id)
  const seen = new Set<string>()
  while (current?.retryOf && !seen.has(current.id)) {
    seen.add(current.id)
    const parent = rows.find((row) => row.id === current?.retryOf)
    if (!parent) break
    current = parent
  }
  return current?.id ?? id
}

function agentAttempt(run: AgentTestRunRecord): ExecutionAttempt {
  return {
    id: run.runId,
    attempt: run.attempt ?? 1,
    retryOf: run.retryOf ?? null,
    status: run.status === "completed" ? "completed" : "failed",
    startedAt: run.startedAt,
  }
}

function workflowAttempt(execution: WorkflowExecutionRecord): ExecutionAttempt {
  return { id: execution.id, attempt: execution.attempt ?? 1, retryOf: execution.retryOf ?? null, status: execution.status, startedAt: execution.startedAt }
}

function lastOutput(workspaceId: string, executionId: string) {
  const workflow = getWorkflowExecution(workspaceId, executionId)
  const output = workflow?.nodes.findLast((node) => node.output)?.output
  if (!output) return null
  return { summary: output, attempt: workflow?.attempt ?? 1 }
}

function toExecutionLog(log: ObservatoryBundle["logs"][number]): ExecutionLog {
  return { id: log.id, at: log.timestamp, severity: log.severity, message: log.message }
}

function toStep(span: TraceSpan): ExecutionStep {
  return {
    id: span.spanId,
    label: span.operationName,
    status: span.status === "error" ? "failed" : span.status === "unset" ? "pending" : "completed",
    at: span.startTime,
  }
}

function permissionsFor(status: ObservatoryStatus): { cancel: ExecutionPermission; retry: ExecutionPermission } {
  const cancelable = status === "queued" || status === "running" || status === "waiting_for_approval"
  const retryable = status === "failed" || status === "cancelled"
  return {
    cancel: cancelable
      ? { allowed: true, reason: "Stop this run before it finishes." }
      : { allowed: false, reason: "Only queued or running executions can be cancelled." },
    retry: retryable
      ? { allowed: true, reason: "A new execution is recorded. This run stays in history." }
      : { allowed: false, reason: "Retry is available after a failure or cancellation." },
  }
}

function recordedVersion(value: string | null | undefined) {
  if (!value || value === "unknown") return null
  return value
}

function serviceFor(kind: string) {
  if (kind === "llm" || kind === "model" || kind === "embedding" || kind === "structured_output" || kind === "respond") return "python-llm-gateway"
  if (kind === "rag" || kind === "retrieve") return "python-rag-service"
  if (kind === "tool" || kind === "agent_execution") return "python-agent-runtime"
  return "nodejs-job-service"
}

function textField(data: { label: string } | undefined, key: "provider" | "toolId" | "knowledgeBaseId") {
  const value = data?.[key as keyof typeof data]
  return typeof value === "string" && value.length > 0 ? value : null
}

function isFailure(result: unknown): result is StoreFailure {
  return typeof result === "object" && result !== null && "ok" in result && (result as StoreFailure).ok === false
}

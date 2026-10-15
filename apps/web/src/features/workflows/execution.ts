import type { WorkflowExecutionRecord, WorkflowNodeExecution } from "@/features/workflows/studio-types"
import type { WorkflowGraph, WorkflowNode } from "@/features/workflows/types"

export type WorkflowSimulationInput = {
  workflowId: string
  workspaceId: string
  workflowVersion: string
  id: string
  traceId: string
  startedAt: string
  decisions: Record<string, "approve" | "reject">
  chunks: (knowledgeBaseId: string) => string[]
  toolIds: string[]
  publishedAgents: { id: string; versions: string[] }[]
  requirePublishedAgents: boolean
}

const tokensFor: Record<string, number> = {
  llm: 40,
  rag: 20,
  embedding: 16,
  tool: 12,
  agent_execution: 30,
}

const durationFor: Record<string, number> = {
  llm: 15,
  rag: 12,
  embedding: 10,
  tool: 8,
  agent_execution: 18,
  human_approval: 4,
}

export function simulateWorkflow(graph: WorkflowGraph, input: WorkflowSimulationInput): WorkflowExecutionRecord {
  const nodes: WorkflowNodeExecution[] = []
  let payload = "trigger"
  let status: WorkflowExecutionRecord["status"] = "running"
  let pending: WorkflowExecutionRecord["pendingApproval"] = null
  const trigger = graph.nodes.find((node) => node.type === "trigger")
  const seen = new Set<string>()
  const queue = trigger ? [trigger.id] : []

  while (queue.length > 0 && status === "running") {
    const id = queue.shift()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const node = graph.nodes.find((item) => item.id === id)
    if (!node) continue
    const step = runNode(node, payload, input)
    nodes.push(step)
    if (step.status === "waiting_for_approval") {
      status = "waiting_for_approval"
      pending = {
        nodeId: node.id,
        role: node.data.approverRole ?? "owner",
        message: node.data.approvalMessage ?? "Approve this step.",
      }
      break
    }
    if (step.status === "failed") {
      status = "failed"
      break
    }
    payload = step.output ?? payload
    for (const edge of nextEdges(graph, node, payload, input.decisions)) queue.push(edge.target)
  }

  if (status === "running") status = "completed"
  const totalTokens = nodes.reduce((sum, node) => sum + node.tokens, 0)
  const durationMs = nodes.reduce((sum, node) => sum + node.durationMs, 0)
  return {
    id: input.id,
    traceId: input.traceId,
    simulated: true,
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    workflowVersion: input.workflowVersion,
    status,
    timeline: status === "waiting_for_approval" ? ["queued", "running", "waiting_for_approval"] : ["queued", "running", status],
    nodes,
    startedAt: input.startedAt,
    durationMs,
    totalTokens,
    estimatedCostUsd: Math.round((totalTokens / 1000) * 0.002 * 1_000_000) / 1_000_000,
    pendingApproval: pending,
    notice: "Simulated workflow execution. No model, tool, or retrieval service was called.",
  }
}

function runNode(node: WorkflowNode, payload: string, input: WorkflowSimulationInput): WorkflowNodeExecution {
  const base = {
    nodeId: node.id,
    attempt: 1,
    branch: null as string | null,
    durationMs: durationFor[node.type] ?? 5,
    tokens: tokensFor[node.type] ?? 2,
    input: payload,
    output: null as string | null,
    detail: "",
  }

  if (node.type === "human_approval") {
    const decision = input.decisions[node.id]
    if (!decision) {
      return { ...base, status: "waiting_for_approval", detail: `Waiting for ${node.data.approverRole ?? "owner"}. The simulation is paused.` }
    }
    return {
      ...base,
      status: "completed",
      branch: decision,
      output: payload,
      detail: decision === "approve" ? "Approved by the mock decision." : "Rejected by the mock decision.",
    }
  }

  if (node.type === "tool") {
    if (!input.toolIds.includes(node.data.toolId ?? "")) {
      return { ...base, status: "failed", detail: "Tool is not registered. No request was sent." }
    }
    const failOnce = (node.data.inputMapping ?? "").includes("fail-once")
    const retries = node.data.retries ?? 0
    if (failOnce && retries < 1) {
      return { ...base, status: "failed", detail: "The simulated tool failed. No retry was configured." }
    }
    return {
      ...base,
      status: "completed",
      attempt: failOnce ? 2 : 1,
      output: `tool:${node.data.toolId}`,
      detail: failOnce
        ? "Retried once. The tool was not executed and no credentials were read."
        : node.data.requiresApproval
          ? "Approval was required. The tool was not executed."
          : "Read-only tool was simulated. No code was evaluated.",
    }
  }

  if (node.type === "rag") {
    const chunks = input.chunks(node.data.knowledgeBaseId ?? "")
    const kept = chunks.slice(0, node.data.topK ?? 4)
    return {
      ...base,
      status: "completed",
      output: kept.length === 0 ? "retrieval:empty" : `retrieval:${kept.join(",")}`,
      detail: kept.length === 0 ? "No READY chunks were found. Nothing was invented." : `Simulated ${node.data.strategy ?? "hybrid"} retrieval returned ${kept.length} chunks.`,
    }
  }

  if (node.type === "structured_output") {
    const invalid = payload.includes("invalid")
    if (invalid && node.data.failurePolicy === "fail") {
      return { ...base, status: "failed", branch: "error", detail: "Structured output failed validation." }
    }
    const branch = invalid ? "error" : "valid"
    return {
      ...base,
      status: "completed",
      branch,
      output: payload,
      detail: invalid ? "Validation failed. The error branch was selected." : "Validation passed. The valid branch was selected.",
    }
  }

  if (node.type === "agent_execution") {
    const agent = input.publishedAgents.find((item) => item.id === node.data.agentId)
    const published = Boolean(agent?.versions.includes(node.data.agentVersion ?? ""))
    if (input.requirePublishedAgents && !published) {
      return { ...base, status: "failed", detail: "This published workflow cannot call an unpublished agent version." }
    }
    return {
      ...base,
      status: "completed",
      output: `agent:${node.data.agentId}@${node.data.agentVersion}`,
      detail: published
        ? `Simulated agent ${node.data.agentId} at ${node.data.agentVersion}. Limit ${node.data.executionLimit ?? 1}.`
        : "Draft agent version was referenced. The agent runtime was not called.",
    }
  }

  if (node.type === "llm") {
    const invalid = payload.includes("invalid") || (node.data.promptTemplate ?? "").includes("invalid")
    return {
      ...base,
      status: "completed",
      output: invalid ? "invalid structured text" : `Simulated text from ${node.data.model ?? "model"}`,
      detail: `Simulated ${node.data.provider ?? "provider"} generation. No model was called.`,
    }
  }

  if (node.type === "embedding") {
    return { ...base, status: "completed", output: `embedding:${node.data.embeddingModel}`, detail: "Simulated embeddings. No vectors were computed." }
  }

  if (node.type === "ingestion") {
    return { ...base, status: "completed", output: `document:${node.data.documentRef}`, detail: "Simulated ingestion. File bytes were not stored." }
  }

  return { ...base, status: "completed", output: payload, detail: `${node.data.label} completed in the simulation.` }
}

function nextEdges(graph: WorkflowGraph, node: WorkflowNode, payload: string, decisions: Record<string, "approve" | "reject">) {
  const edges = graph.edges.filter((edge) => edge.source === node.id)
  if (node.type === "condition") {
    const handle = node.data.expression?.trim() === "false" ? "false" : "true"
    return edges.filter((edge) => edge.sourceHandle === handle)
  }
  if (node.type === "human_approval") {
    return edges.filter((edge) => edge.sourceHandle === decisions[node.id])
  }
  if (node.type === "structured_output") {
    const handle = payload.includes("invalid") ? "error" : "valid"
    return edges.filter((edge) => edge.sourceHandle === handle)
  }
  return edges
}

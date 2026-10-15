import { branchHandles, branchPrompt, inputType, isLegacyNode, outputType, portsCompatible } from "@/features/workflows/ports"
import type { WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowNodeData, WorkflowNodeKind } from "@/features/workflows/types"
import { workflowNodeKinds } from "@/features/workflows/types"

const kinds = new Set<WorkflowNodeKind>(workflowNodeKinds)

export function defaultNodeData(kind: WorkflowNodeKind): WorkflowNodeData {
  switch (kind) {
    case "trigger":
      return { label: "Trigger", event: "manual.start" }
    case "browser":
      return { label: "Browser action", url: "https://example.com", action: "navigate" }
    case "api":
      return { label: "API request", url: "https://api.agentflow.test/health", method: "GET" }
    case "model":
      return { label: "AI model", model: "orbit-small", prompt: "Describe the incoming work." }
    case "condition":
      return { label: "Condition", expression: "value == ready" }
    case "delay":
      return { label: "Delay", durationMs: 1000 }
    case "approval":
      return { label: "Human approval", assignee: "owner", prompt: "Approve this step before it continues." }
    case "output":
      return { label: "Output" }
    case "llm":
      return {
        label: "LLM generation",
        provider: "agentflow-simulated",
        model: "orbit-small",
        promptTemplate: "Summarize the incoming text.",
        temperature: 0.2,
        maxOutputTokens: 400,
        outputSchema: "",
        timeoutMs: 30000,
        budgetUsd: 1,
      }
    case "rag":
      return {
        label: "RAG retrieval",
        knowledgeBaseId: "",
        strategy: "hybrid",
        topK: 4,
        scoreThreshold: 0.2,
        rerank: false,
        contextTokenBudget: 800,
      }
    case "ingestion":
      return { label: "Document ingestion", knowledgeBaseId: "", documentRef: "", processingPolicy: "parse_and_index" }
    case "embedding":
      return { label: "Embedding generation", embeddingModel: "orbit-embed-small", textInput: "{{input}}", batchSize: 8 }
    case "tool":
      return {
        label: "Tool invocation",
        toolId: "calculator",
        inputMapping: "{{input}}",
        timeoutMs: 5000,
        retryPolicy: "none",
        retries: 0,
        requiresApproval: false,
      }
    case "agent_execution":
      return { label: "Agent execution", agentId: "", agentVersion: "", inputMapping: "{{input}}", executionLimit: 4 }
    case "human_approval":
      return { label: "Approval gate", approverRole: "owner", approvalMessage: "Approve this workflow step.", timeoutMs: 30000 }
    case "structured_output":
      return { label: "Validate output", outputSchema: "{\"type\":\"object\"}", failurePolicy: "branch" }
  }
}

export function blankWorkflowGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: "node_1",
        type: "trigger",
        position: { x: 80, y: 180 },
        data: defaultNodeData("trigger"),
      },
    ],
    edges: [],
  }
}

export function isWorkflowGraph(value: unknown): value is WorkflowGraph {
  if (!value || typeof value !== "object") return false
  const graph = value as Partial<WorkflowGraph>
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return false
  return graph.nodes.every(isNode) && graph.edges.every(isEdge)
}

function isNode(value: unknown): value is WorkflowNode {
  if (!value || typeof value !== "object") return false
  const node = value as Partial<WorkflowNode>
  return (
    typeof node.id === "string" &&
    kinds.has(node.type as WorkflowNodeKind) &&
    !!node.position &&
    typeof node.position.x === "number" &&
    typeof node.position.y === "number" &&
    !!node.data &&
    typeof node.data === "object" &&
    typeof node.data.label === "string"
  )
}

function isEdge(value: unknown): value is WorkflowEdge {
  if (!value || typeof value !== "object") return false
  const edge = value as Partial<WorkflowEdge>
  return typeof edge.id === "string" && typeof edge.source === "string" && typeof edge.target === "string"
}

export function nextNodeId(graph: WorkflowGraph) {
  const used = graph.nodes.map((node) => Number(node.id.replace("node_", "")))
  const next = Math.max(0, ...used.filter((value) => Number.isFinite(value))) + 1
  return `node_${next}`
}

export function addNode(graph: WorkflowGraph, kind: WorkflowNodeKind, position: { x: number; y: number }) {
  const node: WorkflowNode = { id: nextNodeId(graph), type: kind, position, data: defaultNodeData(kind) }
  return { graph: { ...graph, nodes: [...graph.nodes, node] }, node }
}

export function updateNodeData(graph: WorkflowGraph, id: string, data: WorkflowNodeData) {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...data } } : node)),
  }
}

export function moveNode(graph: WorkflowGraph, id: string, position: { x: number; y: number }) {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (node.id === id ? { ...node, position: { x: position.x, y: position.y } } : node)),
  }
}

export function removeNodes(graph: WorkflowGraph, ids: string[]) {
  const drop = new Set(ids)
  return {
    nodes: graph.nodes.filter((node) => !drop.has(node.id)),
    edges: graph.edges.filter((edge) => !drop.has(edge.source) && !drop.has(edge.target)),
  }
}

export function duplicateNode(graph: WorkflowGraph, id: string) {
  const source = graph.nodes.find((node) => node.id === id)
  if (!source) return null
  const label = source.data.label.endsWith(" copy") ? source.data.label : `${source.data.label} copy`.slice(0, 48)
  const node: WorkflowNode = {
    id: nextNodeId(graph),
    type: source.type,
    position: { x: source.position.x + 48, y: source.position.y + 48 },
    data: { ...source.data, label },
  }
  return { graph: { ...graph, nodes: [...graph.nodes, node] }, node }
}

export type GraphConnection = {
  source: string
  target: string
  sourceHandle?: string | null
}

export function connectionError(graph: WorkflowGraph, connection: GraphConnection, ignoreEdgeId?: string) {
  const source = graph.nodes.find((node) => node.id === connection.source)
  const target = graph.nodes.find((node) => node.id === connection.target)
  if (!source || !target) return "Connect two nodes on the canvas."
  if (source.id === target.id) return "Connect two different nodes."
  if (source.type === "output") return "An output cannot start a connection."
  if (target.type === "trigger") return "A trigger cannot receive a connection."

  const edges = graph.edges.filter((edge) => edge.id !== ignoreEdgeId)
  const handle = connection.sourceHandle ?? null

  const branches = branchHandles(source.type)
  if (branches) {
    if (!branches.includes(handle ?? "")) return branchPrompt(source.type)
    if (edges.some((edge) => edge.source === source.id && (edge.sourceHandle ?? null) === handle)) {
      return "That path is already connected."
    }
  } else if (edges.some((edge) => edge.source === source.id)) {
    return "This node already has a connection."
  }

  if (!(isLegacyNode(source.type) && isLegacyNode(target.type))) {
    const produced = outputType(source.type)
    const accepted = inputType(target.type)
    if (!portsCompatible(produced, accepted)) {
      return `${source.data.label} outputs ${produced}, which ${target.data.label} cannot accept.`
    }
  }

  if (edges.some((edge) => edge.source === source.id && edge.target === target.id && (edge.sourceHandle ?? null) === handle)) {
    return "Those nodes are already connected."
  }

  if (reaches(edges, target.id, source.id)) return "This connection would create a cycle."
  return null
}

export function connectNodes(graph: WorkflowGraph, connection: GraphConnection): { graph: WorkflowGraph } | { error: string } {
  const message = connectionError(graph, connection)
  if (message) return { error: message }
  const handle = connection.sourceHandle ?? null
  const edge: WorkflowEdge = {
    id: `edge_${connection.source}_${handle ?? "next"}_${connection.target}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: handle,
  }
  return { graph: { ...graph, edges: [...graph.edges, edge] } }
}

export function disconnectEdge(graph: WorkflowGraph, edgeId: string) {
  return { ...graph, edges: graph.edges.filter((edge) => edge.id !== edgeId) }
}

function reaches(edges: WorkflowEdge[], start: string, goal: string) {
  const seen = new Set<string>()
  const queue = [start]
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id || seen.has(id)) continue
    if (id === goal) return true
    seen.add(id)
    for (const edge of edges) {
      if (edge.source === id) queue.push(edge.target)
    }
  }
  return false
}

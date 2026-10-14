import type { PlaybackFrame, RunStep, WorkflowEdge, WorkflowGraph, WorkflowNode } from "@/features/workflows/types"
import { nodeFails, validateWorkflow } from "@/features/workflows/validate"

export function planWorkflowRun(graph: WorkflowGraph): { ok: true; steps: RunStep[] } | { ok: false; issues: ReturnType<typeof validateWorkflow> } {
  const issues = validateWorkflow(graph)
  if (issues.length > 0) return { ok: false, issues }

  const trigger = graph.nodes.find((node) => node.type === "trigger")
  if (!trigger) return { ok: false, issues }

  const steps: RunStep[] = []
  const seen = new Set<string>()
  const queue = [trigger.id]

  while (queue.length > 0) {
    const id = queue.shift()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const node = graph.nodes.find((item) => item.id === id)
    if (!node) continue

    if (nodeFails(node)) {
      steps.push({ nodeId: id, outcome: "failed" })
      continue
    }

    steps.push({ nodeId: id, outcome: "succeeded" })
    for (const edge of outgoingEdges(graph, node)) queue.push(edge.target)
  }

  return { ok: true, steps }
}

export function playbackFrames(graph: WorkflowGraph, steps: RunStep[]): PlaybackFrame[] {
  const frames: PlaybackFrame[] = []
  const nodeStatus: PlaybackFrame["nodeStatus"] = {}
  for (const node of graph.nodes) nodeStatus[node.id] = "idle"
  const litEdgeIds: string[] = []

  for (const step of steps) {
    const incoming = graph.edges.find((edge) => edge.target === step.nodeId && nodeStatus[edge.source] === "succeeded")
    frames.push({
      nodeStatus: { ...nodeStatus, [step.nodeId]: "running" },
      activeEdgeId: incoming?.id ?? null,
      litEdgeIds: [...litEdgeIds],
    })
    nodeStatus[step.nodeId] = step.outcome
    if (incoming && step.outcome === "succeeded") litEdgeIds.push(incoming.id)
    frames.push({
      nodeStatus: { ...nodeStatus },
      activeEdgeId: step.outcome === "failed" ? null : (incoming?.id ?? null),
      litEdgeIds: [...litEdgeIds],
    })
  }

  return frames
}

function outgoingEdges(graph: WorkflowGraph, node: WorkflowNode) {
  const edges = graph.edges
    .filter((edge) => edge.source === node.id)
    .sort((a, b) => handleOrder(a) - handleOrder(b) || a.target.localeCompare(b.target))

  if (node.type === "condition" && node.data.expression?.trim() === "false") {
    return edges.filter((edge) => edge.sourceHandle === "false")
  }

  return edges
}

function handleOrder(edge: WorkflowEdge) {
  if (edge.sourceHandle === "true") return 0
  if (edge.sourceHandle === "false") return 1
  return 2
}

import { connectionError } from "@/features/workflows/graph"
import { nodeSchema } from "@/features/workflows/schemas"
import type { WorkflowGraph, WorkflowIssue, WorkflowNode } from "@/features/workflows/types"

export function validateWorkflow(graph: WorkflowGraph): WorkflowIssue[] {
  const issues: WorkflowIssue[] = []
  const triggers = graph.nodes.filter((node) => node.type === "trigger")

  if (triggers.length === 0) {
    issues.push({ code: "missing_trigger", message: "Add a trigger to start the workflow." })
  } else if (triggers.length > 1) {
    issues.push({ code: "invalid_connection", message: "Use a single trigger." })
  }

  if (!graph.nodes.some((node) => node.type === "output")) {
    issues.push({ code: "missing_output", message: "Add an output so the workflow has a result." })
  }

  for (const edge of graph.edges) {
    const message = connectionError(graph, edge, edge.id)
    if (message) issues.push({ code: "invalid_connection", edgeId: edge.id, message })
  }

  for (const node of graph.nodes) {
    const parsed = nodeSchema(node.type).safeParse(node.data)
    if (!parsed.success) {
      issues.push({
        code: "required",
        nodeId: node.id,
        message: `${node.data.label || "Node"}: ${parsed.error.issues[0]?.message ?? "Check this node."}`,
      })
    }
  }

  if (triggers.length === 1) {
    const reachable = collectReachable(graph, triggers[0].id)
    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          code: "unreachable",
          nodeId: node.id,
          message: `${node.data.label} is not reachable from the trigger.`,
        })
      }
    }
  }

  return issues
}

function collectReachable(graph: WorkflowGraph, start: string) {
  const seen = new Set<string>([start])
  const queue = [start]
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id) continue
    for (const edge of graph.edges) {
      if (edge.source === id && !seen.has(edge.target)) {
        seen.add(edge.target)
        queue.push(edge.target)
      }
    }
  }
  return seen
}

export function nodeFails(node: WorkflowNode) {
  const url = node.data.url ?? ""
  if (url) {
    try {
      if (new URL(url).hostname === "fail.agentflow.test") return true
    } catch {
      // A node can fail from its expression even when the URL is not parseable.
    }
  }
  return node.data.expression?.trim() === "fail"
}

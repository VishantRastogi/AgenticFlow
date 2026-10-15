import { connectionError } from "@/features/workflows/graph"
import { branchHandles } from "@/features/workflows/ports"
import { nodeSchema } from "@/features/workflows/schemas"
import type { WorkflowGraph, WorkflowIssue, WorkflowNode } from "@/features/workflows/types"

export type WorkflowReferenceIndex = {
  knowledgeBaseIds: string[]
  toolIds: string[]
  agents: { id: string; versions: string[] }[]
}

export function validateWorkflow(graph: WorkflowGraph, refs?: WorkflowReferenceIndex | null): WorkflowIssue[] {
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

  for (const node of graph.nodes) {
    const branches = branchHandles(node.type)
    if (!branches || node.type === "condition") continue
    for (const handle of branches) {
      if (!graph.edges.some((edge) => edge.source === node.id && edge.sourceHandle === handle)) {
        issues.push({
          code: "invalid_connection",
          nodeId: node.id,
          message: `${node.data.label} needs a ${handle} connection.`,
        })
      }
    }
  }

  if (refs) {
    for (const node of graph.nodes) {
      if ((node.type === "rag" || node.type === "ingestion") && node.data.knowledgeBaseId && !refs.knowledgeBaseIds.includes(node.data.knowledgeBaseId)) {
        issues.push({
          code: "required",
          nodeId: node.id,
          message: `${node.data.label} references a knowledge base that is not in this workspace.`,
        })
      }
      if (node.type === "tool" && node.data.toolId && !refs.toolIds.includes(node.data.toolId)) {
        issues.push({
          code: "required",
          nodeId: node.id,
          message: `${node.data.label} references a tool that is not registered.`,
        })
      }
      if (node.type === "agent_execution" && node.data.agentId) {
        const agent = refs.agents.find((item) => item.id === node.data.agentId)
        if (!agent) {
          issues.push({ code: "required", nodeId: node.id, message: `${node.data.label} references an agent that is not in the catalog.` })
        } else if (!node.data.agentVersion || !agent.versions.includes(node.data.agentVersion)) {
          issues.push({
            code: "required",
            nodeId: node.id,
            message: `${node.data.label} uses an unpublished agent version. Publish the agent before publishing this workflow.`,
          })
        }
      }
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

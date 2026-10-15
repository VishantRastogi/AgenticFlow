"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import { listAgents } from "@/features/agents/api"
import { AGENT_PAGE_SIZE } from "@/features/agents/catalog"
import { getAgentStudio, listAgentTools } from "@/features/agents/studio-api"
import { listKnowledgeBases } from "@/features/knowledge/api"
import { KNOWLEDGE_PAGE_SIZE } from "@/features/knowledge/catalog"
import type { WorkflowGraph } from "@/features/workflows/types"
import type { WorkflowReferenceIndex } from "@/features/workflows/validate"
import { localWorkspace } from "@/lib/workspace"

export function useWorkflowReferences(graph: WorkflowGraph): WorkflowReferenceIndex | null {
  const agentIds = [...new Set(graph.nodes.flatMap((node) => (node.type === "agent_execution" && node.data.agentId ? [node.data.agentId] : [])))]
  const bases = useQuery({
    queryKey: ["workflows", "refs", "knowledge", localWorkspace.id],
    queryFn: async () => {
      const first = await listKnowledgeBases({ workspaceId: localWorkspace.id, q: "", status: "all", model: "all", sort: "name", page: 1 })
      const pages = Math.max(1, Math.ceil(first.total / KNOWLEDGE_PAGE_SIZE))
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, index) =>
          listKnowledgeBases({ workspaceId: localWorkspace.id, q: "", status: "all", model: "all", sort: "name", page: index + 2 }),
        ),
      )
      return [first, ...rest].flatMap((page) => page.items)
    },
  })
  const tools = useQuery({
    queryKey: ["workflows", "refs", "tools", localWorkspace.id],
    queryFn: () => listAgentTools(localWorkspace.id),
  })
  const agents = useQuery({
    queryKey: ["workflows", "refs", "agents"],
    queryFn: async () => {
      const first = await listAgents({ q: "", status: "all", environment: "all", type: "all", sort: "name", page: 1 })
      const pages = Math.max(1, Math.ceil(first.total / AGENT_PAGE_SIZE))
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, index) =>
          listAgents({ q: "", status: "all", environment: "all", type: "all", sort: "name", page: index + 2 }),
        ),
      )
      return [first, ...rest].flatMap((page) => page.agents)
    },
  })
  const studios = useQueries({
    queries: agentIds.map((id) => ({
      queryKey: ["workflows", "refs", "studio", localWorkspace.id, id],
      queryFn: () => getAgentStudio(localWorkspace.id, id),
    })),
  })
  if (!bases.data || !tools.data || !agents.data || studios.some((query) => query.isPending)) return null
  return {
    knowledgeBaseIds: bases.data.map((base) => base.id),
    toolIds: tools.data.tools.map((tool) => tool.id),
    agents: agents.data.map((agent) => {
      const index = agentIds.indexOf(agent.id)
      const versions = index >= 0 ? studios[index]?.data?.versions.map((version) => version.version) ?? [] : []
      return { id: agent.id, versions }
    }),
  }
}

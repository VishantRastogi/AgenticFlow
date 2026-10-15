import { callContract } from "@/features/api/real-adapter"
import type {
  AgentConfiguration,
  AgentPublishRequest,
  AgentRollbackRequest,
  AgentStudioRecord,
  AgentTestRequest,
  AgentTestResponse,
  AgentToolDefinition,
} from "@/features/agents/studio-types"

export function getAgentStudio(workspaceId: string, agentId: string) {
  return callContract<AgentStudioRecord>("agents.studio.get", {
    params: { id: agentId },
    query: { workspaceId },
  })
}

export function saveAgentStudio(workspaceId: string, agentId: string, draft: AgentConfiguration) {
  return callContract<AgentStudioRecord>("agents.studio.save", {
    params: { id: agentId },
    query: { workspaceId },
    body: { workspaceId, draft },
  })
}

export function publishAgentStudio(agentId: string, input: AgentPublishRequest) {
  return callContract<AgentStudioRecord>("agents.studio.publish", {
    params: { id: agentId },
    query: { workspaceId: input.workspaceId },
    body: input,
  })
}

export function rollbackAgentStudio(agentId: string, input: AgentRollbackRequest) {
  return callContract<AgentStudioRecord>("agents.studio.rollback", {
    params: { id: agentId },
    query: { workspaceId: input.workspaceId },
    body: input,
  })
}

export function testAgentStudio(agentId: string, input: AgentTestRequest) {
  return callContract<AgentTestResponse>("agents.studio.test", {
    params: { id: agentId },
    query: { workspaceId: input.workspaceId },
    body: input,
  })
}

export function listAgentTools(workspaceId: string) {
  return callContract<{ simulated: true; workspaceId: string; tools: AgentToolDefinition[] }>("agents.tools.list", {
    query: { workspaceId },
  })
}

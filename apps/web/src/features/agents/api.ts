import { callContract } from "@/features/api/real-adapter"
import type { ExecutionRecord } from "@/features/dashboard/types"
import type { AgentDetail, AgentListParams, AgentListResponse, AgentProfile, AgentWriteInput } from "@/features/agents/types"

export function listAgents(params: AgentListParams) {
  return callContract<AgentListResponse>("agents.list", {
    query: {
      q: params.q,
      status: params.status,
      environment: params.environment,
      type: params.type,
      sort: params.sort,
      page: params.page,
    },
  })
}

export function getAgent(id: string) {
  return callContract<AgentDetail>("agents.get", { params: { id } })
}

export function createAgent(input: AgentWriteInput) {
  return callContract<{ agent: AgentProfile }>("agents.create", { body: input })
}

export function updateAgent(id: string, input: AgentWriteInput) {
  return callContract<{ agent: AgentProfile }>("agents.update", { params: { id }, body: input })
}

export function deleteAgent(id: string) {
  return callContract<void>("agents.delete", { params: { id } })
}

export function setAgentActive(id: string, active: boolean) {
  return callContract<{ agent: AgentProfile }>("agents.update", {
    params: { id },
    body: { status: active ? "active" : "paused" },
  })
}

export function triggerAgentExecution(id: string) {
  return callContract<{ execution: ExecutionRecord }>("agents.trigger", { params: { id } })
}

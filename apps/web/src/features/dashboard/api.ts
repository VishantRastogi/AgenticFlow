import { callContract } from "@/features/api/real-adapter"
import type { AgentRecord, CreateAgentInput, DashboardQuery, DashboardSnapshot } from "@/features/dashboard/types"

export async function getDashboard(query: DashboardQuery) {
  return callContract<DashboardSnapshot>("operations.dashboard", {
    query: { environment: query.environment, range: query.range },
  })
}

export async function createAgent(input: CreateAgentInput) {
  return callContract<{ agent: AgentRecord }>("operations.createAgent", { body: input })
}

import type { OperationsFixture } from "@/features/dashboard/types"

export const SIMULATED_NOW = "2026-10-14T04:30:00.000Z"

const NOW = Date.parse(SIMULATED_NOW)

function hoursAgo(hours: number) {
  return new Date(NOW - hours * 3_600_000).toISOString()
}

const productionAgents = ["agt_atlas", "agt_birch", "agt_harbor", "agt_cedar"] as const
const stagingAgents = ["agt_drift", "agt_ember", "agt_finch"] as const

const generated = Array.from({ length: 90 }, (_, step) => {
  const hours = (step + 1) * 8
  const staging = step % 5 === 0
  const environment = staging ? "staging" : "production"
  const agentId = staging ? stagingAgents[step % stagingAgents.length] : productionAgents[step % productionAgents.length]
  const failed = step % 11 === 0

  return {
    id: `exe_gen_${String(step).padStart(3, "0")}`,
    agentId,
    environment,
    status: failed ? "failed" : "succeeded",
    startedAt: hoursAgo(hours),
    durationMs: 400 + (step % 9) * 250,
  } as const
})

export const operationsFixture: OperationsFixture = {
  asOf: SIMULATED_NOW,
  agents: [
    {
      id: "agt_atlas",
      name: "Atlas",
      description: "Plans multi-step work for production releases.",
      type: "planner",
      environment: "production",
      status: "active",
      timeoutMs: 45000,
      retryPolicy: "exponential",
      version: "1.4.0",
      configuration: { model: "orbit-large", tools: "plan,search" },
      updatedAt: hoursAgo(6),
    },
    {
      id: "agt_birch",
      name: "Birch",
      description: "Operates production tools and returns the result.",
      type: "operator",
      environment: "production",
      status: "active",
      timeoutMs: 30000,
      retryPolicy: "fixed",
      version: "2.1.0",
      configuration: { model: "orbit-small", tools: "shell" },
      updatedAt: hoursAgo(12),
    },
    {
      id: "agt_harbor",
      name: "Harbor",
      description: "Researches production incidents before a fix ships.",
      type: "researcher",
      environment: "production",
      status: "active",
      timeoutMs: 60000,
      retryPolicy: "exponential",
      version: "1.2.3",
      configuration: { model: "orbit-large", depth: 3 },
      updatedAt: hoursAgo(18),
    },
    {
      id: "agt_cedar",
      name: "Cedar",
      description: "Reviews production changes while waiting for the next run.",
      type: "reviewer",
      environment: "production",
      status: "idle",
      timeoutMs: 20000,
      retryPolicy: "none",
      version: "1.0.1",
      configuration: { model: "orbit-small", strict: true },
      updatedAt: hoursAgo(30),
    },
    {
      id: "agt_drift",
      name: "Drift",
      description: "Operates the staging lane for pre-release checks.",
      type: "operator",
      environment: "staging",
      status: "active",
      timeoutMs: 30000,
      retryPolicy: "fixed",
      version: "0.9.4",
      configuration: { model: "orbit-small", lane: "staging" },
      updatedAt: hoursAgo(4),
    },
    {
      id: "agt_ember",
      name: "Ember",
      description: "Researches staging failures and is currently in error.",
      type: "researcher",
      environment: "staging",
      status: "error",
      timeoutMs: 25000,
      retryPolicy: "exponential",
      version: "0.8.2",
      configuration: { model: "orbit-small", alerts: true },
      updatedAt: hoursAgo(8),
    },
    {
      id: "agt_finch",
      name: "Finch",
      description: "Plans staging work and is paused until review.",
      type: "planner",
      environment: "staging",
      status: "paused",
      timeoutMs: 40000,
      retryPolicy: "none",
      version: "0.7.0",
      configuration: { model: "orbit-small", paused: true },
      updatedAt: hoursAgo(20),
    },
    {
      id: "agt_grove",
      name: "Grove",
      description: "Reviews sandbox experiments before they are promoted.",
      type: "reviewer",
      environment: "sandbox",
      status: "idle",
      timeoutMs: 15000,
      retryPolicy: "fixed",
      version: "0.3.0",
      configuration: { model: "orbit-small", sandbox: true },
      updatedAt: hoursAgo(48),
    },
  ],
  executions: [
    ...generated,
    {
      id: "exe_run_atlas",
      agentId: "agt_atlas",
      environment: "production",
      status: "running",
      startedAt: hoursAgo(0.4),
      durationMs: null,
    },
    {
      id: "exe_queue_birch",
      agentId: "agt_birch",
      environment: "production",
      status: "queued",
      startedAt: hoursAgo(0.1),
      durationMs: null,
    },
    {
      id: "exe_run_drift",
      agentId: "agt_drift",
      environment: "staging",
      status: "running",
      startedAt: hoursAgo(0.3),
      durationMs: null,
    },
  ],
}

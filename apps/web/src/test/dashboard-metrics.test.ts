import { describe, expect, it } from "vitest"
import { deriveDashboard, percentile } from "@/features/dashboard/derive"
import type { AgentRecord, ExecutionRecord } from "@/features/dashboard/types"

const asOf = "2026-10-14T04:30:00.000Z"

const agents: AgentRecord[] = [
  { id: "agt_a", name: "A", environment: "production", status: "active" },
  { id: "agt_b", name: "B", environment: "staging", status: "error" },
]

const executions: ExecutionRecord[] = [
  {
    id: "exe_1",
    agentId: "agt_a",
    environment: "production",
    status: "succeeded",
    startedAt: "2026-10-14T02:00:00.000Z",
    durationMs: 100,
  },
  {
    id: "exe_2",
    agentId: "agt_a",
    environment: "production",
    status: "succeeded",
    startedAt: "2026-10-14T03:00:00.000Z",
    durationMs: 200,
  },
  {
    id: "exe_3",
    agentId: "agt_a",
    environment: "production",
    status: "failed",
    startedAt: "2026-10-14T01:00:00.000Z",
    durationMs: 400,
  },
  {
    id: "exe_4",
    agentId: "agt_a",
    environment: "production",
    status: "running",
    startedAt: "2026-10-14T04:00:00.000Z",
    durationMs: null,
  },
  {
    id: "exe_old",
    agentId: "agt_a",
    environment: "production",
    status: "succeeded",
    startedAt: "2026-10-01T04:00:00.000Z",
    durationMs: 9000,
  },
  {
    id: "exe_stage",
    agentId: "agt_b",
    environment: "staging",
    status: "failed",
    startedAt: "2026-10-14T03:00:00.000Z",
    durationMs: 50,
  },
]

describe("dashboard metrics", () => {
  it("uses nearest-rank percentile", () => {
    expect(percentile([400, 100, 200], 0.95)).toBe(400)
    expect(percentile([], 0.95)).toBeNull()
  })

  it("derives production metrics from the records in range", () => {
    const snapshot = deriveDashboard({ asOf, agents, executions }, { environment: "production", range: "24h" })

    expect(snapshot.kpis).toEqual({
      totalAgents: 1,
      activeAgents: 1,
      executionsToday: 4,
      successRate: 2 / 3,
      p95DurationMs: 400,
      activeRuns: 1,
    })
    expect(snapshot.volume.reduce((sum, point) => sum + point.executions, 0)).toBe(4)
    expect(snapshot.failures.map((failure) => failure.id)).toEqual(["exe_3"])
    expect(snapshot.health.status).toBe("critical")
  })

  it("changes success rate and duration when the window grows", () => {
    const day = deriveDashboard({ asOf, agents, executions }, { environment: "production", range: "24h" })
    const month = deriveDashboard({ asOf, agents, executions }, { environment: "production", range: "30d" })

    expect(month.kpis.successRate).toBe(0.75)
    expect(month.kpis.p95DurationMs).toBe(9000)
    expect(month.kpis.successRate).not.toBe(day.kpis.successRate)
    expect(month.volume.reduce((sum, point) => sum + point.executions, 0)).toBe(5)
  })

  it("drops other environments from the selected view", () => {
    const staging = deriveDashboard({ asOf, agents, executions }, { environment: "staging", range: "24h" })

    expect(staging.kpis.totalAgents).toBe(1)
    expect(staging.kpis.activeRuns).toBe(0)
    expect(staging.kpis.successRate).toBe(0)
    expect(staging.health.status).toBe("critical")
  })
})

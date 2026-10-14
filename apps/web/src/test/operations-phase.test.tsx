import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AnalyticsScreen } from "@/features/analytics/analytics-screen"
import { costFor, deriveAnalytics, tokensFor } from "@/features/analytics/derive"
import { SettingsScreen } from "@/features/settings/settings-screen"
import type { AgentRecord, ExecutionRecord } from "@/features/dashboard/types"
import { activeRelease, deployEnvironment, rollbackEnvironment } from "@/mocks/deployment-store"
import { listAuditEvents, maskFields, maskSecret, recordAudit } from "@/mocks/audit-store"
import { readSettings, saveIntegration } from "@/mocks/settings-store"
import { renderWithProviders } from "@/test/render"

const asOf = "2026-10-14T04:30:00.000Z"

const agents: AgentRecord[] = [
  { id: "agt_a", name: "Atlas", environment: "production", status: "active", configuration: { model: "orbit-large" }, version: "1.0.0", updatedAt: asOf },
  { id: "agt_b", name: "Birch", environment: "staging", status: "idle", configuration: { model: "orbit-small" }, version: "1.0.0", updatedAt: asOf },
]

const executions: ExecutionRecord[] = [
  { id: "exe_ok", agentId: "agt_a", environment: "production", status: "succeeded", startedAt: "2026-10-14T03:30:00.000Z", durationMs: 1000 },
  { id: "exe_bad", agentId: "agt_a", environment: "production", status: "failed", startedAt: "2026-10-14T02:30:00.000Z", durationMs: 3000 },
  { id: "exe_stop", agentId: "agt_a", environment: "production", status: "cancelled", startedAt: "2026-10-14T03:00:00.000Z", durationMs: 500 },
  { id: "exe_stage", agentId: "agt_b", environment: "staging", status: "succeeded", startedAt: "2026-10-14T03:30:00.000Z", durationMs: 2000 },
]

describe("analytics derivation", () => {
  it("derives latency, tokens, and cost from finished runs", () => {
    const snapshot = deriveAnalytics({ agents, executions, asOf }, { environment: "production", range: "24h" })
    expect(snapshot.outcomes.find((item) => item.outcome === "succeeded")?.count).toBe(1)
    expect(snapshot.outcomes.find((item) => item.outcome === "failed")?.count).toBe(1)
    expect(snapshot.outcomes.find((item) => item.outcome === "cancelled")?.count).toBe(1)
    expect(snapshot.latency).toEqual({ p50: 1000, p95: 3000, p99: 3000 })
    expect(snapshot.tokens).toBe(tokensFor(1000, "orbit-large") + tokensFor(3000, "orbit-large"))
    expect(snapshot.cost).toBeCloseTo(costFor(snapshot.tokens, "orbit-large"))
    expect(snapshot.leaderboard.find((row) => row.agentId === "agt_b")).toBeUndefined()
    expect(snapshot.throughput.reduce((sum, point) => sum + point.executions, 0)).toBe(3)
  })
})

describe("deployments", () => {
  it("bumps a healthy environment and refuses to activate a critical one", () => {
    const before = activeRelease("production").version
    const deployed = deployEnvironment("production")
    expect(deployed.release.status).toBe("active")
    expect(deployed.frames.map((frame) => frame.state)).toEqual(["succeeded", "succeeded", "succeeded", "succeeded", "succeeded"])
    expect(activeRelease("production").version).not.toBe(before)

    const stagingBefore = activeRelease("staging").version
    const failed = deployEnvironment("staging")
    expect(failed.release.status).toBe("failed")
    expect(failed.frames[3]?.state).toBe("failed")
    expect(failed.frames[4]?.state).toBe("skipped")
    expect(activeRelease("staging").version).toBe(stagingBefore)
  })

  it("rolls back to the previous release", () => {
    const rolled = rollbackEnvironment("development")
    if ("error" in rolled) throw new Error(rolled.reason)
    expect(activeRelease("development").version).toBe(rolled.release.version)
    expect(rolled.release.note).toContain("Rolled back")
  })
})

describe("audit log", () => {
  it("masks secrets and records a mutation", () => {
    expect(maskSecret("orbit-secret")).toBe("or••••et")
    expect(maskFields({ password: "orbit-7481", name: "Ada" })).toEqual({ password: "or••••81", name: "Ada" })
    const event = recordAudit({
      actor: "Ada Lovelace",
      action: "integration.saved",
      resourceType: "integration",
      resourceId: "int_test",
      outcome: "succeeded",
      detail: "Saved locally.",
      fields: { secret: "orbit-secret" },
    })
    expect(event.fields.secret).toBe("or••••et")
    expect(listAuditEvents().some((item) => item.id === event.id)).toBe(true)
    expect(listAuditEvents().some((item) => item.action === "agent.registered" && item.resourceId === "agt_atlas")).toBe(true)
  })

  it("records a cancelled execution from the mock API", async () => {
    const response = await fetch("http://localhost:3000/api/executions/exe_queue_birch/cancel", { method: "POST" })
    expect(response.status).toBe(200)
    expect(listAuditEvents().some((event) => event.action === "execution.cancelled" && event.resourceId === "exe_queue_birch")).toBe(true)
  })
})

describe("settings", () => {
  it("stores an integration secret only as a mask", () => {
    const saved = saveIntegration({ name: "Webhook", secret: "local-key-1" })
    expect(saved.integration.secretMask).not.toContain("local-key-1")
    expect(saved.integration.note).toContain("No provider was contacted")
    expect(JSON.stringify(readSettings())).not.toContain("local-key-1")
  })

  it("rejects an invalid organization slug", async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsScreen />)
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument()
    await user.clear(await screen.findByRole("textbox", { name: "Organization slug" }))
    await user.type(screen.getByRole("textbox", { name: "Organization slug" }), "Local Workspace")
    await user.click(screen.getByRole("button", { name: "Save organization" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Use lowercase letters, numbers, and hyphens.")
  })
})

describe("analytics screen", () => {
  it("shows the shared leaderboard", async () => {
    renderWithProviders(<AnalyticsScreen />)
    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "Atlas" })).toBeInTheDocument()
  })
})

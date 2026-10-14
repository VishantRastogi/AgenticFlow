import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AgentDetailScreen } from "@/features/agents/components/agent-detail-screen"
import { AgentsScreen } from "@/features/agents/components/agents-screen"
import { NewAgentScreen } from "@/features/agents/components/new-agent-screen"
import { agentStats, queryAgents } from "@/features/agents/catalog"
import type { AgentProfile } from "@/features/agents/types"
import { server } from "@/mocks/server"
import { renderWithProviders } from "@/test/render"

const navigation = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/agents",
}))

const atlas: AgentProfile = {
  id: "agt_a",
  name: "Atlas",
  description: "Plans the work.",
  type: "planner",
  environment: "production",
  status: "active",
  timeoutMs: 30000,
  retryPolicy: "fixed",
  version: "1.0.0",
  configuration: { model: "orbit-small" },
  updatedAt: "2026-10-14T04:00:00.000Z",
}

describe("agent catalog", () => {
  it("filters, sorts, and derives success rate from executions", () => {
    const grove: AgentProfile = {
      ...atlas,
      id: "agt_g",
      name: "Grove",
      description: "Reviews sandbox work.",
      status: "idle",
      environment: "sandbox",
      type: "reviewer",
    }
    const executions = [
      { id: "exe_1", agentId: "agt_a", environment: "production" as const, status: "succeeded" as const, startedAt: "2026-10-14T03:00:00.000Z", durationMs: 100 },
      { id: "exe_2", agentId: "agt_a", environment: "production" as const, status: "failed" as const, startedAt: "2026-10-14T02:00:00.000Z", durationMs: 200 },
    ]
    expect(agentStats("agt_a", executions).successRate).toBe(0.5)
    const page = queryAgents([atlas, grove], executions, {
      q: "plan",
      status: "all",
      environment: "all",
      type: "all",
      sort: "name",
      page: 1,
    })
    expect(page.agents.map((agent) => agent.name)).toEqual(["Atlas"])
    expect(page.total).toBe(1)
  })
})

describe("agent studio", () => {
  beforeEach(() => {
    navigation.push.mockReset()
  })

  it("filters the catalog and pages through the remaining agents", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AgentsScreen />)

    expect(await screen.findByRole("link", { name: "Atlas" })).toBeInTheDocument()
    await user.type(screen.getByLabelText("Search agents"), "Grove")
    expect(await screen.findByRole("link", { name: "Grove" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Atlas" })).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText("Search agents"))
    await user.selectOptions(screen.getByLabelText("Status"), "error")
    expect(await screen.findByRole("link", { name: "Ember" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Atlas" })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText("Status"), "all")
    await user.click(await screen.findByRole("button", { name: "Next" }))
    expect(await screen.findByRole("link", { name: "Harbor" })).toBeInTheDocument()
  })

  it("rejects an incomplete agent and then creates one", async () => {
    const user = userEvent.setup()
    renderWithProviders(<NewAgentScreen />)

    await user.click(screen.getByRole("button", { name: "Create agent" }))
    expect(await screen.findByText("Enter at least 2 characters.")).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^Name/), "Quill")
    await user.type(screen.getByLabelText(/^Description/), "Reviews sandbox drafts before promotion.")
    await user.selectOptions(screen.getByLabelText(/^Type/), "reviewer")
    await user.selectOptions(screen.getByLabelText(/^Environment/), "sandbox")
    await user.click(screen.getByRole("button", { name: "Create agent" }))

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith("/agents/agt_quill_1")
    })

    const dashboard = await fetch("http://localhost:3000/api/operations/dashboard?environment=all&range=24h")
    const body = (await dashboard.json()) as { kpis: { totalAgents: number } }
    expect(body.kpis.totalAgents).toBe(9)
  })

  it("updates, activates, runs, and deletes an agent", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AgentDetailScreen agentId="agt_cedar" />)

    expect(await screen.findByRole("heading", { name: "Cedar" })).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Configuration" }))
    const description = screen.getByLabelText(/^Description/)
    await user.clear(description)
    await user.type(description, "Reviews production changes after the latest patch.")
    await user.clear(screen.getByLabelText(/^Version/))
    await user.type(screen.getByLabelText(/^Version/), "1.0.2")
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    expect(await screen.findByText("Configuration saved.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Activate" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Activate" }))
    expect(await screen.findByText("Active")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Run agent" }))
    expect(await screen.findByText(/Recorded exe_trig_1 as succeeded/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Delete" }))
    await user.click(screen.getByRole("button", { name: "Delete agent" }))
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith("/agents")
    })
  })

  it("records a failed run for an error agent and blocks a paused agent", async () => {
    const user = userEvent.setup()
    const { unmount } = renderWithProviders(<AgentDetailScreen agentId="agt_ember" />)
    await user.click(await screen.findByRole("button", { name: "Run agent" }))
    expect(await screen.findByText(/Recorded exe_trig_1 as failed/)).toBeInTheDocument()
    unmount()

    renderWithProviders(<AgentDetailScreen agentId="agt_finch" />)
    expect(await screen.findByRole("button", { name: "Run agent" })).toBeDisabled()
    expect(screen.getByText(/Paused agents cannot run/)).toBeInTheDocument()
  })

  it("shows a network failure and retries the catalog", async () => {
    const user = userEvent.setup()
    server.use(http.get("*/api/agents", () => HttpResponse.error()))
    renderWithProviders(<AgentsScreen />)

    expect(await screen.findByRole("alert")).toHaveTextContent("The operations service could not be reached.")
    server.resetHandlers()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("link", { name: "Atlas" })).toBeInTheDocument()
  })
})

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"
import { DashboardScreen } from "@/features/dashboard/components/dashboard-screen"
import { deriveDashboard } from "@/features/dashboard/derive"
import { formatPercent, formatSeconds } from "@/features/dashboard/format"
import { operationsFixture } from "@/mocks/fixtures/operations"
import { server } from "@/mocks/server"
import { renderWithProviders } from "@/test/render"

function snapshot(environment: "all" | "production" | "staging" | "sandbox", range: "24h" | "7d" | "30d") {
  return deriveDashboard(operationsFixture, { environment, range })
}

describe("command center", () => {
  it("updates metrics when the environment and date range change", async () => {
    const user = userEvent.setup()
    const initial = snapshot("all", "24h")
    const sandbox = snapshot("sandbox", "24h")
    const month = snapshot("all", "30d")
    renderWithProviders(<DashboardScreen />)

    expect(await screen.findByRole("group", { name: `Total Agents ${initial.kpis.totalAgents}` })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: `Success Rate ${formatPercent(initial.kpis.successRate)}` })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Simulated live activity")
    expect(initial.kpis.totalAgents).not.toBe(sandbox.kpis.totalAgents)

    await user.selectOptions(screen.getByLabelText("Environment"), "sandbox")

    expect(await screen.findByRole("group", { name: "Total Agents 1" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Active Agents 0" })).toBeInTheDocument()
    expect(document.body).toHaveTextContent("No executions in this window")

    await user.selectOptions(screen.getByLabelText("Environment"), "all")
    await user.click(screen.getByRole("radio", { name: "30 days" }))

    expect(await screen.findByRole("group", { name: `Success Rate ${formatPercent(month.kpis.successRate)}` })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: `p95 Duration ${formatSeconds(month.kpis.p95DurationMs)}` })).toBeInTheDocument()
    expect(month.kpis.successRate).not.toBe(initial.kpis.successRate)
  })

  it("shows a network error and retries into the command center", async () => {
    const user = userEvent.setup()
    server.use(http.get("*/api/operations/dashboard", () => HttpResponse.error()))
    renderWithProviders(<DashboardScreen />)

    expect(await screen.findByRole("alert")).toHaveTextContent("The operations service could not be reached.")

    server.resetHandlers()
    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByRole("heading", { name: "Command Center" })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("group", { name: /Total Agents/ })).toBeInTheDocument()
    })
  })

  it("navigates to executions and creates an agent through the operations API", async () => {
    const user = userEvent.setup()
    const initial = snapshot("all", "24h")
    renderWithProviders(<DashboardScreen />)

    expect(await screen.findByRole("link", { name: "Review executions" })).toHaveAttribute("href", "/executions")
    expect(screen.getByRole("link", { name: "Open agents" })).toHaveAttribute("href", "/agents")

    await user.click(screen.getByRole("button", { name: "New agent" }))
    await user.type(screen.getByLabelText("Agent name"), "Nova")
    await user.click(screen.getByRole("button", { name: "Create agent" }))

    expect(await screen.findByRole("group", { name: `Total Agents ${initial.kpis.totalAgents + 1}` })).toBeInTheDocument()
  })
})

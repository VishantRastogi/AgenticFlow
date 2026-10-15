import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AnalyticsScreen } from "@/features/analytics/analytics-screen"
import { AgentsScreen } from "@/features/agents/agents-screen"
import { AuditLogsScreen } from "@/features/audit-logs/audit-logs-screen"
import { DeploymentsScreen } from "@/features/deployments/deployments-screen"
import { ExecutionsScreen } from "@/features/executions/executions-screen"
import { OverviewScreen } from "@/features/overview/overview-screen"
import { SettingsScreen } from "@/features/settings/settings-screen"
import { WorkflowsScreen } from "@/features/workflows/workflows-screen"
import { moduleList } from "@/lib/modules"
import NotFound from "@/app/not-found"
import { renderWithProviders } from "@/test/render"

const screens = [
  ["Overview", OverviewScreen],
  ["Agents", AgentsScreen],
  ["Workflows", WorkflowsScreen],
  ["Executions", ExecutionsScreen],
  ["Analytics", AnalyticsScreen],
  ["Deployments", DeploymentsScreen],
  ["Audit Logs", AuditLogsScreen],
] as const

describe("route navigation", () => {
  it("registers every mission control destination", () => {
    expect(moduleList().map((item) => item.href)).toEqual([
      "/overview",
      "/dashboard",
      "/agents",
      "/playground",
      "/knowledge-bases",
      "/rag-studio",
      "/workflows",
      "/executions",
      "/evaluations",
      "/analytics",
      "/deployments",
      "/audit-logs",
      "/settings",
    ])
  })

  it.each(screens)("renders the %s destination", (title, Screen) => {
    if (title === "Agents" || title === "Workflows" || title === "Executions" || title === "Analytics" || title === "Deployments" || title === "Audit Logs") {
      renderWithProviders(<Screen />)
    } else {
      render(<Screen />)
    }
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument()
  })

  it("renders settings and the not found screen", () => {
    renderWithProviders(<SettingsScreen />)
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument()

    render(<NotFound />)
    expect(
      screen.getByRole("heading", { level: 1, name: "This page is not in Mission Control" }),
    ).toBeInTheDocument()
  })
})

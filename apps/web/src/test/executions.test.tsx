import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ExecutionDetailScreen } from "@/features/executions/components/execution-detail"
import { ExecutionsScreen } from "@/features/executions/executions-screen"
import { createPollingFeed } from "@/features/executions/feed"
import { advanceExecution, cancelPermission, retryPermission } from "@/features/executions/lifecycle"
import { filterLogs, logsAsText, projectExecution } from "@/features/executions/project"
import { queryExecutions } from "@/features/executions/query"
import { listAgents, listExecutions } from "@/mocks/operations-store"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"
import { server } from "@/mocks/server"
import { renderWithProviders } from "@/test/render"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/executions",
  useSearchParams: () => new URLSearchParams(),
}))

describe("execution lifecycle", () => {
  it("advances a queued run and refuses invalid cancel or retry", () => {
    expect(cancelPermission("completed").allowed).toBe(false)
    expect(cancelPermission("queued").allowed).toBe(true)
    expect(retryPermission({ status: "running", attempt: 1, policy: "fixed" }).allowed).toBe(false)
    expect(retryPermission({ status: "failed", attempt: 1, policy: "none" }).allowed).toBe(false)
    expect(retryPermission({ status: "failed", attempt: 1, policy: "fixed" }).allowed).toBe(true)

    const running = advanceExecution({ status: "queued", cursor: 0 }, "active")
    expect(running).toEqual({ status: "running", cursor: 1 })
    const finished = advanceExecution(advanceExecution({ status: "running", cursor: 2 }, "active"), "active")
    expect(finished.status).toBe("completed")
    expect(advanceExecution({ status: "queued", cursor: 1 }, "error").status).toBe("failed")
  })

  it("keeps failed logs free of a success line and filters severity", () => {
    const agents = listAgents()
    const failed = listExecutions().find((execution) => execution.status === "failed")
    expect(failed).toBeTruthy()
    const agent = agents.find((item) => item.id === failed?.agentId)
    const detail = projectExecution({
      record: failed!,
      agentName: agent?.name ?? "Agent",
      agentStatus: agent?.status ?? "idle",
      retryPolicy: agent?.retryPolicy ?? "fixed",
      asOf: SIMULATED_NOW,
    })
    expect(detail.output).toBeNull()
    expect(detail.error?.message).toContain("failed")
    expect(detail.logs.some((log) => log.message.includes("succeeded"))).toBe(false)
    expect(filterLogs(detail.logs, "error", "").every((log) => log.severity === "error")).toBe(true)
    expect(logsAsText(detail.logs)).toContain("[error]")
  })

  it("filters completed history without dropping shared records", () => {
    const agents = listAgents()
    const records = listExecutions()
    const completed = queryExecutions(records, agents, { q: "atlas", agent: "all", environment: "all", status: "completed", range: "all", sort: "newest", page: 1 }, SIMULATED_NOW)
    expect(completed.total).toBeGreaterThan(0)
    expect(completed.executions.every((execution) => execution.status === "completed")).toBe(true)
    const day = queryExecutions(records, agents, { q: "", agent: "all", environment: "production", status: "all", range: "24h", sort: "oldest", page: 1 }, SIMULATED_NOW)
    expect(day.executions.every((execution) => Date.parse(SIMULATED_NOW) - Date.parse(execution.startedAt) <= 86_400_000)).toBe(true)
  })

  it("stops the polling feed after a terminal update", async () => {
    const seen: string[] = []
    const timer: { run: (() => void) | null } = { run: null }
    let calls = 0
    const feed = createPollingFeed({
      poll: async () => {
        calls += 1
        return calls === 1 ? "running" : "completed"
      },
      intervalMs: 25,
      isTerminal: (value) => value === "completed",
      schedule: (callback) => {
        timer.run = callback
        return {
          cancel: () => {
            timer.run = null
          },
        }
      },
    })
    feed.start((value) => seen.push(value), () => undefined)
    await waitFor(() => expect(seen).toEqual(["running"]))
    timer.run?.()
    await waitFor(() => expect(seen).toEqual(["running", "completed"]))
    expect(timer.run).toBeNull()
  })
})

describe("execution observatory", () => {
  it("filters the shared history", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExecutionsScreen />)
    expect(await screen.findByRole("link", { name: "exe_queue_birch" })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("Status"), "running")
    expect(await screen.findByRole("link", { name: "exe_run_atlas" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "exe_queue_birch" })).not.toBeInTheDocument()
  })

  it("cancels a queued run and retries a failed one", async () => {
    const user = userEvent.setup()
    const view = renderWithProviders(<ExecutionDetailScreen executionId="exe_queue_birch" />)
    expect(await screen.findByRole("button", { name: "Cancel" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await user.click(screen.getByRole("button", { name: "Stop run" }))
    expect(await screen.findByText("Run cancelled.")).toBeInTheDocument()
    expect(listExecutions().find((execution) => execution.id === "exe_queue_birch")?.status).toBe("cancelled")
    view.unmount()

    renderWithProviders(<ExecutionDetailScreen executionId="exe_gen_000" />)
    expect(await screen.findByRole("button", { name: "Retry" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Retry" }))
    await user.click(screen.getByRole("button", { name: "Retry run" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/executions\/exe_retry_/)))
    expect(listExecutions().some((execution) => execution.retryOf === "exe_gen_000")).toBe(true)
    expect(listExecutions().find((execution) => execution.id === "exe_gen_000")?.status).toBe("failed")
  })

  it("rejects a cancel of a completed run and a retry of a running run", async () => {
    const blockedCancel = await fetch("http://localhost:3000/api/executions/exe_gen_001/cancel", { method: "POST" })
    expect(blockedCancel.status).toBe(409)
    const blockedRetry = await fetch("http://localhost:3000/api/executions/exe_run_atlas/retry", { method: "POST" })
    expect(blockedRetry.status).toBe(409)
    const tick = await fetch("http://localhost:3000/api/executions/exe_run_atlas/tick", { method: "POST" })
    expect(tick.status).toBe(200)
    const body = (await tick.json()) as { simulated: boolean; execution: { status: string } }
    expect(body.simulated).toBe(true)
    expect(body.execution.status).toBe("running")
    expect(listExecutions().find((execution) => execution.id === "exe_run_atlas")?.status).toBe("running")
  })

  it("shows a network failure and retries the history", async () => {
    const user = userEvent.setup()
    server.use(http.get("*/api/executions", () => HttpResponse.error()))
    renderWithProviders(<ExecutionsScreen />)
    expect(await screen.findByRole("alert")).toHaveTextContent("The execution service could not be reached.")
    server.resetHandlers()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(screen.getByRole("link", { name: "exe_queue_birch" })).toBeInTheDocument())
  })
})

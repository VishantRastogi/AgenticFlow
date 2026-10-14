import { QueryClient } from "@tanstack/react-query"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { callContract } from "@/features/api/real-adapter"
import { createAgent, listAgents } from "@/features/agents/api"
import { useAgentList, useCreateAgentRecord } from "@/features/agents/hooks"
import { ApiError } from "@/features/auth/api/errors"
import { login } from "@/features/auth/api/client"
import { renderWithProviders } from "@/test/render"

const agentInput = {
  name: "Cache Probe",
  description: "Persists through the mock API.",
  type: "operator" as const,
  environment: "sandbox" as const,
  timeoutMs: 30000,
  retryPolicy: "none" as const,
  version: "0.1.0",
  configuration: { model: "orbit-small" },
}

describe("real API adapter", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("names the missing operation when the real endpoint is not implemented", async () => {
    const previousMode = process.env.NEXT_PUBLIC_API_MODE
    const previousUrl = process.env.NEXT_PUBLIC_API_URL
    process.env.NEXT_PUBLIC_API_MODE = "real"
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:9"
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404, headers: { "content-type": "text/plain" } })),
    )

    try {
      await expect(login({ email: "ada@agentflow.test", password: "orbit-7481" })).rejects.toMatchObject({
        code: "api_unavailable",
        message: expect.stringContaining("auth.login"),
      })
      await expect(login({ email: "ada@agentflow.test", password: "orbit-7481" })).rejects.toMatchObject({
        message: expect.stringContaining("Mock mode was not used"),
      })
    } finally {
      if (previousMode === undefined) delete process.env.NEXT_PUBLIC_API_MODE
      else process.env.NEXT_PUBLIC_API_MODE = previousMode
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
      else process.env.NEXT_PUBLIC_API_URL = previousUrl
    }
  })

  it("refuses the execution stream because no SSE handler exists", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    await expect(callContract("executions.stream", { params: { id: "exe_1" } })).rejects.toBeInstanceOf(ApiError)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it("keeps a created agent in the next mock read", async () => {
    const created = await createAgent(agentInput)
    const listed = await listAgents({
      q: "Cache Probe",
      status: "all",
      environment: "all",
      type: "all",
      sort: "name",
      page: 1,
    })

    expect(listed.agents.some((agent) => agent.id === created.agent.id)).toBe(true)
  })
})

function AgentProbe() {
  const list = useAgentList({ q: "", status: "all", environment: "all", type: "all", sort: "name", page: 1 })
  const create = useCreateAgentRecord()

  return (
    <div>
      <p>{list.data?.agents.some((agent) => agent.name === "Cache Probe") ? "present" : "absent"}</p>
      <button type="button" onClick={() => create.mutate(agentInput)}>
        Add probe
      </button>
    </div>
  )
}

describe("agent cache invalidation", () => {
  it("refetches the list after a successful create", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AgentProbe />)
    expect(await screen.findByText("absent")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Add probe" }))
    expect(await screen.findByText("present")).toBeInTheDocument()
  })

  it("does not keep a removed query in the client after invalidation", async () => {
    const client = new QueryClient()
    client.setQueryData(["agents", "list", { stale: true }], { agents: [] })
    await client.invalidateQueries({ queryKey: ["agents"] })
    expect(client.getQueryState(["agents", "list", { stale: true }])?.isInvalidated).toBe(true)
  })
})

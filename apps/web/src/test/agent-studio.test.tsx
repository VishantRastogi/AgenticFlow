import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getAgent, triggerAgentExecution } from "@/features/agents/api"
import { AgentDetailScreen } from "@/features/agents/components/agent-detail-screen"
import { defaultAgentConfiguration } from "@/features/agents/studio-catalog"
import { getAgentStudio, listAgentTestRuns, publishAgentStudio, rollbackAgentStudio, saveAgentStudio, testAgentStudio } from "@/features/agents/studio-api"
import type { AgentConfiguration } from "@/features/agents/studio-types"
import { createKnowledgeBase, uploadDocument } from "@/features/knowledge/api"
import type { KnowledgeBaseCreateRequest } from "@/features/knowledge/types"
import { advanceIngestionJob } from "@/mocks/knowledge-store"
import { renderWithProviders } from "@/test/render"

const navigation = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/agents/agt_cedar",
}))

const settings: KnowledgeBaseCreateRequest["settings"] = {
  embeddingModel: "orbit-embed-small",
  chunkSize: 512,
  chunkOverlap: 64,
  retrieval: { topK: 4, scoreThreshold: 0.2 },
  metadataSchema: { source: "string" },
}

function draft(patch: (config: AgentConfiguration) => void) {
  const config = defaultAgentConfiguration()
  patch(config)
  return config
}

function finish(workspaceId: string, knowledgeBaseId: string, jobId: string) {
  let current = jobId
  let stage = "UPLOADED"
  for (let guard = 0; guard < 8 && stage !== "READY" && stage !== "FAILED"; guard += 1) {
    const next = advanceIngestionJob(workspaceId, knowledgeBaseId, current)
    if (!next.ok) throw new Error(next.message)
    current = next.job.id
    stage = next.job.stage
  }
  if (stage !== "READY") throw new Error(`Expected READY, received ${stage}`)
}

describe("agent studio API", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("rejects model capabilities, budgets, schemas, and tool permissions", async () => {
    await expect(saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.model.temperature = 1.4
    }))).rejects.toMatchObject({ code: "validation_error", message: "Orbit Small accepts a temperature from 0 to 1." })

    await expect(saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.model.toolCalling = "required"
    }))).rejects.toMatchObject({ message: "Orbit Small does not support required tool calling." })

    await expect(saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.model.structuredOutput = true
      config.model.outputSchema = { type: "object" }
    }))).rejects.toMatchObject({ message: "Orbit Small does not support structured output." })

    await expect(saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.model.provider = "northstar-simulated"
    }))).rejects.toMatchObject({ message: "Choose a model offered by that provider." })

    await expect(saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.execution.timeoutMs = 500
    }))).rejects.toMatchObject({ message: "Timeout must be between 1 second and 5 minutes." })

    await expect(saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.execution.maxDurationMs = 1000
    }))).rejects.toMatchObject({ message: "The execution budget duration must cover the timeout and stay within 5 minutes." })

    await expect(saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.execution.budgetUsd = 120
    }))).rejects.toMatchObject({ message: "The cost budget must be from 0 to 100 USD." })

    await expect(saveAgentStudio("local", "agt_cedar", draft((config) => {
      const calculator = config.tools.find((tool) => tool.id === "calculator")
      if (!calculator) throw new Error("missing calculator")
      calculator.inputSchema = [] as unknown as Record<string, unknown>
    }))).rejects.toMatchObject({ message: "Calculator needs JSON object schemas." })

    await expect(saveAgentStudio("local", "agt_cedar", draft((config) => {
      const http = config.tools.find((tool) => tool.id === "http_api")
      if (!http) throw new Error("missing http tool")
      http.enabled = true
      http.requiresApproval = false
      config.guardrails.allowedToolIds = ["calculator", "http_api"]
    }))).rejects.toMatchObject({ message: "HTTP API performs a side effect and needs human approval." })

    await expect(saveAgentStudio("local", "missing", defaultAgentConfiguration())).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "Agent not found.",
    })
  })

  it("attaches only workspace knowledge bases and warns when none are ready", async () => {
    const created = await createKnowledgeBase({
      workspaceId: "local",
      name: "Handbook",
      description: "Support articles",
      settings,
    })
    const empty = await saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.knowledge = [{
        knowledgeBaseId: created.knowledgeBase.id,
        strategy: "hybrid",
        topK: 2,
        scoreThreshold: 0.2,
        rerank: true,
        contextTokenBudget: 800,
        requireCitations: true,
      }]
    }))
    expect(empty.warnings[0]).toContain("has no READY documents")

    const uploaded = await uploadDocument(created.knowledgeBase.id, {
      workspaceId: "local",
      name: "notes.md",
      mediaType: "text/markdown",
      sizeBytes: 24,
    })
    finish("local", created.knowledgeBase.id, uploaded.job.id)
    const ready = await testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "Summarize the handbook" })
    const retrieval = ready.steps.find((step) => step.kind === "retrieve")
    expect(retrieval?.chunkIds?.length).toBeGreaterThan(0)
    expect(ready.notice).toContain("Simulated agent test")

    const other = await createKnowledgeBase({
      workspaceId: "other",
      name: "Foreign",
      description: "",
      settings,
    })
    await expect(saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.knowledge = [{
        knowledgeBaseId: other.knowledgeBase.id,
        strategy: "vector",
        topK: 1,
        scoreThreshold: 0,
        rerank: false,
        contextTokenBudget: 128,
        requireCitations: false,
      }]
    }))).rejects.toMatchObject({ code: "not_found", message: "Knowledge base not found." })

    const isolated = await getAgentStudio("other", "agt_cedar")
    expect(isolated.draft.knowledge).toHaveLength(0)
    expect(empty.draft.knowledge).toHaveLength(1)
  })

  it("publishes immutable versions, restores a draft, and keeps execution versions", async () => {
    const before = await getAgent("agt_cedar")
    await saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.model.temperature = 0.4
    }))
    expect((await getAgent("agt_cedar")).agent.version).toBe(before.agent.version)

    const published = await publishAgentStudio("agt_cedar", {
      workspaceId: "local",
      version: "9.1.0",
      note: "Publish the studio draft.",
    })
    const snapshot = structuredClone(published.versions[0]?.configuration)
    expect(published.publishedVersion).toBe("9.1.0")
    expect(published.versions[0]?.immutable).toBe(true)
    expect((await getAgent("agt_cedar")).agent.version).toBe(before.agent.version)

    await publishAgentStudio("agt_cedar", {
      workspaceId: "other",
      version: "9.1.0",
      note: "Publish the other workspace.",
    })
    expect((await getAgentStudio("local", "agt_cedar")).publishedVersion).toBe("9.1.0")
    expect((await getAgentStudio("other", "agt_cedar")).versions).toHaveLength(1)
    expect((await getAgent("agt_cedar")).agent.version).toBe(before.agent.version)

    await saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.model.temperature = 0.8
    }))
    const afterEdit = await getAgentStudio("local", "agt_cedar")
    expect(afterEdit.draft.model.temperature).toBe(0.8)
    expect(afterEdit.versions[0]?.configuration.model.temperature).toBe(snapshot?.model.temperature)

    await expect(publishAgentStudio("agt_cedar", {
      workspaceId: "local",
      version: "9.1.0",
      note: "Publish the studio draft.",
    })).rejects.toMatchObject({ status: 409, message: "That version is already published and cannot be changed." })

    const restored = await rollbackAgentStudio("agt_cedar", { workspaceId: "local", version: "9.1.0" })
    expect(restored.draft.model.temperature).toBe(0.4)
    expect(restored.publishedVersion).toBe("9.1.0")
    expect(restored.versions[0]?.configuration.model.temperature).toBe(0.4)

    const first = await triggerAgentExecution("agt_cedar")
    expect(first.execution.agentVersion).toBe(before.agent.version)
    const historical = (await getAgent("agt_cedar")).executions.find((execution) => execution.id !== first.execution.id)
    expect(historical?.agentVersion).toBeUndefined()
    expect(historical?.agentVersion ?? "unknown").toBe("unknown")
  })

  it("keeps simulated tests inside step, token, tool, and cost limits", async () => {
    await saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.execution.maxSteps = 1
    }))
    const stepped = await testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "Summarize the handbook" })
    expect(stepped.status).toBe("limited")
    expect(stepped.steps).toHaveLength(1)

    await saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.model.maxOutputTokens = 1
      config.execution.maxTokenBudget = 1
    }))
    const tokens = await testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "Summarize the handbook" })
    expect(tokens.steps[0]?.kind).toBe("limit")
    expect(tokens.steps[0]?.detail).toContain("Token budget")

    await saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.execution.budgetUsd = 0
    }))
    const budget = await testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "Summarize the handbook" })
    expect(budget.steps[0]?.detail).toContain("Cost budget")

    await saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.execution.maxToolCalls = 0
    }))
    const quiet = await testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "Summarize the handbook" })
    expect(quiet.steps.some((step) => step.kind === "tool")).toBe(false)

    const failed = await testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "fail this run" })
    expect(failed.status).toBe("failed")
    expect(failed.error).toContain("No tool was executed")

    const masked = await testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "the secret is hunter" })
    expect(JSON.stringify(masked.steps)).not.toContain("hunter")

    await expect(testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "rate limit please" })).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
    })
    expect((await getAgent("agt_cedar")).executions.some((execution) => execution.id.startsWith("agt_test_"))).toBe(false)

    const recorded = await testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "Summarize the handbook" })
    const history = await listAgentTestRuns("local", "agt_cedar")
    expect(history.runs[0]).toMatchObject({
      runId: recorded.requestId,
      traceId: recorded.traceId,
      agentId: "agt_cedar",
      workspaceId: "local",
      agentVersion: "draft",
      status: recorded.status,
      durationMs: recorded.latencyMs,
    })
    expect(history.runs[0]?.steps.length).toBeGreaterThan(0)
    expect((await listAgentTestRuns("other", "agt_cedar")).runs).toHaveLength(0)
    expect((await listAgentTestRuns("local", "agt_cedar")).runs[0]?.runId).toBe(recorded.requestId)

    const controller = new AbortController()
    controller.abort()
    await expect(
      testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "Summarize the handbook" }, controller.signal),
    ).rejects.toMatchObject({ code: "cancelled" })
    expect((await listAgentTestRuns("local", "agt_cedar")).runs[0]?.runId).toBe(recorded.requestId)
  })

  it("fails closed in real mode and leaves the mock draft in place", async () => {
    await saveAgentStudio("local", "agt_cedar", draft((config) => {
      config.model.temperature = 0.3
    }))
    const previousMode = process.env.NEXT_PUBLIC_API_MODE
    const previousUrl = process.env.NEXT_PUBLIC_API_URL
    process.env.NEXT_PUBLIC_API_MODE = "real"
    delete process.env.NEXT_PUBLIC_API_URL
    try {
      await expect(getAgentStudio("local", "agt_cedar")).rejects.toMatchObject({
        code: "api_unavailable",
        message: expect.stringContaining("Mock mode was not used"),
      })
    } finally {
      if (previousMode === undefined) delete process.env.NEXT_PUBLIC_API_MODE
      else process.env.NEXT_PUBLIC_API_MODE = previousMode
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
      else process.env.NEXT_PUBLIC_API_URL = previousUrl
    }
    expect((await getAgentStudio("local", "agt_cedar")).draft.model.temperature).toBe(0.3)
  })
})

describe("agent studio screen", () => {
  it("exposes the studio sections and labels the simulation", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AgentDetailScreen agentId="agt_cedar" />)
    expect(await screen.findByRole("tab", { name: "Knowledge" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Traces" })).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Knowledge" }))
    expect(await screen.findByText(/Simulated studio configuration/)).toBeInTheDocument()
    expect(screen.getByLabelText("Knowledge base")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Tools" }))
    expect((await screen.findAllByText(/Read-only/)).length).toBeGreaterThan(0)
    expect(screen.getByText(/Credentials are not collected or stored/)).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Configuration" }))
    expect(await screen.findByText(/enforcement belongs to the agent runtime/i)).toBeInTheDocument()
    expect(screen.getByText(/No conversation or long-term memory is persisted/)).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Overview" }))
    expect(await screen.findByRole("heading", { name: "Test console" })).toBeInTheDocument()
    expect(screen.getByLabelText("User input")).toBeInTheDocument()
    expect(screen.getByLabelText("Agent version")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Run simulation" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Run simulation" }))
    expect(await screen.findByText(/Simulated agent test/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Stop" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Simulation stopped. No further steps were applied.")
    expect(screen.queryByText(/Simulated agent test/)).not.toBeInTheDocument()
    expect(await screen.findByRole("region", { name: "Test history" })).toBeInTheDocument()
  })
})

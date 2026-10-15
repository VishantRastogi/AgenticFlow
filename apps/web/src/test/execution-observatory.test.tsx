import { beforeEach, describe, expect, it } from "vitest"
import { screen, within } from "@testing-library/react"
import { testAgentStudio } from "@/features/agents/studio-api"
import { getExecution, getExecutionLogs, getExecutionModels, getExecutionRetrievals, getExecutionTools, getExecutionTrace, listExecutions, retryExecution, cancelExecution } from "@/features/executions/api"
import { layoutSpans, redactRecord, spansAreTimed, structuredLog } from "@/features/executions/observatory"
import { projectExecution } from "@/features/executions/project"
import { ExecutionsScreen } from "@/features/executions/executions-screen"
import { listAgents, listExecutions as listStoredExecutions } from "@/mocks/operations-store"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"
import { addNode, blankWorkflowGraph, connectNodes } from "@/features/workflows/graph"
import { createWorkflow, startWorkflowExecution } from "@/features/workflows/api"
import { renderWithProviders } from "@/test/render"

function linked(kind: "llm" | "tool" | "rag" | "output") {
  const graph = addNode(blankWorkflowGraph(), kind, { x: 200, y: 40 })
  const output = addNode(graph.graph, "output", { x: 460, y: 40 })
  const first = connectNodes(output.graph, { source: "node_1", target: graph.node.id })
  if (!("graph" in first)) throw new Error(first.error)
  const second = connectNodes(first.graph, { source: graph.node.id, target: output.node.id })
  if (!("graph" in second)) throw new Error(second.error)
  return second.graph
}

const listQuery = { q: "", agent: "all", environment: "all" as const, status: "all" as const, range: "all" as const, sort: "newest" as const, page: 1 }

describe("execution observatory", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("lists each agent and workflow run once and keeps missing versions unknown", async () => {
    const tested = await testAgentStudio("agt_cedar", { workspaceId: "local", version: "draft", input: "Hello observatory" })
    const workflow = await createWorkflow({ name: "Observed lane", description: "", graph: linked("llm") })
    const started = await startWorkflowExecution(workflow.workflow.id, { workspaceId: "local", version: "draft" })
    const listed = await listExecutions(listQuery, "local")
    expect(listed.executions.filter((execution) => execution.id === tested.requestId)).toHaveLength(1)
    expect(listed.executions.filter((execution) => execution.id === started.id)).toHaveLength(1)
    expect(listed.executions.find((execution) => execution.id === tested.requestId)?.traceId).toBe(tested.traceId)
    expect(listed.executions.find((execution) => execution.id === started.id)?.versionLabel).toBe("draft")

    const historical = listStoredExecutions().find((execution) => execution.agentVersion === undefined)
    expect(historical).toBeTruthy()
    const agent = listAgents().find((item) => item.id === historical?.agentId)
    const projected = projectExecution({
      record: historical!,
      agentName: agent?.name ?? "Agent",
      agentStatus: "idle",
      retryPolicy: "fixed",
      asOf: SIMULATED_NOW,
    })
    expect(projected.versionLabel).toBeNull()
    renderWithProviders(<ExecutionsScreen />)
    const row = await screen.findByRole("link", { name: historical!.id })
    expect(within(row.closest("tr") as HTMLElement).getByText("Unknown")).toBeInTheDocument()

    const other = await listExecutions(listQuery, "other")
    expect(other.executions).toHaveLength(0)
    await expect(getExecution(historical!.id, "other")).rejects.toMatchObject({
      status: 404,
      message: "This execution is not in the history.",
    })
    await expect(getExecution("exe_missing", "local")).rejects.toMatchObject({
      status: 404,
      message: "This execution is not in the history.",
    })
  })

  it("builds a timed trace tree and redacts sensitive log details", async () => {
    const spans = layoutSpans({
      traceId: "trc_demo",
      executionId: "exe_demo",
      startedAt: SIMULATED_NOW,
      simulated: true,
      root: { operationName: "workflow.execute", serviceName: "nodejs-job-service", status: "ok" },
      children: [
        { operationName: "llm", serviceName: "python-llm-gateway", durationMs: 15, status: "ok" },
        { operationName: "tool", serviceName: "python-agent-runtime", durationMs: 8, status: "ok" },
      ],
    })
    expect(spans[0]?.parentSpanId).toBeNull()
    expect(spans[1]?.parentSpanId).toBe(spans[0]?.spanId)
    expect(spansAreTimed(spans)).toBe(true)
    expect(spans.every((span) => span.simulated && span.attributes.telemetry === "simulated")).toBe(true)

    expect(redactRecord({ password: "hunter2", nested: { apiKey: "sk-test" }, note: "token=abc" })).toEqual({
      password: "[redacted]",
      nested: { apiKey: "[redacted]" },
      note: "token=[redacted]",
    })
    expect(structuredLog({
      id: "log_1",
      timestamp: SIMULATED_NOW,
      severity: "info",
      serviceName: "python-agent-runtime",
      traceId: "trc_demo",
      spanId: "span_1",
      message: "step",
      details: { password: "hunter2" },
    }).details.password).toBe("[redacted]")

    const workflow = await createWorkflow({ name: "Trace lane", description: "", graph: linked("llm") })
    const started = await startWorkflowExecution(workflow.workflow.id, { workspaceId: "local", version: "draft" })
    const trace = await getExecutionTrace(started.id)
    expect(trace.trace.traceId).toBe(started.traceId)
    expect(trace.trace.spans.every((span) => span.attributes.executionId === started.id)).toBe(true)
    expect(spansAreTimed(trace.trace.spans)).toBe(true)
    const models = await getExecutionModels(started.id)
    const spanIds = new Set(trace.trace.spans.map((span) => span.spanId))
    expect(models.models.length).toBeGreaterThan(0)
    expect(models.models.every((call) => spanIds.has(call.spanId) && call.timeToFirstTokenMs === null)).toBe(true)
    const tools = await getExecutionTools(started.id)
    expect(tools.tools).toEqual([])
    const retrievals = await getExecutionRetrievals(started.id)
    expect(retrievals.retrievals.every((item) => item.rerankDurationMs === null && item.embeddingDurationMs === null)).toBe(true)
    const errorLogs = await getExecutionLogs(started.id, { severity: "error", q: "" })
    expect(errorLogs.logs.every((log) => log.severity === "error")).toBe(true)
  })

  it("retries into a new attempt and cancels without continuing", async () => {
    const graph = linked("tool")
    graph.nodes = graph.nodes.map((node) => (node.type === "tool" ? { ...node, data: { ...node.data, inputMapping: "fail-once", retries: 0 } } : node))
    const workflow = await createWorkflow({ name: "Retry observatory", description: "", graph })
    const failed = await startWorkflowExecution(workflow.workflow.id, { workspaceId: "local", version: "draft" })
    expect(failed.status).toBe("failed")
    const retried = await retryExecution(failed.id)
    expect(retried.execution.id).not.toBe(failed.id)
    expect(retried.execution.retryOf).toBe(failed.id)
    const listed = await listExecutions(listQuery, "local")
    expect(listed.executions.filter((execution) => execution.id === failed.id || execution.id === retried.execution.id)).toHaveLength(2)

    const approvalGraph = addNode(blankWorkflowGraph(), "human_approval", { x: 200, y: 40 })
    const approved = addNode(approvalGraph.graph, "output", { x: 460, y: 0 })
    const rejected = addNode(approved.graph, "output", { x: 460, y: 160 })
    const toGate = connectNodes(rejected.graph, { source: "node_1", target: approvalGraph.node.id })
    if (!("graph" in toGate)) throw new Error(toGate.error)
    const yes = connectNodes(toGate.graph, { source: approvalGraph.node.id, target: approved.node.id, sourceHandle: "approve" })
    if (!("graph" in yes)) throw new Error(yes.error)
    const finished = connectNodes(yes.graph, { source: approvalGraph.node.id, target: rejected.node.id, sourceHandle: "reject" })
    if (!("graph" in finished)) throw new Error(finished.error)
    const approval = await createWorkflow({ name: "Cancel observatory", description: "", graph: finished.graph })
    const waiting = await startWorkflowExecution(approval.workflow.id, { workspaceId: "local", version: "draft" })
    const cancelled = await cancelExecution(waiting.id)
    expect(cancelled.execution.status).toBe("cancelled")
    const again = await cancelExecution(waiting.id)
    expect(again.execution.status).toBe("cancelled")
    expect(again.execution.id).toBe(waiting.id)
    await expect(retryExecution("exe_run_atlas")).rejects.toMatchObject({ status: 409 })
  })

  it("fails closed for observatory reads in real mode", async () => {
    const previousMode = process.env.NEXT_PUBLIC_API_MODE
    const previousUrl = process.env.NEXT_PUBLIC_API_URL
    process.env.NEXT_PUBLIC_API_MODE = "real"
    delete process.env.NEXT_PUBLIC_API_URL
    try {
      await expect(getExecutionTrace("exe_queue_birch")).rejects.toMatchObject({
        code: "api_unavailable",
        message: expect.stringContaining("Mock mode was not used"),
      })
    } finally {
      if (previousMode === undefined) delete process.env.NEXT_PUBLIC_API_MODE
      else process.env.NEXT_PUBLIC_API_MODE = previousMode
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
      else process.env.NEXT_PUBLIC_API_URL = previousUrl
    }
  })
})

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WorkflowEditor } from "@/features/workflows/components/workflow-editor"
import { WorkflowsScreen } from "@/features/workflows/components/workflows-list"
import { addNode, blankWorkflowGraph, connectNodes, connectionError, duplicateNode, removeNodes } from "@/features/workflows/graph"
import { createHistory, historyReducer } from "@/features/workflows/history"
import { queryWorkflows } from "@/features/workflows/query"
import { playbackFrames, planWorkflowRun } from "@/features/workflows/simulate"
import type { WorkflowGraph, WorkflowRecord } from "@/features/workflows/types"
import { validateWorkflow } from "@/features/workflows/validate"
import { workflowFixture } from "@/mocks/fixtures/workflows"
import { server } from "@/mocks/server"
import { renderWithProviders } from "@/test/render"

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/workflows",
}))

function chain(kinds: Array<WorkflowGraph["nodes"][number]["type"]>) {
  let graph = blankWorkflowGraph()
  let previous = graph.nodes[0].id
  for (const kind of kinds) {
    const added = addNode(graph, kind, { x: 200, y: 40 })
    graph = added.graph
    const connected = connectNodes(graph, { source: previous, target: added.node.id })
    if ("graph" in connected) graph = connected.graph
    previous = added.node.id
  }
  return graph
}

describe("workflow graph", () => {
  it("connects, duplicates, deletes, and undoes a single drag", () => {
    const output = addNode(blankWorkflowGraph(), "output", { x: 320, y: 180 })
    const connected = connectNodes(output.graph, { source: "node_1", target: output.node.id })
    expect("graph" in connected).toBe(true)
    if (!("graph" in connected)) return
    expect(connectionError(connected.graph, { source: output.node.id, target: "node_1" })).toMatch(/cannot start/)
    expect(connectionError(connected.graph, { source: "node_1", target: output.node.id })).toMatch(/already has a connection/)

    const copy = duplicateNode(connected.graph, output.node.id)
    expect(copy?.node.data.label).toBe("Output copy")
    const removed = removeNodes(copy?.graph ?? connected.graph, [output.node.id])
    expect(removed.nodes.map((node) => node.id)).not.toContain(output.node.id)
    expect(removed.edges).toHaveLength(0)

    let history = createHistory(blankWorkflowGraph())
    history = historyReducer(history, { type: "move", id: "node_1", position: { x: 10, y: 10 }, dragging: true })
    history = historyReducer(history, { type: "move", id: "node_1", position: { x: 40, y: 20 }, dragging: true })
    history = historyReducer(history, { type: "move", id: "node_1", position: { x: 48, y: 24 }, dragging: false })
    expect(history.present.nodes[0]?.position).toEqual({ x: 48, y: 24 })
    history = historyReducer(history, { type: "undo" })
    expect(history.present.nodes[0]?.position).toEqual({ x: 80, y: 180 })
    history = historyReducer(history, { type: "redo" })
    expect(history.present.nodes[0]?.position.x).toBe(48)
  })

  it("reports missing terminals, required fields, unreachable nodes, and invalid links", () => {
    expect(validateWorkflow(blankWorkflowGraph()).map((issue) => issue.code)).toContain("missing_output")

    const broken = addNode(blankWorkflowGraph(), "output", { x: 10, y: 10 })
    broken.graph.nodes[0] = { ...broken.graph.nodes[0], data: { label: "Trigger", event: "" } }
    const issues = validateWorkflow(broken.graph)
    expect(issues.some((issue) => issue.code === "required")).toBe(true)
    expect(issues.some((issue) => issue.code === "unreachable")).toBe(true)

    const cycle = connectNodes(broken.graph, { source: "node_1", target: broken.node.id })
    if (!("graph" in cycle)) throw new Error("expected a connection")
    cycle.graph.edges.push({ id: "edge_back", source: broken.node.id, target: "node_1" })
    expect(validateWorkflow(cycle.graph).some((issue) => issue.message.includes("cycle") || issue.message.includes("output cannot"))).toBe(true)
  })

  it("plans a deterministic path and stops when a node fails", () => {
    const graph = chain(["api", "output"])
    const plan = planWorkflowRun(graph)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.steps.map((step) => step.outcome)).toEqual(["succeeded", "succeeded", "succeeded"])
    const frames = playbackFrames(graph, plan.steps)
    expect(frames[0]?.nodeStatus[graph.nodes[0].id]).toBe("running")
    expect(frames.at(-1)?.nodeStatus[graph.nodes.at(-1)?.id ?? ""]).toBe("succeeded")

    const failing = chain(["api", "output"])
    const api = failing.nodes.find((node) => node.type === "api")
    if (!api) throw new Error("missing api")
    api.data.url = "https://fail.agentflow.test/hook"
    const failed = planWorkflowRun(failing)
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.steps.map((step) => step.outcome)).toEqual(["succeeded", "failed"])
    expect(failed.steps.some((step) => failing.nodes.find((node) => node.id === step.nodeId)?.type === "output")).toBe(false)
  })

  it("follows the false branch when a condition expression is false", () => {
    let graph = blankWorkflowGraph()
    const condition = addNode(graph, "condition", { x: 200, y: 40 })
    graph = condition.graph
    graph.nodes = graph.nodes.map((node) => (node.id === condition.node.id ? { ...node, data: { ...node.data, expression: "false" } } : node))
    const linked = connectNodes(graph, { source: "node_1", target: condition.node.id })
    if (!("graph" in linked)) throw new Error("expected a connection")
    graph = linked.graph
    const yes = addNode(graph, "output", { x: 400, y: 0 })
    graph = yes.graph
    const no = addNode(graph, "output", { x: 400, y: 160 })
    graph = no.graph
    const trueEdge = connectNodes(graph, { source: condition.node.id, target: yes.node.id, sourceHandle: "true" })
    if (!("graph" in trueEdge)) throw new Error("expected true path")
    const falseEdge = connectNodes(trueEdge.graph, { source: condition.node.id, target: no.node.id, sourceHandle: "false" })
    if (!("graph" in falseEdge)) throw new Error("expected false path")
    const plan = planWorkflowRun(falseEdge.graph)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.steps.map((step) => step.nodeId)).toEqual(["node_1", condition.node.id, no.node.id])
  })

  it("filters the catalog by status and page", () => {
    const extra: WorkflowRecord[] = Array.from({ length: 6 }, (_, index) => ({
      ...workflowFixture[0],
      id: `wf_extra_${index}`,
      name: `Extra ${index}`,
      status: "draft" as const,
    }))
    const page = queryWorkflows([...workflowFixture, ...extra], { q: "", status: "draft", page: 2 })
    expect(page.total).toBe(7)
    expect(page.workflows).toHaveLength(1)
    expect(queryWorkflows(workflowFixture, { q: "release", status: "all", page: 1 }).workflows.map((item) => item.name)).toEqual(["Release gate"])
  })
})

describe("workflow studio", () => {
  beforeEach(() => {
    navigation.push.mockReset()
    navigation.replace.mockReset()
  })

  it("filters the workflow list", async () => {
    const user = userEvent.setup()
    renderWithProviders(<WorkflowsScreen />)
    expect(await screen.findByRole("link", { name: "Release gate" })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("Status"), "draft")
    expect(await screen.findByRole("link", { name: "Draft intake" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Release gate" })).not.toBeInTheDocument()
  })

  it("publishes a draft and plays a simulated run", async () => {
    const user = userEvent.setup()
    renderWithProviders(<WorkflowEditor workflowId="wf_draft_intake" />)
    expect(await screen.findByLabelText("Workflow name")).toHaveValue("Draft intake")
    expect(screen.getByRole("button", { name: /Browser Action/ })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Publish" }))
    expect(await screen.findByText(/Published version 2/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Test run" }))
    expect(await screen.findByText("Test run succeeded.")).toBeInTheDocument()
  })

  it("keeps a saved workflow after the catalog is read again", async () => {
    const created = await fetch("http://localhost:3000/api/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Nightly check",
        description: "A persisted draft.",
        graph: chain(["output"]),
      }),
    })
    expect(created.status).toBe(201)
    const body = (await created.json()) as { workflow: { id: string } }
    const listed = await fetch("http://localhost:3000/api/workflows?q=nightly&status=all&page=1")
    const list = (await listed.json()) as { workflows: { id: string }[] }
    expect(list.workflows.map((workflow) => workflow.id)).toContain(body.workflow.id)

    const blocked = await fetch("http://localhost:3000/api/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Broken", description: "", graph: blankWorkflowGraph() }),
    })
    const broken = (await blocked.json()) as { workflow: { id: string } }
    const published = await fetch(`http://localhost:3000/api/workflows/${broken.workflow.id}/publish`, { method: "POST" })
    expect(published.status).toBe(400)
  })

  it("shows a network failure and retries the catalog", async () => {
    const user = userEvent.setup()
    server.use(http.get("*/api/workflows", () => HttpResponse.error()))
    renderWithProviders(<WorkflowsScreen />)
    expect(await screen.findByRole("alert")).toHaveTextContent("The workflow service could not be reached.")
    server.resetHandlers()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Release gate" })).toBeInTheDocument()
    })
  })
})

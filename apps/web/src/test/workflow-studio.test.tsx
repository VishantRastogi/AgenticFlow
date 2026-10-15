import { beforeEach, describe, expect, it } from "vitest"
import { publishAgentStudio } from "@/features/agents/studio-api"
import { addNode, blankWorkflowGraph, connectNodes, connectionError } from "@/features/workflows/graph"
import {
  getWorkflow,
  getWorkflowStudio,
  listWorkflowExecutions,
  publishWorkflowSnapshot,
  rollbackWorkflowSnapshot,
  startWorkflowExecution,
  updateWorkflow,
  createWorkflow,
  decideWorkflowApproval,
  cancelWorkflowExecution,
} from "@/features/workflows/api"
import { validateWorkflow } from "@/features/workflows/validate"
import type { WorkflowGraph, WorkflowNodeKind } from "@/features/workflows/types"

function chain(kinds: WorkflowNodeKind[], patch?: (graph: WorkflowGraph) => void) {
  let graph = blankWorkflowGraph()
  let previous = graph.nodes[0].id
  for (const kind of kinds) {
    const added = addNode(graph, kind, { x: 240, y: 40 })
    graph = added.graph
    const connected = connectNodes(graph, { source: previous, target: added.node.id })
    if (!("graph" in connected)) throw new Error(connected.error)
    graph = connected.graph
    previous = added.node.id
  }
  patch?.(graph)
  return graph
}

describe("workflow studio", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("validates configuration, ports, references, and cycles", async () => {
    const llm = addNode(blankWorkflowGraph(), "llm", { x: 200, y: 40 })
    llm.graph.nodes = llm.graph.nodes.map((node) => (node.type === "llm" ? { ...node, data: { ...node.data, promptTemplate: "short" } } : node))
    const output = addNode(llm.graph, "output", { x: 420, y: 40 })
    const linked = connectNodes(output.graph, { source: "node_1", target: llm.node.id })
    if (!("graph" in linked)) throw new Error(linked.error)
    const finished = connectNodes(linked.graph, { source: llm.node.id, target: output.node.id })
    if (!("graph" in finished)) throw new Error(finished.error)
    expect(validateWorkflow(finished.graph).some((issue) => issue.message.includes("prompt template"))).toBe(true)

    const ingestion = addNode(blankWorkflowGraph(), "ingestion", { x: 200, y: 40 })
    expect(connectionError(ingestion.graph, { source: "node_1", target: ingestion.node.id })).toMatch(/cannot accept/)

    const rag = chain(["rag", "output"])
    rag.nodes = rag.nodes.map((node) => (node.type === "rag" ? { ...node, data: { ...node.data, knowledgeBaseId: "kb_missing" } } : node))
    const created = await createWorkflow({ name: "Broken retrieval", description: "", graph: rag })
    await expect(publishWorkflowSnapshot(created.workflow.id, {
      workspaceId: "local",
      version: "1.0.0",
      note: "Should not publish.",
    })).rejects.toMatchObject({ message: expect.stringMatching(/knowledge base/i) })

    const agent = chain(["agent_execution", "output"])
    agent.nodes = agent.nodes.map((node) =>
      node.type === "agent_execution" ? { ...node, data: { ...node.data, agentId: "agt_cedar", agentVersion: "9.9.9" } } : node,
    )
    const agentWorkflow = await createWorkflow({ name: "Broken agent", description: "", graph: agent })
    await expect(publishWorkflowSnapshot(agentWorkflow.workflow.id, {
      workspaceId: "local",
      version: "1.0.0",
      note: "Should not publish.",
    })).rejects.toMatchObject({ message: expect.stringMatching(/unpublished agent version/) })

    const loop = chain(["llm", "output"])
    loop.edges.push({ id: "edge_back", source: loop.nodes.at(-1)?.id ?? "", target: loop.nodes[1]?.id ?? "" })
    expect(validateWorkflow(loop).some((issue) => issue.message.includes("cycle") || issue.message.includes("output cannot"))).toBe(true)
  })

  it("publishes immutable snapshots per workspace and restores node ids", async () => {
    const graph = chain(["llm", "output"])
    const created = await createWorkflow({ name: "Snapshot lane", description: "A draft.", graph })
    const published = await publishWorkflowSnapshot(created.workflow.id, {
      workspaceId: "local",
      version: "1.2.0",
      note: "Publish the canvas.",
    })
    const ids = published.versions[0]?.graph.nodes.map((node) => node.id) ?? []
    expect(published.versions[0]?.immutable).toBe(true)
    await expect(publishWorkflowSnapshot(created.workflow.id, {
      workspaceId: "local",
      version: "1.2.0",
      note: "Publish the canvas.",
    })).rejects.toMatchObject({ status: 409 })

    const other = await publishWorkflowSnapshot(created.workflow.id, {
      workspaceId: "other",
      version: "1.2.0",
      note: "Other workspace snapshot.",
    })
    expect(other.versions).toHaveLength(1)

    const edited = structuredClone(graph)
    const llm = edited.nodes.find((node) => node.type === "llm")
    if (!llm) throw new Error("missing llm")
    llm.data = { ...llm.data, label: "Renamed generation" }
    edited.nodes.push({ id: "node_extra", type: "delay", position: { x: 10, y: 10 }, data: { label: "Delay", durationMs: 1000 } })
    await updateWorkflow(created.workflow.id, { graph: edited })
    const stored = await getWorkflowStudio("local", created.workflow.id)
    expect(stored.versions[0]?.graph.nodes.map((node) => node.id)).toEqual(ids)
    expect(stored.versions[0]?.graph.nodes.some((node) => node.data.label === "Renamed generation")).toBe(false)
    expect((await getWorkflowStudio("local", created.workflow.id)).versions[0]?.graph.nodes).toHaveLength(ids.length)
    expect((await getWorkflowStudio("other", created.workflow.id)).versions[0]?.graph.nodes).toHaveLength(ids.length)

    const restored = await rollbackWorkflowSnapshot(created.workflow.id, { workspaceId: "local", version: "1.2.0" })
    expect(restored.versions[0]?.graph.nodes.map((node) => node.id)).toEqual(ids)
    expect((await getWorkflow(created.workflow.id)).workflow.graph.nodes.map((node) => node.id)).toEqual(ids)

    const pinned = await startWorkflowExecution(created.workflow.id, { workspaceId: "local", version: "1.2.0" })
    expect(pinned.workflowVersion).toBe("1.2.0")
    expect(pinned.nodes.map((node) => node.nodeId)).not.toContain("node_extra")
    expect(pinned.notice).toMatch(/Simulated workflow/)
  })

  it("branches, pauses for approval, cancels, retries, and keeps history", async () => {
    let graph = blankWorkflowGraph()
    const gate = addNode(graph, "human_approval", { x: 240, y: 40 })
    graph = gate.graph
    const linked = connectNodes(graph, { source: "node_1", target: gate.node.id })
    if (!("graph" in linked)) throw new Error(linked.error)
    graph = linked.graph
    const approved = addNode(graph, "output", { x: 480, y: 0 })
    graph = approved.graph
    approved.node.data = { ...approved.node.data, label: "Approved output" }
    graph.nodes = graph.nodes.map((node) => (node.id === approved.node.id ? approved.node : node))
    const rejected = addNode(graph, "output", { x: 480, y: 180 })
    graph = rejected.graph
    const yes = connectNodes(graph, { source: gate.node.id, target: approved.node.id, sourceHandle: "approve" })
    if (!("graph" in yes)) throw new Error(yes.error)
    const no = connectNodes(yes.graph, { source: gate.node.id, target: rejected.node.id, sourceHandle: "reject" })
    if (!("graph" in no)) throw new Error(no.error)
    const approval = await createWorkflow({ name: "Approval lane", description: "", graph: no.graph })
    const waiting = await startWorkflowExecution(approval.workflow.id, { workspaceId: "local", version: "draft" })
    expect(waiting.status).toBe("waiting_for_approval")
    expect(waiting.timeline).toEqual(["queued", "running", "waiting_for_approval"])
    expect(waiting.nodes.some((node) => node.nodeId === approved.node.id)).toBe(false)

    const cancelled = await cancelWorkflowExecution(approval.workflow.id, waiting.id, "local")
    expect(cancelled.status).toBe("cancelled")
    expect(cancelled.nodes.some((node) => node.nodeId === approved.node.id)).toBe(false)
    await expect(decideWorkflowApproval(approval.workflow.id, waiting.id, {
      workspaceId: "local",
      decision: "approve",
      role: "owner",
    })).rejects.toMatchObject({ status: 404 })

    const again = await startWorkflowExecution(approval.workflow.id, { workspaceId: "local", version: "draft" })
    await expect(decideWorkflowApproval(approval.workflow.id, again.id, {
      workspaceId: "local",
      decision: "approve",
      role: "viewer",
    })).rejects.toMatchObject({ message: "This role cannot approve the step." })
    const decided = await decideWorkflowApproval(approval.workflow.id, again.id, {
      workspaceId: "local",
      decision: "reject",
      role: "owner",
    })
    expect(decided.status).toBe("completed")
    expect(decided.nodes.some((node) => node.nodeId === rejected.node.id && node.status === "completed")).toBe(true)
    expect(decided.nodes.some((node) => node.nodeId === approved.node.id)).toBe(false)

    const toolGraph = chain(["tool", "output"])
    toolGraph.nodes = toolGraph.nodes.map((node) =>
      node.type === "tool" ? { ...node, data: { ...node.data, inputMapping: "fail-once", retries: 1, retryPolicy: "fixed" } } : node,
    )
    const toolWorkflow = await createWorkflow({ name: "Retry lane", description: "", graph: toolGraph })
    const retried = await startWorkflowExecution(toolWorkflow.workflow.id, { workspaceId: "local", version: "draft" })
    expect(retried.nodes.find((node) => node.detail.includes("Retried"))?.attempt).toBe(2)

    const once = chain(["tool", "output"])
    once.nodes = once.nodes.map((node) => (node.type === "tool" ? { ...node, data: { ...node.data, inputMapping: "fail-once", retries: 0 } } : node))
    const failedWorkflow = await createWorkflow({ name: "Fail lane", description: "", graph: once })
    const failed = await startWorkflowExecution(failedWorkflow.workflow.id, { workspaceId: "local", version: "draft" })
    expect(failed.status).toBe("failed")
    expect(failed.nodes.some((node) => failedWorkflow.workflow.graph.nodes.find((item) => item.id === node.nodeId)?.type === "output")).toBe(false)

    const history = await listWorkflowExecutions("local", approval.workflow.id)
    expect(history.executions.length).toBeGreaterThan(0)
    expect(history.executions[0]?.traceId).toMatch(/^trc_wf_/)
    expect((await listWorkflowExecutions("other", approval.workflow.id)).executions).toHaveLength(0)
  })

  it("selects the structured error branch and a published agent version", async () => {
    await publishAgentStudio("agt_cedar", { workspaceId: "local", version: "4.0.0", note: "Publish the agent." })
    let graph = blankWorkflowGraph()
    const generation = addNode(graph, "llm", { x: 220, y: 40 })
    graph = generation.graph
    graph.nodes = graph.nodes.map((node) =>
      node.id === generation.node.id ? { ...node, data: { ...node.data, promptTemplate: "Return invalid json now." } } : node,
    )
    const check = addNode(graph, "structured_output", { x: 460, y: 40 })
    graph = check.graph
    const valid = addNode(graph, "output", { x: 700, y: 0 })
    graph = valid.graph
    const invalid = addNode(graph, "output", { x: 700, y: 180 })
    graph = invalid.graph
    for (const connection of [
      { source: "node_1", target: generation.node.id },
      { source: generation.node.id, target: check.node.id },
      { source: check.node.id, target: valid.node.id, sourceHandle: "valid" },
      { source: check.node.id, target: invalid.node.id, sourceHandle: "error" },
    ]) {
      const next = connectNodes(graph, connection)
      if (!("graph" in next)) throw new Error(next.error)
      graph = next.graph
    }
    const created = await createWorkflow({ name: "Schema lane", description: "", graph })
    const branched = await startWorkflowExecution(created.workflow.id, { workspaceId: "local", version: "draft" })
    expect(branched.nodes.some((node) => node.nodeId === invalid.node.id)).toBe(true)
    expect(branched.nodes.some((node) => node.nodeId === valid.node.id)).toBe(false)

    const agentGraph = chain(["agent_execution", "output"])
    agentGraph.nodes = agentGraph.nodes.map((node) =>
      node.type === "agent_execution"
        ? { ...node, data: { ...node.data, agentId: "agt_cedar", agentVersion: "4.0.0", executionLimit: 2 } }
        : node,
    )
    const agentWorkflow = await createWorkflow({ name: "Agent lane", description: "", graph: agentGraph })
    const published = await publishWorkflowSnapshot(agentWorkflow.workflow.id, {
      workspaceId: "local",
      version: "2.0.0",
      note: "Publish with the agent.",
    })
    expect(published.publishedVersion).toBe("2.0.0")
    const run = await startWorkflowExecution(agentWorkflow.workflow.id, { workspaceId: "local", version: "2.0.0" })
    expect(run.nodes.some((node) => node.detail.includes("agt_cedar"))).toBe(true)
  })
})

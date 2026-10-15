"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import {
  cancelWorkflowExecution,
  decideWorkflowApproval,
  getWorkflowStudio,
  listWorkflowExecutions,
  publishWorkflowSnapshot,
  rollbackWorkflowSnapshot,
  startWorkflowExecution,
} from "@/features/workflows/api"
import type { WorkflowExecutionRecord } from "@/features/workflows/studio-types"
import type { WorkflowGraph as Graph } from "@/features/workflows/types"
import { localWorkspace } from "@/lib/workspace"

export function compareWorkflowGraphs(left: Graph, right: Graph) {
  const changes: string[] = []
  const ids = new Set([...left.nodes.map((node) => node.id), ...right.nodes.map((node) => node.id)])
  for (const id of ids) {
    const before = left.nodes.find((node) => node.id === id)
    const after = right.nodes.find((node) => node.id === id)
    if (!before) changes.push(`Node ${id} was added.`)
    else if (!after) changes.push(`Node ${id} was removed.`)
    else if (before.type !== after.type) changes.push(`Node ${id} changed from ${before.type} to ${after.type}.`)
    else if (JSON.stringify(before.data) !== JSON.stringify(after.data)) changes.push(`Node ${id} configuration differs.`)
  }
  return changes.length > 0 ? changes : ["No workflow differences."]
}

export function WorkflowStudioPanel({ workflowId, graph }: { workflowId: string; graph: Graph }) {
  const client = useQueryClient()
  const studio = useQuery({
    queryKey: ["workflows", workflowId, "studio", localWorkspace.id],
    queryFn: () => getWorkflowStudio(localWorkspace.id, workflowId),
  })
  const history = useQuery({
    queryKey: ["workflows", workflowId, "executions", localWorkspace.id],
    queryFn: () => listWorkflowExecutions(localWorkspace.id, workflowId),
  })
  const publish = useMutation({
    mutationFn: (input: { version: string; note: string }) =>
      publishWorkflowSnapshot(workflowId, { ...input, workspaceId: localWorkspace.id }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["workflows", workflowId, "studio"] }),
  })
  const rollback = useMutation({
    mutationFn: (version: string) => rollbackWorkflowSnapshot(workflowId, { workspaceId: localWorkspace.id, version }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["workflows"] }),
  })
  const [version, setVersion] = useState("1.0.0")
  const [note, setNote] = useState("Publish the current draft.")
  const [confirm, setConfirm] = useState(false)
  const [runVersion, setRunVersion] = useState("draft")
  const [execution, setExecution] = useState<WorkflowExecutionRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState("draft")
  const [right, setRight] = useState(studio.data?.versions[0]?.version ?? "draft")
  const versions = studio.data?.versions ?? []
  const leftGraph = left === "draft" ? graph : versions.find((item) => item.version === left)?.graph
  const rightGraph = right === "draft" ? graph : versions.find((item) => item.version === right)?.graph
  const changes = leftGraph && rightGraph ? compareWorkflowGraphs(leftGraph, rightGraph) : []

  async function run() {
    setError(null)
    try {
      const next = await startWorkflowExecution(workflowId, { workspaceId: localWorkspace.id, version: runVersion })
      setExecution(next)
      await client.invalidateQueries({ queryKey: ["workflows", workflowId, "executions"] })
    } catch (reason) {
      setError(isApiError(reason) ? reason.message : "The workflow service could not be reached.")
    }
  }

  return (
    <section className="grid gap-3 border-t border-border pt-4" aria-label="Workflow versions">
      <h3 className="text-sm font-medium">Snapshots</h3>
      <p className="text-xs text-muted-foreground">Published snapshots stay immutable. Enforcement of tools and models belongs to the runtime. This simulation does not call them.</p>
      <p className="text-sm">Published snapshot: {studio.data?.publishedVersion ?? "None"}</p>
      <label className="grid gap-1 text-sm" htmlFor="workflow-snapshot-version">
        Snapshot version
        <input id="workflow-snapshot-version" className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={version} onChange={(event) => setVersion(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm" htmlFor="workflow-snapshot-note">
        Publish note
        <input id="workflow-snapshot-note" className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {confirm ? <p role="alert">Publish snapshot {version}? It cannot be edited afterward.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          if (!confirm) {
            setConfirm(true)
            return
          }
          void publish.mutateAsync({ version, note }).then(() => {
            setConfirm(false)
            setError(null)
          }).catch((reason: unknown) => setError(isApiError(reason) ? reason.message : "The workflow service could not be reached."))
        }}
      >
        {confirm ? "Confirm snapshot" : "Publish snapshot"}
      </Button>
      <div className="grid gap-2">
        <label className="grid gap-1 text-sm">
          Compare from
          <select aria-label="Compare from" className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={left} onChange={(event) => setLeft(event.target.value)}>
            <option value="draft">Draft</option>
            {versions.map((item) => <option key={item.version} value={item.version}>{item.version}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Compare with
          <select aria-label="Compare with" className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={right} onChange={(event) => setRight(event.target.value)}>
            <option value="draft">Draft</option>
            {versions.map((item) => <option key={item.version} value={item.version}>{item.version}</option>)}
          </select>
        </label>
        <ul aria-label="Workflow differences">
          {changes.map((change) => <li key={change} className="text-xs">{change}</li>)}
        </ul>
      </div>
      <ul className="grid gap-2">
        {versions.map((item) => (
          <li key={item.version} className="text-sm">
            <span className="font-mono">{item.version}</span>
            <Button type="button" variant="outline" onClick={() => void rollback.mutateAsync(item.version)}>
              Restore draft from {item.version}
            </Button>
          </li>
        ))}
      </ul>
      <h3 className="text-sm font-medium">Execution simulation</h3>
      <label className="grid gap-1 text-sm">
        Workflow version
        <select aria-label="Workflow version" className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={runVersion} onChange={(event) => setRunVersion(event.target.value)}>
          <option value="draft">Draft</option>
          {versions.map((item) => <option key={item.version} value={item.version}>{item.version}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void run()}>Run simulation</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!execution || execution.status === "completed" || execution.status === "failed" || execution.status === "cancelled") {
              setExecution(null)
              return
            }
            void cancelWorkflowExecution(workflowId, execution.id, localWorkspace.id).then((next) => {
              setExecution(next)
              return client.invalidateQueries({ queryKey: ["workflows", workflowId, "executions"] })
            })
          }}
        >
          Stop
        </Button>
        {execution?.status === "waiting_for_approval" ? (
          <>
            <Button type="button" onClick={() => void decide("approve")}>Approve</Button>
            <Button type="button" variant="outline" onClick={() => void decide("reject")}>Reject</Button>
          </>
        ) : null}
      </div>
      {execution ? (
        <div className="grid gap-1 text-sm" aria-live="polite">
          <p>{execution.notice}</p>
          <p>Status {execution.status}. Trace {execution.traceId}. Tokens {execution.totalTokens}. Cost ${execution.estimatedCostUsd.toFixed(6)}.</p>
          <ol aria-label="Execution timeline">
            {execution.nodes.map((node) => (
              <li key={`${node.nodeId}-${node.status}`}>{node.nodeId} · {node.status} · attempt {node.attempt} · {node.detail}</li>
            ))}
          </ol>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{history.data?.executions.length ?? 0} simulated executions in this workspace.</p>
    </section>
  )

  function decide(decision: "approve" | "reject") {
    if (!execution?.pendingApproval) return
    void decideWorkflowApproval(workflowId, execution.id, {
      workspaceId: localWorkspace.id,
      decision,
      role: execution.pendingApproval.role,
    }).then((next) => {
      setExecution(next)
      return client.invalidateQueries({ queryKey: ["workflows", workflowId, "executions"] })
    }).catch((reason: unknown) => setError(isApiError(reason) ? reason.message : "The workflow service could not be reached."))
  }
}

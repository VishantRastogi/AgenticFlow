"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ReactFlowProvider, type Connection, type EdgeChange, type NodeChange } from "@xyflow/react"
import { useReducedMotion } from "framer-motion"
import { Redo2, Undo2 } from "lucide-react"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { ListSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/features/auth/api/errors"
import { addNode, blankWorkflowGraph, connectNodes, disconnectEdge, duplicateNode } from "@/features/workflows/graph"
import { createHistory, historyReducer } from "@/features/workflows/history"
import { createWorkflow, publishWorkflow, startWorkflowRun, updateWorkflow } from "@/features/workflows/api"
import { useDeleteWorkflow, useWorkflow, workflowKeys } from "@/features/workflows/hooks"
import { playbackFrames } from "@/features/workflows/simulate"
import { validateWorkflow } from "@/features/workflows/validate"
import { WorkflowCanvas } from "@/features/workflows/components/workflow-canvas"
import { WorkflowInspector } from "@/features/workflows/components/workflow-inspector"
import { WorkflowPalette } from "@/features/workflows/components/workflow-palette"
import type { FlowNode } from "@/features/workflows/components/workflow-node"
import type { PlaybackFrame, WorkflowGraph, WorkflowNodeData, WorkflowNodeKind, WorkflowStatus } from "@/features/workflows/types"

const emptyFrame: PlaybackFrame = { nodeStatus: {}, activeEdgeId: null, litEdgeIds: [] }

export function WorkflowEditor({ workflowId }: { workflowId?: string }) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorBody workflowId={workflowId} />
    </ReactFlowProvider>
  )
}

function WorkflowEditorBody({ workflowId }: { workflowId?: string }) {
  const router = useRouter()
  const client = useQueryClient()
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  const existing = useWorkflow(workflowId ?? null)
  const remove = useDeleteWorkflow(workflowId ?? "")
  const [history, dispatch] = useReducer(historyReducer, blankWorkflowGraph(), createHistory)
  const [name, setName] = useState("Untitled workflow")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<WorkflowStatus>("draft")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectorEpoch, setInspectorEpoch] = useState(0)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved")
  const [frame, setFrame] = useState<PlaybackFrame>(emptyFrame)
  const [announcement, setAnnouncement] = useState("Workflow ready.")
  const [playing, setPlaying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const loadedId = useRef<string | null>(workflowId ? null : "new")
  const idRef = useRef(workflowId ?? "")
  const creating = useRef<Promise<string> | null>(null)
  const playback = useRef<{ kill: () => void } | null>(null)
  const signatureRef = useRef("")
  const savedSignature = useRef(workflowId ? "" : JSON.stringify({ name: "Untitled workflow", description: "", graph: blankWorkflowGraph() }))

  const graph = history.present
  const issues = useMemo(() => validateWorkflow(graph), [graph])
  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null
  const signature = JSON.stringify({ name, description, graph })

  useEffect(() => {
    signatureRef.current = signature
  }, [signature])

  useEffect(() => {
    const record = existing.data?.workflow
    if (!record || loadedId.current === record.id) return
    loadedId.current = record.id
    idRef.current = record.id
    dispatch({ type: "reset", graph: record.graph })
    setName(record.name)
    setDescription(record.description)
    setStatus(record.status)
    const nextSignature = JSON.stringify({ name: record.name, description: record.description, graph: record.graph })
    signatureRef.current = nextSignature
    savedSignature.current = nextSignature
    setSaveState("saved")
  }, [existing.data])

  const persist = useCallback(
    async (payloadSignature: string) => {
      const payload = JSON.parse(payloadSignature) as { name: string; description: string; graph: WorkflowGraph }
      if (payload.name.trim().length < 2) {
        setSaveState("error")
        setAnnouncement("Enter a workflow name.")
        return null
      }
      setSaveState("saving")
      try {
        let id = idRef.current
        if (!id) {
          if (!creating.current) {
            creating.current = createWorkflow(payload)
              .then((result) => {
                idRef.current = result.workflow.id
                router.replace(`/workflows/${result.workflow.id}/edit`)
                return result.workflow.id
              })
              .catch((error: unknown) => {
                creating.current = null
                throw error
              })
          }
          id = await creating.current
        } else {
          const result = await updateWorkflow(id, payload)
          setStatus(result.workflow.status)
        }
        await client.invalidateQueries({ queryKey: workflowKeys.all })
        if (signatureRef.current === payloadSignature) {
          savedSignature.current = payloadSignature
          setSaveState("saved")
        } else {
          setSaveState("unsaved")
        }
        return id
      } catch (error) {
        setSaveState("error")
        setAnnouncement(isApiError(error) ? error.message : "The workflow could not be saved.")
        return null
      }
    },
    [client, router],
  )

  useEffect(() => {
    if (!loadedId.current) return
    if (signature === savedSignature.current) return
    setSaveState("unsaved")
    const timer = window.setTimeout(() => {
      void persist(signature)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [persist, signature])

  useEffect(() => {
    if (!history.editing) return
    const timer = window.setTimeout(() => dispatch({ type: "edit-end" }), 500)
    return () => window.clearTimeout(timer)
  }, [graph, history.editing])

  const onNodeChange = useCallback((id: string, data: WorkflowNodeData) => {
    dispatch({ type: "edit", id, data })
  }, [])

  function add(kind: WorkflowNodeKind, position = { x: 240 + graph.nodes.length * 28, y: 140 }) {
    const result = addNode(graph, kind, position)
    dispatch({ type: "commit", graph: result.graph })
    setSelectedId(result.node.id)
    setInspectorOpen(true)
    setPaletteOpen(false)
  }

  function onNodesChange(changes: NodeChange<FlowNode>[]) {
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        dispatch({ type: "move", id: change.id, position: change.position, dragging: change.dragging === true })
      }
    }
    const removed = changes.filter((change) => change.type === "remove").map((change) => change.id)
    if (removed.length > 0) {
      dispatch({ type: "remove", ids: removed })
      setSelectedId((current) => (current && removed.includes(current) ? null : current))
    }
  }

  function onEdgesChange(changes: EdgeChange[]) {
    let next = graph
    let changed = false
    for (const change of changes) {
      if (change.type === "remove") {
        next = disconnectEdge(next, change.id)
        changed = true
      }
    }
    if (changed) dispatch({ type: "commit", graph: next })
  }

  function onConnect(connection: Connection) {
    if (!connection.source || !connection.target) return
    const result = connectNodes(graph, {
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
    })
    if ("graph" in result) dispatch({ type: "commit", graph: result.graph })
  }

  async function publishCurrent() {
    if (issues.length > 0) {
      setInspectorOpen(true)
      setAnnouncement(issues[0]?.message ?? "This workflow is not ready to publish.")
      return
    }
    const id = await persist(signatureRef.current)
    if (!id) return
    try {
      const result = await publishWorkflow(id)
      await client.invalidateQueries({ queryKey: workflowKeys.all })
      setStatus(result.workflow.status)
      setAnnouncement(`Published version ${result.workflow.version}.`)
    } catch (error) {
      setAnnouncement(isApiError(error) ? error.message : "The workflow could not be published.")
    }
  }

  async function testRun() {
    if (issues.length > 0) {
      setInspectorOpen(true)
      setAnnouncement(issues[0]?.message ?? "Fix the workflow before running it.")
      return
    }
    const id = await persist(signatureRef.current)
    if (!id) return
    setPlaying(true)
    playback.current?.kill()
    try {
      const result = await startWorkflowRun(id)
      const frames = playbackFrames(graph, result.run.steps)
      if (frames.length === 0) {
        setPlaying(false)
        return
      }
      if (reduced) {
        applyFrame(frames[frames.length - 1], graph, true)
        setPlaying(false)
        return
      }
      const gsap = (await import("gsap")).default
      const timeline = gsap.timeline({ onComplete: () => setPlaying(false) })
      frames.forEach((item, index) => {
        timeline.call(() => applyFrame(item, graph, index === frames.length - 1), [], index * 0.4)
      })
      playback.current = timeline
    } catch (error) {
      setPlaying(false)
      setAnnouncement(isApiError(error) ? error.message : "The test run could not start.")
    }
  }

  function applyFrame(next: PlaybackFrame, source: WorkflowGraph, final: boolean) {
    setFrame(next)
    const running = source.nodes.find((node) => next.nodeStatus[node.id] === "running")
    const failed = source.nodes.find((node) => next.nodeStatus[node.id] === "failed")
    if (running) setAnnouncement(`${running.data.label} is running.`)
    else if (final && failed) setAnnouncement(`Test run failed at ${failed.data.label}.`)
    else if (final) setAnnouncement("Test run succeeded.")
  }

  useEffect(() => () => playback.current?.kill(), [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable)
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void persist(signatureRef.current)
        return
      }
      if (typing) return
      if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault()
        dispatch({ type: "undo" })
        setInspectorEpoch((value) => value + 1)
      } else if (mod && ((event.key.toLowerCase() === "z" && event.shiftKey) || event.key.toLowerCase() === "y")) {
        event.preventDefault()
        dispatch({ type: "redo" })
        setInspectorEpoch((value) => value + 1)
      } else if (mod && event.key.toLowerCase() === "d" && selectedId) {
        event.preventDefault()
        const result = duplicateNode(graph, selectedId)
        if (!result) return
        dispatch({ type: "commit", graph: result.graph })
        setSelectedId(result.node.id)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [graph, persist, selectedId])

  if (workflowId && existing.isPending) {
    return (
      <div aria-busy="true" className="p-6">
        <span className="sr-only">Loading workflow</span>
        <ListSkeleton rows={6} />
      </div>
    )
  }

  if (workflowId && existing.isError) {
    const message = isApiError(existing.error) ? existing.error.message : "The workflow service could not be reached."
    return <ErrorState title="Workflow unavailable" description={message} onRetry={() => void existing.refetch()} />
  }

  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : saveState === "unsaved" ? "Unsaved changes" : "All changes saved"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Link href="/workflows" className="text-xs font-medium tracking-wide text-highlight uppercase">
          Workflows
        </Link>
        <h1 className="sr-only">{name}</h1>
        <Input aria-label="Workflow name" value={name} onChange={(event) => setName(event.target.value)} className="h-9 max-w-64 min-w-40" />
        <StatusBadge tone={status === "published" ? "success" : "neutral"}>{status === "published" ? "Published" : "Draft"}</StatusBadge>
        <p role="status" className="text-xs text-muted-foreground">
          {saveLabel}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="icon" aria-label="Undo" disabled={history.past.length === 0} onClick={() => dispatch({ type: "undo" })}>
            <Undo2 aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label="Redo" disabled={history.future.length === 0} onClick={() => dispatch({ type: "redo" })}>
            <Redo2 aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" className="lg:hidden" onClick={() => setPaletteOpen((open) => !open)}>
            Nodes
          </Button>
          <Button type="button" variant="outline" className="lg:hidden" onClick={() => setInspectorOpen((open) => !open)}>
            Properties
          </Button>
          <Button type="button" variant="outline" onClick={() => void testRun()} disabled={playing}>
            {playing ? "Running" : "Test run"}
          </Button>
          {status === "published" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!idRef.current) return
                void updateWorkflow(idRef.current, { status: "draft" }).then(async (result) => {
                  await client.invalidateQueries({ queryKey: workflowKeys.all })
                  setStatus(result.workflow.status)
                  setAnnouncement("Moved back to draft.")
                })
              }}
            >
              Move to draft
            </Button>
          ) : (
            <Button type="button" onClick={() => void publishCurrent()}>
              Publish
            </Button>
          )}
          {workflowId ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : null}
        </div>
      </header>
      <p className="sr-only" role="status">
        {announcement}
      </p>
      <div className="flex min-h-0 flex-1">
        <aside className={`${paletteOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"} z-20 w-60 shrink-0 overflow-y-auto border-r border-border bg-background max-lg:absolute max-lg:top-0 max-lg:bottom-0 max-lg:left-0 lg:static`}>
          <WorkflowPalette onAdd={(kind) => add(kind)} />
        </aside>
        <div className="relative min-h-0 min-w-0 flex-1">
          <WorkflowCanvas
            graph={graph}
            selectedId={selectedId}
            nodeStatus={frame.nodeStatus}
            activeEdgeId={frame.activeEdgeId}
            litEdgeIds={frame.litEdgeIds}
            reduced={reduced}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelect={(id) => {
              setSelectedId(id)
              if (id) setInspectorOpen(true)
            }}
            onAdd={(kind, position) => add(kind, position)}
          />
        </div>
        <aside
          className={`${inspectorOpen ? "max-lg:translate-y-0" : "max-lg:translate-y-full"} z-20 w-full shrink-0 overflow-hidden border-border bg-background max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[70dvh] max-lg:rounded-t-2xl max-lg:border-t lg:static lg:w-80 lg:translate-y-0 lg:border-l`}
        >
          <WorkflowInspector
            node={selected}
            description={description}
            issues={issues}
            epoch={inspectorEpoch}
            onDescription={setDescription}
            onNodeChange={onNodeChange}
            onSelect={(id) => {
              setSelectedId(id)
              setInspectorOpen(true)
            }}
          />
        </aside>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${name}`}
        description="The workflow leaves this browser catalog."
        confirmLabel="Delete workflow"
        destructive
        onConfirm={() => {
          if (!workflowId) return
          void remove.mutateAsync().then(() => router.push("/workflows"))
        }}
      />
    </div>
  )
}

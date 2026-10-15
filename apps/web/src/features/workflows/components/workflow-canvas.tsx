"use client"

import { useCallback, useMemo } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useTheme } from "next-themes"
import { connectionError } from "@/features/workflows/graph"
import { FlowNode, WorkflowNodeView, WorkflowRunContext } from "@/features/workflows/components/workflow-node"
import { workflowNodeKinds } from "@/features/workflows/types"
import { isNodeKind } from "@/features/workflows/components/workflow-palette"
import type { NodeRunStatus, WorkflowGraph, WorkflowNodeKind } from "@/features/workflows/types"

const nodeTypes = Object.fromEntries(workflowNodeKinds.map((kind) => [kind, WorkflowNodeView]))

export function WorkflowCanvas({
  graph,
  selectedId,
  nodeStatus,
  activeEdgeId,
  litEdgeIds,
  reduced,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelect,
  onAdd,
}: {
  graph: WorkflowGraph
  selectedId: string | null
  nodeStatus: Record<string, NodeRunStatus>
  activeEdgeId: string | null
  litEdgeIds: string[]
  reduced: boolean
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  onSelect: (id: string | null) => void
  onAdd: (kind: WorkflowNodeKind, position: { x: number; y: number }) => void
}) {
  const { resolvedTheme } = useTheme()
  const { screenToFlowPosition } = useReactFlow()
  const nodes = useMemo<FlowNode[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        selected: node.id === selectedId,
      })),
    [graph.nodes, selectedId],
  )
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => {
        const lit = litEdgeIds.includes(edge.id) || edge.id === activeEdgeId
        const failed = nodeStatus[edge.target] === "failed"
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          type: "smoothstep",
          animated: !reduced && (lit || edge.id === activeEdgeId),
          style: { stroke: failed ? "var(--destructive)" : lit ? "var(--highlight)" : undefined },
        }
      }),
    [activeEdgeId, graph.edges, litEdgeIds, nodeStatus, reduced],
  )

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target) return false
      return connectionError(graph, { source: connection.source, target: connection.target, sourceHandle: connection.sourceHandle }) === null
    },
    [graph],
  )

  return (
    <WorkflowRunContext.Provider value={{ status: nodeStatus, reduced }}>
      <ReactFlow
        className="agentflow-canvas h-full w-full"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        isValidConnection={isValidConnection}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        fitView
        minZoom={0.3}
        maxZoom={1.75}
        panOnScroll
        selectionOnDrag={false}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "move"
        }}
        onDrop={(event) => {
          event.preventDefault()
          const kind = event.dataTransfer.getData("application/agentflow-node")
          if (!isNodeKind(kind)) return
          onAdd(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
        }}
      >
        <Background variant={BackgroundVariant.Lines} gap={24} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-card" />
      </ReactFlow>
    </WorkflowRunContext.Provider>
  )
}

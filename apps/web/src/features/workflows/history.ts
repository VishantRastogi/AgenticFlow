import { moveNode, removeNodes, updateNodeData } from "@/features/workflows/graph"
import type { WorkflowGraph, WorkflowNodeData } from "@/features/workflows/types"

export type HistoryState = {
  present: WorkflowGraph
  past: WorkflowGraph[]
  future: WorkflowGraph[]
  dragging: boolean
  editing: boolean
}

type HistoryAction =
  | { type: "reset"; graph: WorkflowGraph }
  | { type: "commit"; graph: WorkflowGraph }
  | { type: "move"; id: string; position: { x: number; y: number }; dragging: boolean }
  | { type: "remove"; ids: string[] }
  | { type: "edit"; id: string; data: WorkflowNodeData }
  | { type: "edit-end" }
  | { type: "undo" }
  | { type: "redo" }

const HISTORY_LIMIT = 50

export function createHistory(graph: WorkflowGraph): HistoryState {
  return { present: graph, past: [], future: [], dragging: false, editing: false }
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "reset":
      return createHistory(action.graph)
    case "commit":
      return push(state, action.graph)
    case "move": {
      const next = moveNode(state.present, action.id, action.position)
      if (sameGraph(state.present, next)) return state
      if (action.dragging) {
        return state.dragging ? { ...state, present: next } : { ...push(state, next), dragging: true }
      }
      if (state.dragging) return { ...state, present: next, dragging: false }
      return push(state, next)
    }
    case "remove":
      return push(state, removeNodes(state.present, action.ids))
    case "edit": {
      const next = updateNodeData(state.present, action.id, action.data)
      if (sameGraph(state.present, next)) return state
      if (state.editing) return { ...state, present: next }
      return { ...push(state, next), editing: true }
    }
    case "edit-end":
      return { ...state, editing: false }
    case "undo": {
      const previous = state.past[state.past.length - 1]
      if (!previous) return state
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
        dragging: false,
        editing: false,
      }
    }
    case "redo": {
      const next = state.future[0]
      if (!next) return state
      return {
        present: next,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        dragging: false,
        editing: false,
      }
    }
    default:
      return state
  }
}

function push(state: HistoryState, graph: WorkflowGraph): HistoryState {
  if (sameGraph(state.present, graph)) return { ...state, dragging: false }
  return {
    present: graph,
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    future: [],
    dragging: false,
    editing: false,
  }
}

function sameGraph(left: WorkflowGraph, right: WorkflowGraph) {
  return JSON.stringify(left) === JSON.stringify(right)
}

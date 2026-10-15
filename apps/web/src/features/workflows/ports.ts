import type { WorkflowNodeKind } from "@/features/workflows/types"

export type WorkflowPortType = "text" | "json" | "document" | "embedding" | "retrieval" | "tool_result" | "agent_result"

const legacy = new Set<WorkflowNodeKind>(["trigger", "browser", "api", "model", "condition", "delay", "approval", "output"])

export function isLegacyNode(kind: WorkflowNodeKind) {
  return legacy.has(kind)
}

export function branchHandles(kind: WorkflowNodeKind): readonly string[] | null {
  if (kind === "condition") return ["true", "false"]
  if (kind === "human_approval") return ["approve", "reject"]
  if (kind === "structured_output") return ["valid", "error"]
  return null
}

export function branchPrompt(kind: WorkflowNodeKind) {
  if (kind === "human_approval") return "Choose the approve or reject path."
  if (kind === "structured_output") return "Choose the valid or error path."
  return "Choose the true or false path."
}

export function outputType(kind: WorkflowNodeKind): WorkflowPortType {
  if (kind === "api" || kind === "structured_output") return "json"
  if (kind === "rag") return "retrieval"
  if (kind === "ingestion") return "document"
  if (kind === "embedding") return "embedding"
  if (kind === "tool") return "tool_result"
  if (kind === "agent_execution") return "agent_result"
  return "text"
}

export function inputType(kind: WorkflowNodeKind): WorkflowPortType | "any" {
  if (kind === "output") return "any"
  if (kind === "ingestion") return "document"
  if (kind === "tool" || kind === "structured_output") return "json"
  return "text"
}

export function portsCompatible(produced: WorkflowPortType, accepted: WorkflowPortType | "any") {
  if (accepted === "any" || produced === accepted) return true
  if (accepted === "text" && ["json", "retrieval", "tool_result", "agent_result", "embedding"].includes(produced)) return true
  if (accepted === "json" && ["text", "retrieval", "tool_result", "agent_result"].includes(produced)) return true
  return false
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { listAgentTools, getAgentStudio } from "@/features/agents/studio-api"
import { listAgents } from "@/features/agents/api"
import { AGENT_PAGE_SIZE } from "@/features/agents/catalog"
import { listKnowledgeBases } from "@/features/knowledge/api"
import { KNOWLEDGE_PAGE_SIZE } from "@/features/knowledge/catalog"
import type { WorkflowNode, WorkflowNodeData, WorkflowNodeKind } from "@/features/workflows/types"
import { localWorkspace } from "@/lib/workspace"

const studioKinds = new Set<WorkflowNodeKind>(["llm", "rag", "ingestion", "embedding", "tool", "agent_execution", "human_approval", "structured_output"])
const controlClass = "min-h-11 w-full rounded-lg border border-input bg-background px-2.5 text-sm lg:min-h-8"

export function isStudioNode(kind: WorkflowNodeKind) {
  return studioKinds.has(kind)
}

export function StudioNodeFields({ node, onChange }: { node: WorkflowNode; onChange: (id: string, data: WorkflowNodeData) => void }) {
  const data = node.data
  const set = (patch: Partial<WorkflowNodeData>) => onChange(node.id, { ...data, ...patch })
  const bases = useQuery({
    queryKey: ["workflows", "knowledge-options", localWorkspace.id],
    queryFn: () => pageKnowledge(),
    enabled: node.type === "rag" || node.type === "ingestion",
  })
  const tools = useQuery({
    queryKey: ["workflows", "tool-options", localWorkspace.id],
    queryFn: () => listAgentTools(localWorkspace.id),
    enabled: node.type === "tool",
  })
  const agents = useQuery({
    queryKey: ["workflows", "agent-options"],
    queryFn: () => pageAgents(),
    enabled: node.type === "agent_execution",
  })
  const studio = useQuery({
    queryKey: ["workflows", "agent-version", localWorkspace.id, data.agentId ?? "none"],
    queryFn: () => getAgentStudio(localWorkspace.id, data.agentId ?? ""),
    enabled: node.type === "agent_execution" && Boolean(data.agentId),
  })
  const versions = studio.data?.versions ?? []

  return (
    <div className="grid gap-3">
      <Field label="Label">
        <input className={controlClass} aria-label="Label" value={data.label} onChange={(event) => set({ label: event.target.value })} />
      </Field>
      {node.type === "llm" ? (
        <>
          <Field label="Provider">
            <select className={controlClass} aria-label="Provider" value={data.provider ?? ""} onChange={(event) => set({ provider: event.target.value })}>
              <option value="agentflow-simulated">AgentFlow Simulated</option>
              <option value="northstar-simulated">Northstar Simulated</option>
            </select>
          </Field>
          <Field label="Model">
            <input className={controlClass} aria-label="Model" value={data.model ?? ""} onChange={(event) => set({ model: event.target.value })} />
          </Field>
          <Field label="Prompt template">
            <textarea className={controlClass} aria-label="Prompt template" value={data.promptTemplate ?? ""} onChange={(event) => set({ promptTemplate: event.target.value })} />
          </Field>
          <Field label="Temperature">
            <input className={controlClass} aria-label="Temperature" type="number" step="0.1" value={data.temperature ?? 0} onChange={(event) => set({ temperature: Number(event.target.value) })} />
          </Field>
          <Field label="Maximum output tokens">
            <input className={controlClass} aria-label="Maximum output tokens" type="number" value={data.maxOutputTokens ?? 0} onChange={(event) => set({ maxOutputTokens: Number(event.target.value) })} />
          </Field>
          <Field label="Structured output schema">
            <textarea className={controlClass} aria-label="Structured output schema" value={data.outputSchema ?? ""} onChange={(event) => set({ outputSchema: event.target.value })} />
          </Field>
          <Field label="Timeout (ms)">
            <input className={controlClass} aria-label="Timeout (ms)" type="number" value={data.timeoutMs ?? 0} onChange={(event) => set({ timeoutMs: Number(event.target.value) })} />
          </Field>
          <Field label="Budget (USD)">
            <input className={controlClass} aria-label="Budget (USD)" type="number" step="0.01" value={data.budgetUsd ?? 0} onChange={(event) => set({ budgetUsd: Number(event.target.value) })} />
          </Field>
        </>
      ) : null}
      {node.type === "rag" || node.type === "ingestion" ? (
        <Field label="Knowledge base">
          <select className={controlClass} aria-label="Knowledge base" value={data.knowledgeBaseId ?? ""} onChange={(event) => set({ knowledgeBaseId: event.target.value })}>
            <option value="">{bases.isPending ? "Loading knowledge bases" : "Select a knowledge base"}</option>
            {(bases.data ?? []).map((base) => (
              <option key={base.id} value={base.id}>{base.name}</option>
            ))}
          </select>
        </Field>
      ) : null}
      {node.type === "rag" ? (
        <>
          <Field label="Strategy">
            <select className={controlClass} aria-label="Strategy" value={data.strategy ?? "hybrid"} onChange={(event) => set({ strategy: event.target.value as WorkflowNodeData["strategy"] })}>
              <option value="vector">Vector</option>
              <option value="keyword">Keyword</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </Field>
          <Field label="Top K">
            <input className={controlClass} aria-label="Top K" type="number" value={data.topK ?? 4} onChange={(event) => set({ topK: Number(event.target.value) })} />
          </Field>
          <Field label="Score threshold">
            <input className={controlClass} aria-label="Score threshold" type="number" step="0.05" value={data.scoreThreshold ?? 0} onChange={(event) => set({ scoreThreshold: Number(event.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(data.rerank)} onChange={(event) => set({ rerank: event.target.checked })} />
            Rerank
          </label>
          <Field label="Context budget">
            <input className={controlClass} aria-label="Context budget" type="number" value={data.contextTokenBudget ?? 800} onChange={(event) => set({ contextTokenBudget: Number(event.target.value) })} />
          </Field>
        </>
      ) : null}
      {node.type === "ingestion" ? (
        <>
          <Field label="Document input">
            <input className={controlClass} aria-label="Document input" value={data.documentRef ?? ""} onChange={(event) => set({ documentRef: event.target.value })} />
          </Field>
          <Field label="Processing policy">
            <select className={controlClass} aria-label="Processing policy" value={data.processingPolicy ?? "parse"} onChange={(event) => set({ processingPolicy: event.target.value as WorkflowNodeData["processingPolicy"] })}>
              <option value="parse">Parse</option>
              <option value="parse_and_index">Parse and index</option>
            </select>
          </Field>
        </>
      ) : null}
      {node.type === "embedding" ? (
        <>
          <Field label="Embedding model">
            <select className={controlClass} aria-label="Embedding model" value={data.embeddingModel ?? "orbit-embed-small"} onChange={(event) => set({ embeddingModel: event.target.value })}>
              <option value="orbit-embed-small">Orbit Embed Small</option>
              <option value="orbit-embed-large">Orbit Embed Large</option>
            </select>
          </Field>
          <Field label="Text input">
            <input className={controlClass} aria-label="Text input" value={data.textInput ?? ""} onChange={(event) => set({ textInput: event.target.value })} />
          </Field>
          <Field label="Batch size">
            <input className={controlClass} aria-label="Batch size" type="number" value={data.batchSize ?? 1} onChange={(event) => set({ batchSize: Number(event.target.value) })} />
          </Field>
        </>
      ) : null}
      {node.type === "tool" ? (
        <>
          <Field label="Tool">
            <select className={controlClass} aria-label="Tool" value={data.toolId ?? ""} onChange={(event) => set({ toolId: event.target.value })}>
              <option value="">Select a tool</option>
              {(tools.data?.tools ?? []).map((tool) => (
                <option key={tool.id} value={tool.id}>{tool.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Input mapping">
            <input className={controlClass} aria-label="Input mapping" value={data.inputMapping ?? ""} onChange={(event) => set({ inputMapping: event.target.value })} />
          </Field>
          <Field label="Timeout (ms)">
            <input className={controlClass} aria-label="Timeout (ms)" type="number" value={data.timeoutMs ?? 0} onChange={(event) => set({ timeoutMs: Number(event.target.value) })} />
          </Field>
          <Field label="Retry policy">
            <select className={controlClass} aria-label="Retry policy" value={data.retryPolicy ?? "none"} onChange={(event) => set({ retryPolicy: event.target.value as WorkflowNodeData["retryPolicy"] })}>
              <option value="none">None</option>
              <option value="fixed">Fixed</option>
              <option value="exponential">Exponential</option>
            </select>
          </Field>
          <Field label="Retries">
            <input className={controlClass} aria-label="Retries" type="number" value={data.retries ?? 0} onChange={(event) => set({ retries: Number(event.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(data.requiresApproval)} onChange={(event) => set({ requiresApproval: event.target.checked })} />
            Requires approval
          </label>
        </>
      ) : null}
      {node.type === "agent_execution" ? (
        <>
          <Field label="Agent">
            <select className={controlClass} aria-label="Agent" value={data.agentId ?? ""} onChange={(event) => set({ agentId: event.target.value, agentVersion: "" })}>
              <option value="">Select an agent</option>
              {(agents.data ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Published version">
            <select className={controlClass} aria-label="Published version" value={data.agentVersion ?? ""} onChange={(event) => set({ agentVersion: event.target.value })}>
              <option value="">{versions.length === 0 ? "No published version" : "Select a published version"}</option>
              {versions.map((version) => (
                <option key={version.version} value={version.version}>{version.version}</option>
              ))}
            </select>
          </Field>
          <Field label="Input mapping">
            <input className={controlClass} aria-label="Input mapping" value={data.inputMapping ?? ""} onChange={(event) => set({ inputMapping: event.target.value })} />
          </Field>
          <Field label="Execution limit">
            <input className={controlClass} aria-label="Execution limit" type="number" value={data.executionLimit ?? 1} onChange={(event) => set({ executionLimit: Number(event.target.value) })} />
          </Field>
        </>
      ) : null}
      {node.type === "human_approval" ? (
        <>
          <Field label="Approver role">
            <input className={controlClass} aria-label="Approver role" value={data.approverRole ?? ""} onChange={(event) => set({ approverRole: event.target.value })} />
          </Field>
          <Field label="Approval message">
            <textarea className={controlClass} aria-label="Approval message" value={data.approvalMessage ?? ""} onChange={(event) => set({ approvalMessage: event.target.value })} />
          </Field>
          <Field label="Timeout (ms)">
            <input className={controlClass} aria-label="Timeout (ms)" type="number" value={data.timeoutMs ?? 0} onChange={(event) => set({ timeoutMs: Number(event.target.value) })} />
          </Field>
          <p className="text-xs text-muted-foreground">Connect the approve and reject branches. Simulation pauses until a matching role decides.</p>
        </>
      ) : null}
      {node.type === "structured_output" ? (
        <>
          <Field label="JSON schema">
            <textarea className={controlClass} aria-label="JSON schema" value={data.outputSchema ?? ""} onChange={(event) => set({ outputSchema: event.target.value })} />
          </Field>
          <Field label="Failure policy">
            <select className={controlClass} aria-label="Failure policy" value={data.failurePolicy ?? "branch"} onChange={(event) => set({ failurePolicy: event.target.value as WorkflowNodeData["failurePolicy"] })}>
              <option value="branch">Error branch</option>
              <option value="fail">Fail the run</option>
            </select>
          </Field>
        </>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}

async function pageKnowledge() {
  const first = await listKnowledgeBases({ workspaceId: localWorkspace.id, q: "", status: "all", model: "all", sort: "name", page: 1 })
  const pages = Math.max(1, Math.ceil(first.total / KNOWLEDGE_PAGE_SIZE))
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      listKnowledgeBases({ workspaceId: localWorkspace.id, q: "", status: "all", model: "all", sort: "name", page: index + 2 }),
    ),
  )
  return [first, ...rest].flatMap((page) => page.items)
}

async function pageAgents() {
  const first = await listAgents({ q: "", status: "all", environment: "all", type: "all", sort: "name", page: 1 })
  const pages = Math.max(1, Math.ceil(first.total / AGENT_PAGE_SIZE))
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      listAgents({ q: "", status: "all", environment: "all", type: "all", sort: "name", page: index + 2 }),
    ),
  )
  return [first, ...rest].flatMap((page) => page.agents)
}

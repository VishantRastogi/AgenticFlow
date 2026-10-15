"use client"

import { useRef, useState } from "react"
import { JSONSchemaEditor, KnowledgeBaseSelector } from "@/components/ai/studio"
import { CostIndicator, TokenUsageBadge } from "@/components/ai/model-controls"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import { useAgentStudio, useAgentTestRuns, useAgentTools, usePublishAgentStudio, useRollbackAgentStudio, useSaveAgentStudio, useTestAgentStudio } from "@/features/agents/hooks"
import { agentModel, modelsForProvider } from "@/features/agents/studio-catalog"
import type { AgentConfiguration, AgentKnowledgeBinding, AgentModelProvider, AgentTestResponse, AgentToolCallingMode } from "@/features/agents/studio-types"
import { assessAgentConfiguration, compareConfigurations } from "@/features/agents/studio-validate"
import { listKnowledgeBases } from "@/features/knowledge/api"
import { KNOWLEDGE_PAGE_SIZE } from "@/features/knowledge/catalog"
import { useQuery } from "@tanstack/react-query"
import { localWorkspace } from "@/lib/workspace"

const fieldClass = "h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm font-normal"

function useBases() {
  return useQuery({
    queryKey: ["agents", "knowledge-options", localWorkspace.id],
    queryFn: async () => {
      const first = await listKnowledgeBases({ workspaceId: localWorkspace.id, q: "", status: "all", model: "all", sort: "name", page: 1 })
      const pages = Math.max(1, Math.ceil(first.total / KNOWLEDGE_PAGE_SIZE))
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, index) =>
          listKnowledgeBases({ workspaceId: localWorkspace.id, q: "", status: "all", model: "all", sort: "name", page: index + 2 }),
        ),
      )
      return [first, ...rest].flatMap((page) => page.items)
    },
  })
}

export function AgentStudioPanel({ agentId, section }: { agentId: string; section: "configuration" | "knowledge" | "tools" | "versions" | "test" }) {
  const studio = useAgentStudio(agentId)
  const save = useSaveAgentStudio(agentId)
  const [draft, setDraft] = useState<AgentConfiguration | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const configuration = draft ?? studio.data?.draft ?? null

  const update = (next: AgentConfiguration) => {
    setNotice(null)
    setDraft(next)
  }

  const persist = async () => {
    if (!configuration) return
    const assessed = assessAgentConfiguration(configuration)
    if (!assessed.ok) {
      setError(assessed.message)
      return
    }
    setError(null)
    try {
      await save.mutateAsync(assessed.configuration)
      setDraft(null)
      setNotice("Draft saved. Published versions were not changed.")
    } catch (reason) {
      setError(isApiError(reason) ? reason.message : "The agent service could not be reached.")
    }
  }

  if (studio.isPending || !configuration || !studio.data) return <p role="status">Loading agent studio</p>
  if (studio.isError) {
    return <p role="alert">{isApiError(studio.error) ? studio.error.message : "The agent service could not be reached."}</p>
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Simulated studio configuration for this workspace. Guardrails, memory, and tool permissions are contracts. Enforcement belongs to the agent runtime.
      </p>
      {studio.data.warnings.map((warning) => (
        <p key={warning} role="status" className="text-sm text-amber-700 dark:text-amber-300">
          {warning}
        </p>
      ))}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {section === "configuration" ? <ModelFields configuration={configuration} onChange={update} /> : null}
      {section === "knowledge" ? <KnowledgeFields configuration={configuration} onChange={update} /> : null}
      {section === "tools" ? <ToolFields configuration={configuration} onChange={update} /> : null}
      {section === "versions" ? (
        <VersionFields
          agentId={agentId}
          configuration={configuration}
          versions={studio.data.versions}
          publishedVersion={studio.data.publishedVersion}
          onDraft={(next) => {
            setDraft(next)
            setNotice("Draft replaced from the selected version. The published snapshot was not edited.")
          }}
          onError={setError}
          onNotice={setNotice}
        />
      ) : null}
      {section === "test" ? <TestConsole agentId={agentId} published={studio.data.versions.map((item) => item.version)} /> : null}
      {section !== "test" && section !== "versions" ? (
        <Button type="button" onClick={() => void persist()} disabled={save.isPending}>
          {save.isPending ? "Saving draft" : "Save draft"}
        </Button>
      ) : null}
    </div>
  )
}

function ModelFields({ configuration, onChange }: { configuration: AgentConfiguration; onChange: (next: AgentConfiguration) => void }) {
  const model = agentModel(configuration.model.model)
  const setModel = (patch: Partial<AgentConfiguration["model"]>) => onChange({ ...configuration, model: { ...configuration.model, ...patch } })
  const setPolicy = (patch: Partial<AgentConfiguration["execution"]>) =>
    onChange({ ...configuration, execution: { ...configuration.execution, ...patch } })
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium">
        Provider
        <select
          aria-label="Model provider"
          value={configuration.model.provider}
          className={fieldClass}
          onChange={(event) => {
            const provider = event.target.value as AgentModelProvider
            const next = modelsForProvider(provider)[0]
            setModel({ provider, model: next?.id ?? configuration.model.model, toolCalling: next?.toolCalling[0] ?? "none", structuredOutput: false })
          }}
        >
          <option value="agentflow-simulated">AgentFlow Simulated</option>
          <option value="northstar-simulated">Northstar Simulated</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Model
        <select aria-label="Studio model" value={configuration.model.model} className={fieldClass} onChange={(event) => setModel({ model: event.target.value })}>
          {modelsForProvider(configuration.model.provider).map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium lg:col-span-2" htmlFor="agent-system-prompt">
        System prompt
        <textarea
          id="agent-system-prompt"
          value={configuration.model.systemPrompt}
          onChange={(event) => setModel({ systemPrompt: event.target.value })}
          className="min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm font-normal"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="agent-temperature">
        Temperature
        <input id="agent-temperature" type="number" step="0.1" value={configuration.model.temperature} className={fieldClass} onChange={(event) => setModel({ temperature: Number(event.target.value) })} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="agent-max-tokens">
        Maximum output tokens
        <input id="agent-max-tokens" type="number" value={configuration.model.maxOutputTokens} className={fieldClass} onChange={(event) => setModel({ maxOutputTokens: Number(event.target.value) })} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Tool calling
        <select
          aria-label="Tool calling mode"
          value={configuration.model.toolCalling}
          className={fieldClass}
          onChange={(event) => setModel({ toolCalling: event.target.value as AgentToolCallingMode })}
        >
          {(model?.toolCalling ?? ["none"]).map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={configuration.model.structuredOutput}
          disabled={!model?.structuredOutput}
          onChange={(event) => setModel({ structuredOutput: event.target.checked, outputSchema: event.target.checked ? { type: "object" } : null })}
        />
        Structured output {model?.structuredOutput ? "" : "(not offered by this model)"}
      </label>
      {configuration.model.structuredOutput ? (
        <div className="lg:col-span-2">
          <OutputSchemaField schema={configuration.model.outputSchema} onValid={(outputSchema) => setModel({ outputSchema })} />
        </div>
      ) : null}
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="agent-timeout">
        Timeout (ms)
        <input id="agent-timeout" type="number" value={configuration.execution.timeoutMs} className={fieldClass} onChange={(event) => setPolicy({ timeoutMs: Number(event.target.value) })} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="agent-duration">
        Maximum execution duration (ms)
        <input id="agent-duration" type="number" value={configuration.execution.maxDurationMs} className={fieldClass} onChange={(event) => setPolicy({ maxDurationMs: Number(event.target.value) })} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="agent-budget">
        Execution budget (USD)
        <input id="agent-budget" type="number" step="0.01" value={configuration.execution.budgetUsd} className={fieldClass} onChange={(event) => setPolicy({ budgetUsd: Number(event.target.value) })} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="agent-steps">
        Maximum agent steps
        <input id="agent-steps" type="number" value={configuration.execution.maxSteps} className={fieldClass} onChange={(event) => setPolicy({ maxSteps: Number(event.target.value) })} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="agent-tool-calls">
        Maximum tool calls
        <input id="agent-tool-calls" type="number" value={configuration.execution.maxToolCalls} className={fieldClass} onChange={(event) => setPolicy({ maxToolCalls: Number(event.target.value) })} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="agent-token-budget">
        Maximum token budget
        <input id="agent-token-budget" type="number" value={configuration.execution.maxTokenBudget} className={fieldClass} onChange={(event) => setPolicy({ maxTokenBudget: Number(event.target.value) })} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Retry policy
        <select aria-label="Execution retry policy" value={configuration.execution.retryPolicy} className={fieldClass} onChange={(event) => setPolicy({ retryPolicy: event.target.value as AgentConfiguration["execution"]["retryPolicy"] })}>
          <option value="none">None</option>
          <option value="fixed">Fixed</option>
          <option value="exponential">Exponential</option>
        </select>
      </label>
      <fieldset className="grid gap-2 lg:col-span-2">
        <legend className="text-sm font-medium">Memory</legend>
        <p className="text-xs text-muted-foreground">These settings are stored with the draft. No conversation or long-term memory is persisted.</p>
        <select
          aria-label="Memory mode"
          value={configuration.memory.mode}
          className={fieldClass}
          onChange={(event) => {
            const mode = event.target.value as AgentConfiguration["memory"]["mode"]
            onChange({ ...configuration, memory: { mode, retentionDays: mode === "stateless" ? 0 : configuration.memory.retentionDays || 7 } })
          }}
        >
          <option value="stateless">Stateless execution</option>
          <option value="conversation">Conversation history</option>
          <option value="short_term">Short-term memory</option>
          <option value="long_term">Long-term memory</option>
        </select>
        <label className="grid gap-1 text-sm" htmlFor="agent-retention">
          Retention days
          <input id="agent-retention" type="number" value={configuration.memory.retentionDays} className={fieldClass} onChange={(event) => onChange({ ...configuration, memory: { ...configuration.memory, retentionDays: Number(event.target.value) } })} />
        </label>
      </fieldset>
      <fieldset className="grid gap-2 lg:col-span-2">
        <legend className="text-sm font-medium">Guardrails</legend>
        <p className="text-xs text-muted-foreground">The studio records the policy. The backend runtime is responsible for enforcing it.</p>
        {(
          [
            ["validateInput", "Input validation"],
            ["validateOutput", "Output validation"],
            ["maskSensitiveData", "Sensitive data masking"],
            ["enforceToolPermissions", "Tool permission enforcement"],
            ["requireHumanApproval", "Human approval for sensitive actions"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={configuration.guardrails[key]}
              onChange={(event) => onChange({ ...configuration, guardrails: { ...configuration.guardrails, [key]: event.target.checked } })}
            />
            {label}
          </label>
        ))}
      </fieldset>
    </div>
  )
}

function OutputSchemaField({ schema, onValid }: { schema: Record<string, unknown> | null; onValid: (schema: Record<string, unknown>) => void }) {
  const [text, setText] = useState(JSON.stringify(schema ?? { type: "object" }, null, 2))
  return (
    <JSONSchemaEditor
      id="agent-output-schema"
      value={text}
      onChange={(value) => {
        setText(value)
        try {
          const parsed = JSON.parse(value) as unknown
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) onValid(parsed as Record<string, unknown>)
        } catch {
          // Keep the draft text until it parses. The save action rejects an incomplete schema.
        }
      }}
    />
  )
}

function KnowledgeFields({ configuration, onChange }: { configuration: AgentConfiguration; onChange: (next: AgentConfiguration) => void }) {
  const bases = useBases()
  const [selected, setSelected] = useState("")
  const attach = () => {
    if (!selected || configuration.knowledge.some((item) => item.knowledgeBaseId === selected)) return
    const binding: AgentKnowledgeBinding = {
      knowledgeBaseId: selected,
      strategy: "hybrid",
      topK: 4,
      scoreThreshold: 0.2,
      rerank: false,
      contextTokenBudget: 800,
      requireCitations: true,
    }
    onChange({ ...configuration, knowledge: [...configuration.knowledge, binding] })
  }
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <KnowledgeBaseSelector
          value={selected}
          loading={bases.isPending}
          options={(bases.data ?? []).map((base) => ({ id: base.id, name: base.name }))}
          onChange={setSelected}
        />
        <Button type="button" variant="outline" onClick={attach} disabled={!selected}>
          Attach knowledge base
        </Button>
      </div>
      {configuration.knowledge.length === 0 ? <p className="text-sm text-muted-foreground">No knowledge bases attached.</p> : null}
      {configuration.knowledge.map((binding) => (
        <fieldset key={binding.knowledgeBaseId} className="grid gap-3 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">{bases.data?.find((base) => base.id === binding.knowledgeBaseId)?.name ?? binding.knowledgeBaseId}</legend>
          <label className="grid gap-1 text-sm">
            Retrieval strategy
            <select
              aria-label={`Strategy for ${binding.knowledgeBaseId}`}
              value={binding.strategy}
              className={fieldClass}
              onChange={(event) =>
                onChange({
                  ...configuration,
                  knowledge: configuration.knowledge.map((item) =>
                    item.knowledgeBaseId === binding.knowledgeBaseId ? { ...item, strategy: event.target.value as AgentKnowledgeBinding["strategy"] } : item,
                  ),
                })
              }
            >
              <option value="vector">Vector</option>
              <option value="keyword">Keyword</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Top K
            <input aria-label={`Top K for ${binding.knowledgeBaseId}`} type="number" value={binding.topK} className={fieldClass} onChange={(event) => onChange({ ...configuration, knowledge: configuration.knowledge.map((item) => item.knowledgeBaseId === binding.knowledgeBaseId ? { ...item, topK: Number(event.target.value) } : item) })} />
          </label>
          <label className="grid gap-1 text-sm">
            Score threshold
            <input aria-label={`Threshold for ${binding.knowledgeBaseId}`} type="number" step="0.05" value={binding.scoreThreshold} className={fieldClass} onChange={(event) => onChange({ ...configuration, knowledge: configuration.knowledge.map((item) => item.knowledgeBaseId === binding.knowledgeBaseId ? { ...item, scoreThreshold: Number(event.target.value) } : item) })} />
          </label>
          <label className="grid gap-1 text-sm">
            Context token budget
            <input aria-label={`Context budget for ${binding.knowledgeBaseId}`} type="number" value={binding.contextTokenBudget} className={fieldClass} onChange={(event) => onChange({ ...configuration, knowledge: configuration.knowledge.map((item) => item.knowledgeBaseId === binding.knowledgeBaseId ? { ...item, contextTokenBudget: Number(event.target.value) } : item) })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={binding.rerank} onChange={(event) => onChange({ ...configuration, knowledge: configuration.knowledge.map((item) => item.knowledgeBaseId === binding.knowledgeBaseId ? { ...item, rerank: event.target.checked } : item) })} />
            Rerank
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={binding.requireCitations} onChange={(event) => onChange({ ...configuration, knowledge: configuration.knowledge.map((item) => item.knowledgeBaseId === binding.knowledgeBaseId ? { ...item, requireCitations: event.target.checked } : item) })} />
            Require source citations
          </label>
          <Button type="button" variant="ghost" onClick={() => onChange({ ...configuration, knowledge: configuration.knowledge.filter((item) => item.knowledgeBaseId !== binding.knowledgeBaseId) })}>
            Detach {binding.knowledgeBaseId}
          </Button>
        </fieldset>
      ))}
    </div>
  )
}

function ToolFields({ configuration, onChange }: { configuration: AgentConfiguration; onChange: (next: AgentConfiguration) => void }) {
  const catalog = useAgentTools()
  const known = new Set(configuration.tools.map((tool) => tool.id))
  const add = (id: string) => {
    const template = catalog.data?.tools.find((tool) => tool.id === id)
    if (!template || known.has(id)) return
    onChange({
      ...configuration,
      tools: [...configuration.tools, structuredClone(template)],
      guardrails: { ...configuration.guardrails, allowedToolIds: [...configuration.guardrails.allowedToolIds, id] },
    })
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Read-only tools stay inside the simulation. Side-effect tools are recorded only. Credentials are not collected or stored.</p>
      {(catalog.data?.tools ?? []).filter((tool) => !known.has(tool.id)).map((tool) => (
        <Button key={tool.id} type="button" variant="outline" onClick={() => add(tool.id)}>
          Add {tool.name}
        </Button>
      ))}
      {configuration.tools.map((tool) => (
        <fieldset key={tool.id} className="grid gap-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">{tool.name}</legend>
          <p className="text-xs text-muted-foreground">
            {tool.id} · {tool.permission === "read" ? "Read-only" : "External side effect"} · {tool.requiresApproval ? "Approval required" : "No approval"}
          </p>
          <p className="text-sm">{tool.description}</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tool.enabled}
              onChange={(event) => {
                const enabled = event.target.checked
                const allowed = new Set(configuration.guardrails.allowedToolIds)
                if (enabled) allowed.add(tool.id)
                onChange({
                  ...configuration,
                  tools: configuration.tools.map((item) => (item.id === tool.id ? { ...item, enabled } : item)),
                  guardrails: { ...configuration.guardrails, allowedToolIds: [...allowed] },
                })
              }}
            />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={configuration.guardrails.allowedToolIds.includes(tool.id)}
              onChange={(event) => {
                const allowed = event.target.checked
                  ? [...configuration.guardrails.allowedToolIds, tool.id]
                  : configuration.guardrails.allowedToolIds.filter((id) => id !== tool.id)
                onChange({ ...configuration, guardrails: { ...configuration.guardrails, allowedToolIds: allowed } })
              }}
            />
            Allowed
          </label>
        </fieldset>
      ))}
    </div>
  )
}

function VersionFields({
  agentId,
  configuration,
  versions,
  publishedVersion,
  onDraft,
  onError,
  onNotice,
}: {
  agentId: string
  configuration: AgentConfiguration
  versions: { version: string; note: string; configuration: AgentConfiguration; immutable: true }[]
  publishedVersion: string | null
  onDraft: (next: AgentConfiguration) => void
  onError: (message: string | null) => void
  onNotice: (message: string) => void
}) {
  const publish = usePublishAgentStudio(agentId)
  const rollback = useRollbackAgentStudio(agentId)
  const [version, setVersion] = useState("1.0.0")
  const [note, setNote] = useState("Publish the current draft.")
  const [confirm, setConfirm] = useState(false)
  const [left, setLeft] = useState("draft")
  const [right, setRight] = useState(versions[0]?.version ?? "draft")
  const leftConfig = left === "draft" ? configuration : versions.find((item) => item.version === left)?.configuration
  const rightConfig = right === "draft" ? configuration : versions.find((item) => item.version === right)?.configuration
  const changes = leftConfig && rightConfig ? compareConfigurations(leftConfig, rightConfig) : []
  return (
    <div className="grid gap-4">
      <p className="text-sm">Published version: {publishedVersion ?? "None"}. Published snapshots stay immutable.</p>
      <label className="grid gap-1 text-sm" htmlFor="publish-version">
        Version
        <input id="publish-version" value={version} onChange={(event) => setVersion(event.target.value)} className={fieldClass} />
      </label>
      <label className="grid gap-1 text-sm" htmlFor="publish-note">
        Publish note
        <input id="publish-note" value={note} onChange={(event) => setNote(event.target.value)} className={fieldClass} />
      </label>
      {confirm ? (
        <p role="alert">Publish {version}? The snapshot cannot be edited afterward.</p>
      ) : null}
      <Button
        type="button"
        onClick={() => {
          if (!confirm) {
            setConfirm(true)
            return
          }
          void publish.mutateAsync({ version, note }).then(() => {
            setConfirm(false)
            onError(null)
            onNotice(`Published ${version}.`)
          }).catch((reason: unknown) => onError(isApiError(reason) ? reason.message : "The agent service could not be reached."))
        }}
      >
        {confirm ? "Confirm publish" : "Publish version"}
      </Button>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Compare from
          <select aria-label="Compare from" value={left} className={fieldClass} onChange={(event) => setLeft(event.target.value)}>
            <option value="draft">Draft</option>
            {versions.map((item) => (
              <option key={item.version} value={item.version}>
                {item.version}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Compare with
          <select aria-label="Compare with" value={right} className={fieldClass} onChange={(event) => setRight(event.target.value)}>
            <option value="draft">Draft</option>
            {versions.map((item) => (
              <option key={item.version} value={item.version}>
                {item.version}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul aria-label="Version differences">
        {changes.map((change) => (
          <li key={change} className="text-sm">
            {change}
          </li>
        ))}
      </ul>
      <ul className="grid gap-2">
        {versions.map((item) => (
          <li key={item.version} className="rounded-lg border border-border px-3 py-2 text-sm">
            <p className="font-mono">{item.version}</p>
            <p>{item.note}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void rollback.mutateAsync({ version: item.version }).then((result) => {
                  onDraft(result.draft)
                  onNotice(`Draft restored from ${item.version}. Publish a new version to make it current.`)
                }).catch((reason: unknown) => onError(isApiError(reason) ? reason.message : "The agent service could not be reached."))
              }}
            >
              Restore draft from {item.version}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TestConsole({ agentId, published }: { agentId: string; published: string[] }) {
  const test = useTestAgentStudio(agentId)
  const history = useAgentTestRuns(agentId)
  const [input, setInput] = useState("Summarize the handbook")
  const [version, setVersion] = useState("draft")
  const [result, setResult] = useState<AgentTestResponse | null>(null)
  const [visible, setVisible] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const stoppedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  return (
    <div className="grid gap-3">
      <h2 className="text-base font-medium">Test console</h2>
      <p className="text-sm text-muted-foreground">Runs are deterministic and simulated. Stop discards the result in the browser. The runtime does not execute tools.</p>
      <label className="grid gap-1 text-sm" htmlFor="agent-test-input">
        User input
        <textarea id="agent-test-input" value={input} onChange={(event) => setInput(event.target.value)} className="min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        Agent version
        <select aria-label="Agent version" value={version} className={fieldClass} onChange={(event) => setVersion(event.target.value)}>
          <option value="draft">Draft</option>
          {published.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={test.isPending}
          onClick={() => {
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller
            stoppedRef.current = false
            setError(null)
            void test.mutateAsync({ version, input, signal: controller.signal }).then((response) => {
              if (stoppedRef.current || controller.signal.aborted) return
              setResult(response)
              setVisible(1)
            }).catch((reason: unknown) => {
              if (stoppedRef.current || controller.signal.aborted || (isApiError(reason) && reason.code === "cancelled")) return
              setError(isApiError(reason) ? reason.message : "The agent service could not be reached.")
            })
          }}
        >
          {test.isPending ? "Running simulation" : "Run simulation"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            stoppedRef.current = true
            abortRef.current?.abort()
            setResult(null)
            setError("Simulation stopped. No further steps were applied.")
          }}
        >
          Stop
        </Button>
        <Button type="button" variant="outline" disabled={!result || visible >= (result?.steps.length ?? 0)} onClick={() => setVisible((count) => count + 1)}>
          Next step
        </Button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <section aria-label="Test history">
        <h3 className="text-sm font-medium">Test history</h3>
        {(history.data?.runs.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No simulated test runs yet.</p> : null}
        <ul className="grid gap-1">
          {(history.data?.runs ?? []).slice(0, 5).map((run) => (
            <li key={run.runId} className="text-xs text-muted-foreground">
              {run.runId} · {run.agentVersion || "unknown"} · {run.status} · {run.traceId} · {run.durationMs} ms
            </li>
          ))}
        </ul>
      </section>
      {result ? (
        <div className="grid gap-2" aria-live="polite">
          <p role="status">{result.notice} Status {result.status}. Latency {result.latencyMs} ms.</p>
          <TokenUsageBadge promptTokens={result.usage.promptTokens} completionTokens={result.usage.completionTokens} />
          <CostIndicator amount={result.estimatedCostUsd} />
          <ol aria-label="Execution steps">
            {result.steps.slice(0, visible).map((step) => (
              <li key={step.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="font-medium">
                  {step.index}. {step.title}
                </p>
                <p>{step.detail}</p>
                {step.toolId ? <p className="text-xs text-muted-foreground">Tool {step.toolId}</p> : null}
                {step.chunkIds ? <p className="text-xs text-muted-foreground">Chunks {step.chunkIds.join(", ") || "none"}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}

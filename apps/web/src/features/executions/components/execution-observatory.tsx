"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getExecutionLogs, getExecutionModels, getExecutionRetrievals, getExecutionTools, getExecutionTrace } from "@/features/executions/api"
import { filterStructuredLogs } from "@/features/executions/observatory"
import type { StructuredLog, TraceSpan } from "@/features/executions/observatory-types"

export function ExecutionObservatory({ executionId }: { executionId: string }) {
  const [severity, setSeverity] = useState<"all" | StructuredLog["severity"]>("all")
  const [q, setQ] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const logs = useQuery({
    queryKey: ["executions", executionId, "logs", severity, q],
    queryFn: () => getExecutionLogs(executionId, { severity, q }),
  })
  const traces = useQuery({ queryKey: ["executions", executionId, "traces"], queryFn: () => getExecutionTrace(executionId) })
  const models = useQuery({ queryKey: ["executions", executionId, "models"], queryFn: () => getExecutionModels(executionId) })
  const tools = useQuery({ queryKey: ["executions", executionId, "tools"], queryFn: () => getExecutionTools(executionId) })
  const retrievals = useQuery({ queryKey: ["executions", executionId, "retrievals"], queryFn: () => getExecutionRetrievals(executionId) })
  const spans = traces.data?.trace.spans ?? []
  const width = Math.max(...spans.map((span) => span.durationMs), 1)
  const visibleLogs = filterStructuredLogs(logs.data?.logs ?? [], severity, q)

  return (
    <div className="grid gap-4">
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-labelledby="trace-heading">
        <h2 id="trace-heading" className="text-base font-medium">Traces</h2>
        {spans.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No trace was recorded for this execution.</p> : null}
        {spans.length > 0 ? (
          <ol aria-label="Trace waterfall" className="mt-4 grid gap-2">
            {spans.map((span) => (
              <TraceRow key={span.spanId} span={span} width={width} depth={span.parentSpanId ? 1 : 0} />
            ))}
          </ol>
        ) : null}
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-base font-medium">Structured logs</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Structured severity
            <select aria-label="Structured severity" className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}>
              {["all", "debug", "info", "warn", "error"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Structured search
            <input aria-label="Structured search" className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={q} onChange={(event) => setQ(event.target.value)} />
          </label>
        </div>
        <ul aria-label="Structured logs" className="mt-3 grid gap-2">
          {visibleLogs.map((log) => (
            <li key={log.id} className="rounded-lg bg-background p-3 text-sm">
              <p>{log.severity} · {log.serviceName} · {log.traceId ?? "No trace"} · {log.message}</p>
              <button type="button" className="mt-2 text-xs text-highlight" aria-expanded={open === log.id} onClick={() => setOpen(open === log.id ? null : log.id)}>
                {open === log.id ? "Hide details" : "Show details"}
              </button>
              {open === log.id ? <pre className="mt-2 overflow-x-auto font-mono text-xs">{JSON.stringify(log.details, null, 2)}</pre> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-base font-medium">AI Model Calls</h2>
        {(models.data?.models.length ?? 0) === 0 ? <p className="mt-2 text-sm text-muted-foreground">No model calls were recorded.</p> : null}
        <ul className="mt-3 grid gap-2">
          {(models.data?.models ?? []).map((call) => (
            <li key={call.id} className="text-sm">
              {call.provider ?? "Provider not recorded"} · {call.model ?? "Model not recorded"} · prompt {metric(call.usage.promptTokens)} · completion {metric(call.usage.completionTokens)} · first token {metric(call.timeToFirstTokenMs, "ms")} · generation {metric(call.generationLatencyMs, "ms")}
              {call.simulated ? <span className="sr-only"> Simulated model call.</span> : null}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-medium">Guardrails</h3>
        {(models.data?.guardrails.length ?? 0) === 0 ? <p className="mt-2 text-sm text-muted-foreground">No guardrail decision was recorded.</p> : null}
        <ul>{(models.data?.guardrails ?? []).map((item) => <li key={item.id} className="text-sm">{item.decision}</li>)}</ul>
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-base font-medium">Tool Invocations</h2>
        {(tools.data?.tools.length ?? 0) === 0 ? <p className="mt-2 text-sm text-muted-foreground">No tool invocations were recorded.</p> : null}
        <ul>{(tools.data?.tools ?? []).map((tool) => <li key={tool.id} className="text-sm">{tool.toolId ?? "Tool not recorded"} · {tool.durationMs} ms · attempt {tool.attempt}</li>)}</ul>
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-base font-medium">Retrieval</h2>
        {(retrievals.data?.retrievals.length ?? 0) === 0 ? <p className="mt-2 text-sm text-muted-foreground">No retrieval was recorded.</p> : null}
        <ul>
          {(retrievals.data?.retrievals ?? []).map((item) => (
            <li key={item.id} className="text-sm">
              {item.knowledgeBaseId ?? "Knowledge base not recorded"} · retrieval {item.durationMs} ms · embedding {metric(item.embeddingDurationMs, "ms")} · rerank {metric(item.rerankDurationMs, "ms")}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-base font-medium">Costs</h2>
        <p className="mt-2 text-sm">Estimated total {money(retrievals.data?.costs.totalUsd ?? null)}. Model, tool, and retrieval costs are shown only when they were recorded separately.</p>
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-base font-medium">Errors</h2>
        {(retrievals.data?.errors.length ?? 0) === 0 ? <p className="mt-2 text-sm text-muted-foreground">No error was recorded.</p> : null}
        <ul>{(retrievals.data?.errors ?? []).map((item) => <li key={`${item.step}-${item.message}`} className="text-sm">{item.message}</li>)}</ul>
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-base font-medium">Retry History</h2>
        <ul aria-label="Retry history">
          {(traces.data?.attempts ?? []).map((attempt) => (
            <li key={attempt.id} className="text-sm">{attempt.id} · attempt {attempt.attempt} · {attempt.retryOf ? `from ${attempt.retryOf}` : "original"}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function TraceRow({ span, width, depth }: { span: TraceSpan; width: number; depth: number }) {
  const start = span.parentSpanId ? 12 : 0
  return (
    <li className="grid gap-1 text-sm" style={{ marginLeft: depth * 16 }}>
      <span>
        {span.operationName} · {span.serviceName} · {span.durationMs} ms
        <span className="sr-only">{span.simulated ? " Simulated span." : " Recorded telemetry."}</span>
      </span>
      <span className="block h-2 rounded bg-foreground/10">
        <span className="block h-2 rounded bg-primary" style={{ width: `${Math.max(4, (span.durationMs / width) * 100)}%`, marginLeft: start }} />
      </span>
    </li>
  )
}

function metric(value: number | null, unit = "") {
  if (value === null) return "not recorded"
  return unit ? `${value} ${unit}` : String(value)
}

function money(value: number | null) {
  return value === null ? "not recorded" : `$${value.toFixed(6)}`
}

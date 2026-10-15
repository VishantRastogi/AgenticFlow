import type { SpanStatus, StructuredLog, TraceEvent, TraceSpan } from "@/features/executions/observatory-types"

const SENSITIVE_KEY = /secret|password|token|api[_-]?key|authorization|credential/i
const SENSITIVE_TEXT = /(secret|password|token|api[_-]?key)\s*[:=]\s*\S+/gi

export function redactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactValue(key, entry)]))
}

export function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]"
  if (Array.isArray(value)) return value.map((item) => (item && typeof item === "object" ? redactRecord(item as Record<string, unknown>) : item))
  if (value && typeof value === "object") return redactRecord(value as Record<string, unknown>)
  if (typeof value === "string") return value.replace(SENSITIVE_TEXT, "$1=[redacted]")
  return value
}

export function structuredLog(input: Omit<StructuredLog, "details"> & { details: Record<string, unknown> }): StructuredLog {
  return { ...input, details: redactRecord(input.details) }
}

export function filterStructuredLogs(logs: StructuredLog[], severity: "all" | StructuredLog["severity"], q: string) {
  const needle = q.trim().toLowerCase()
  return logs.filter((log) => {
    const matchesSeverity = severity === "all" || log.severity === severity
    const matchesQuery =
      needle.length === 0 ||
      log.message.toLowerCase().includes(needle) ||
      (log.serviceName ?? "").toLowerCase().includes(needle) ||
      (log.traceId ?? "").toLowerCase().includes(needle)
    return matchesSeverity && matchesQuery
  })
}

export function layoutSpans(input: {
  traceId: string
  executionId: string
  startedAt: string
  simulated: boolean
  root: { operationName: string; serviceName: string; status: SpanStatus }
  children: Array<{
    operationName: string
    serviceName: string
    durationMs: number
    status: SpanStatus
    attributes?: Record<string, string | number | boolean | null>
    events?: TraceEvent[]
  }>
}): TraceSpan[] {
  const started = Date.parse(input.startedAt)
  const childDuration = input.children.reduce((sum, child) => sum + Math.max(0, child.durationMs), 0)
  const rootDuration = Math.max(childDuration, input.children.length === 0 ? 0 : childDuration)
  const root = span({
    traceId: input.traceId,
    executionId: input.executionId,
    spanId: "span_root",
    parentSpanId: null,
    serviceName: input.root.serviceName,
    operationName: input.root.operationName,
    startMs: started,
    durationMs: rootDuration,
    status: input.root.status,
    simulated: input.simulated,
    attributes: {},
    events: [],
  })
  let offset = 0
  const children = input.children.map((child, index) => {
    const next = span({
      traceId: input.traceId,
      executionId: input.executionId,
      spanId: `span_${index + 1}`,
      parentSpanId: root.spanId,
      serviceName: child.serviceName,
      operationName: child.operationName,
      startMs: started + offset,
      durationMs: Math.max(0, child.durationMs),
      status: child.status,
      simulated: input.simulated,
      attributes: child.attributes ?? {},
      events: child.events ?? [],
    })
    offset += Math.max(0, child.durationMs)
    return next
  })
  return [root, ...children]
}

export function spansAreTimed(spans: TraceSpan[]) {
  if (!spans.some((span) => span.parentSpanId === null)) return false
  return spans.every((item) => {
    const start = Date.parse(item.startTime)
    const end = Date.parse(item.endTime)
    if (end - start !== item.durationMs) return false
    if (!item.parentSpanId) return true
    const parent = spans.find((candidate) => candidate.spanId === item.parentSpanId)
    if (!parent) return false
    return Date.parse(item.startTime) >= Date.parse(parent.startTime) && Date.parse(item.endTime) <= Date.parse(parent.endTime)
  })
}

function span(input: {
  traceId: string
  executionId: string
  spanId: string
  parentSpanId: string | null
  serviceName: string
  operationName: string
  startMs: number
  durationMs: number
  status: SpanStatus
  simulated: boolean
  attributes: Record<string, string | number | boolean | null>
  events: TraceEvent[]
}): TraceSpan {
  return {
    traceId: input.traceId,
    spanId: input.spanId,
    parentSpanId: input.parentSpanId,
    serviceName: input.serviceName,
    operationName: input.operationName,
    startTime: new Date(input.startMs).toISOString(),
    endTime: new Date(input.startMs + input.durationMs).toISOString(),
    durationMs: input.durationMs,
    status: input.status,
    attributes: {
      executionId: input.executionId,
      telemetry: input.simulated ? "simulated" : "recorded",
      ...input.attributes,
    },
    events: input.events,
    simulated: input.simulated,
  }
}

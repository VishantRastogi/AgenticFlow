# Execution service integration

The execution observatory is a frontend contract over simulated records. It does not run a job worker, an agent runtime, a model gateway, or a telemetry pipeline. Real mode fails closed for every operation below.

## Ownership

| Concern | Owner |
| --- | --- |
| Execution lifecycle, cancellation, and retries | Node.js Job Service |
| Agent steps and tool invocations | Python Agent Runtime |
| Model invocations | Python LLM Gateway |
| Retrieval traces | Python RAG Service |
| Trace, log, and cost aggregation | Observability pipeline |

The mock labels every span, model call, tool call, and retrieval row with `simulated: true` and `attributes.telemetry = "simulated"`. Recorded telemetry would use `simulated: false`. The UI does not invent time to first token, embedding duration, or rerank duration when the run did not store them.

## Records

`ExecutionRecord` remains the catalog row in the operations overlay. `ExecutionSummary` and `ExecutionDetail` are the observatory projections. Added optional summary fields: `source` (`catalog`, `agent_test`, `workflow`, `workflow_plan`), `versionLabel`, `traceId`, `workspaceId`, `tokenCount`, `estimatedCostUsd`, `model`, `workflowId`.

`ExecutionStatus` on catalog rows stays `succeeded|completed|failed|running|queued|cancelled`. `ObservatoryStatus` adds `waiting_for_approval`.

`ExecutionAttempt` is `{ id, attempt, retryOf, status, startedAt }`. A retry creates a new id and sets `retryOf` to the original. The original row is not rewritten.

`ExecutionTrace` is `{ executionId, traceId, spans, simulated }`. `TraceSpan` is `{ traceId, spanId, parentSpanId, serviceName, operationName, startTime, endTime, durationMs, status, attributes, events, simulated }`. Child spans sit inside the root span. A trace is returned only for an execution that exists. Catalog history has no trace id, so its trace span list is empty.

`StructuredLog` is `{ id, timestamp, severity, serviceName, traceId, spanId, message, details }`. Keys matching secret, password, token, api key, authorization, or credential are replaced with `[redacted]`, including the same pattern inside string values.

`ModelInvocation` carries `provider`, `model`, `usage` (`TokenUsage` with nullable prompt, completion, and total counts), `timeToFirstTokenMs`, `generationLatencyMs`, `estimatedCostUsd`, `error`, `attempt`, and `spanId`. `ToolInvocation` and `RetrievalInvocation` reference a span on the same execution. Retrieval leaves `embeddingDurationMs` and `rerankDurationMs` null unless a run recorded them.

`CostBreakdown` is `{ modelUsd, toolUsd, retrievalUsd, totalUsd }`. Only `totalUsd` is filled when the run stored an estimate. The split stays null.

`ExecutionError` is `{ message, step, spanId, at }`.

## Endpoints

All routes accept `workspaceId`. Omitted means `local`. A cross-workspace id returns the same `404` body as a missing id: `{ "code": "unknown", "message": "This execution is not in the history." }`.

| Operation | Method and path | Notes |
| --- | --- | --- |
| `executions.list` | `GET /api/executions` | Catalog rows for `local`, plus agent test runs, workflow executions, and workflow plans for the workspace. Each id appears once. |
| `executions.get` | `GET /api/executions/:id` | Existing detail shape. |
| `executions.tick` | `POST /api/executions/:id/tick` | Catalog lifecycle only. |
| `executions.cancel` | `POST /api/executions/:id/cancel` | Idempotent when the execution is already cancelled. Completed and failed runs return `409`. Cancelling a waiting workflow does not execute later nodes. |
| `executions.retry` | `POST /api/executions/:id/retry` | `201` with a new execution linked by `retryOf`. Running work returns `409`. |
| `executions.logs` | `GET /api/executions/:id/logs` | Query `severity` and `q`. |
| `executions.traces` | `GET /api/executions/:id/traces` | Trace plus retry attempts. |
| `executions.models` | `GET /api/executions/:id/models` | Model calls and guardrail decisions. |
| `executions.tools` | `GET /api/executions/:id/tools` | Tool invocations. |
| `executions.retrievals` | `GET /api/executions/:id/retrievals` | Retrieval rows, cost breakdown, and errors. |
| `executions.stream` | `GET /api/executions/:id/events` | Still unimplemented. Real mode does not fall back to mock. |

Aborting an in-flight HTTP request uses the transport `cancelled` error and does not call the cancel operation. An accepted workflow execution keeps its `executionId` until `executions.cancel` or the workflow cancel route is called.

## Workspace and publish

Workflow definitions, drafts, snapshots, and executions are scoped by `workspaceId`. Catalog fixtures belong to `local`. `workflows.publish` writes the same immutable snapshot as `workflows.studio.publish`. A later draft edit does not change that snapshot, and `workflows.run` executes it.

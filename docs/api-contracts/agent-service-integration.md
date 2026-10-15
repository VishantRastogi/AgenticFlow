# Node.js Agent Service integration

Agent Studio extends the existing agent catalog. The browser talks only to the public gateway origin through the typed adapter. It does not call the Node.js Agent Service, the Python Agent Runtime, the Python LLM Gateway, the Python RAG Service, or the Node.js Job Service directly.

`NEXT_PUBLIC_API_MODE=real` sends the operations below to `NEXT_PUBLIC_API_URL` and fails closed when that origin is missing or the route returns 404, 405, or 5xx. The mock stores drafts in `agentflow-mock-agent-studio`. It does not run a model, execute tools, persist memory, or store tool credentials.

## Ownership

| Contract | Owner | Browser responsibility |
| --- | --- | --- |
| `AgentProfile`, create, update, activate, deactivate, delete | Node.js Agent Service | Existing `/api/agents` routes. Studio does not replace them. |
| `AgentConfiguration`, `AgentModelSettings`, `AgentKnowledgeBinding`, `AgentToolDefinition`, `AgentMemorySettings`, `AgentGuardrailPolicy`, `AgentExecutionPolicy` | Node.js Agent Service | Read and save the workspace draft. Treat the payload as a contract. |
| `AgentVersion`, `AgentPublishRequest` | Node.js Agent Service | Publish an immutable snapshot and copy an older snapshot into a new draft. |
| `AgentToolPermission` | Node.js Agent Service records it. Python Agent Runtime enforces it. | Distinguish `read` from `side_effect`. Never store credentials. |
| `AgentTestRequest`, `AgentTestResponse`, `AgentExecutionStep` | Python Agent Runtime | Request a simulation. The mock response is deterministic and labeled. |
| Model inference inside a step | Python LLM Gateway | Do not call a provider from the browser. |
| Retrieval inside a step | Python RAG Service | Bind only knowledge bases that already exist in the workspace. |
| Scheduling, cancellation, and execution lifecycle | Node.js Job Service | Existing execution records stay attached to the agent version captured when the run was created. |

`workspaceId` selects a scope. It is not a credential. The gateway authorizes the bearer token and resolves membership. A studio record for another workspace is a different key. A knowledge base outside the workspace is `404` `not_found` with `Knowledge base not found.`

## Operations

| Operation | Method and path | Idempotent | Success |
| --- | --- | --- | --- |
| `agents.studio.get` | `GET /api/agents/:id/studio?workspaceId=` | Yes | `200` `AgentStudioRecord` |
| `agents.studio.save` | `PATCH /api/agents/:id/studio?workspaceId=` | Yes | `200` stored draft |
| `agents.studio.publish` | `POST /api/agents/:id/studio/publish?workspaceId=` | No | `200` record with a new immutable snapshot |
| `agents.studio.rollback` | `POST /api/agents/:id/studio/rollback?workspaceId=` | No | `200` record whose draft was copied from a snapshot |
| `agents.studio.test` | `POST /api/agents/:id/studio/tests?workspaceId=` | No | `200` `AgentTestResponse` |
| `agents.tools.list` | `GET /api/agent-tools?workspaceId=` | Yes | `200` tool templates |

The body `workspaceId` must equal the query. A mismatch is `400` `validation_error` with `Workspace scope does not match.`

An unknown agent is `404` `not_found` with `Agent not found.` The existing catalog route `agents.get` still returns `404` `unknown` with `This agent is not in the catalog.`

## Draft and published versions

`AgentStudioRecord` is `{ simulated, workspaceId, agentId, draft, publishedVersion, versions, warnings }`.

`draft` is an `AgentConfiguration`. Saving it does not edit `versions`.

`AgentPublishRequest` is `{ workspaceId, version, note }`. `version` matches `major.minor.patch`. `note` is 4 to 160 characters. The service copies the validated draft into an `AgentVersionSnapshot` with `immutable: true`. Publishing the same version again is `409` `invalid_job_transition` with `That version is already published and cannot be changed.`

Published snapshots are stored only for the `workspaceId` and agent id in the request. Publishing does not change the shared catalog `agent.version`, so another workspace keeps its own draft and snapshots. `agents.trigger` records the catalog profile version at that moment. Historical `ExecutionRecord` rows keep the `agentVersion` they were created with. Rows that omit it stay omitted; the UI shows `unknown`.

`GET /api/agents/:id/studio/runs?workspaceId=` lists simulated test runs for that workspace and agent. Each run has `runId`, `traceId`, `agentId`, `agentVersion`, `workspaceId`, `steps`, `status`, `startedAt`, and `durationMs`. A cancelled test request is aborted in the browser and is not applied to the console. Test runs are not written into the catalog execution list.

`AgentRollbackRequest` is `{ workspaceId, version }`. Rollback copies that snapshot into `draft`. It does not change the snapshot or `publishedVersion`. A missing version is `404` `not_found` with `Published version not found.`

## Configuration rules

`AgentModelSettings` is checked against the model catalog. The mock providers are `agentflow-simulated` and `northstar-simulated`.

| Model | Temperature | Output tokens | Tool calling | Structured output |
| --- | --- | --- | --- | --- |
| `orbit-small` | 0 to 1 | 1 to 1024 | `auto`, `none` | No |
| `orbit-large` | 0 to 2 | 1 to 4096 | `auto`, `required`, `none` | Yes |
| `orbit-code` | 0 to 1 | 1 to 2048 | `none` | No |
| `northstar-chat` | 0 to 0.7 | 1 to 512 | `none` | No |

A provider and model that do not belong together are rejected. Structured output requires a JSON object schema.

`AgentExecutionPolicy`: timeout 1000 to 300000 ms; maximum duration is an integer at least the timeout and at most 300000; cost budget 0 to 100 USD; steps 1 to 20; tool calls 0 to 20; token budget covers `maxOutputTokens` and is at most 100000. Retry is `none`, `fixed`, or `exponential`.

`AgentKnowledgeBinding`: at most 8 existing knowledge bases. Strategy is `vector`, `keyword`, or `hybrid`. Top K is 1 to 20. Score threshold is 0 to 1. Context budget is 64 to 8192. `rerank` and `requireCitations` are booleans. A binding whose base has no `READY` documents adds a warning and does not invent chunks.

`AgentToolDefinition`: id matches `^[a-z][a-z0-9_]{1,40}$`, unique within the configuration. Name is at least 2 characters. Input and output schemas are JSON objects. Timeout is 100 to 60000 ms. Permission is `read` or `side_effect`. An enabled side-effect tool requires approval when the guardrail policy requires human approval, and it must appear in `allowedToolIds` when permission enforcement is on. The catalog categories are HTTP API, knowledge search, document retrieval, calculator, structured extraction, notification, and human approval.

`AgentMemorySettings.mode` is `stateless`, `conversation`, `short_term`, or `long_term`. Retention is 0 to 365 days. Stateless mode requires 0. These fields are stored only. The runtime does not persist memory in this phase.

`AgentGuardrailPolicy` records input validation, output validation, sensitive-data masking, tool permission enforcement, maximum duration, token budget, human approval, and the allowed tool list. The studio states that enforcement belongs to the runtime.

## Simulated test

`AgentTestRequest` is `{ workspaceId, version, input }`. `version` is `draft` or a published version. Input shorter than 2 characters is `400` `validation_error`. Input containing `rate limit` is `429` `rate_limited` before a simulation is stored. Input containing `fail this run` returns status `failed`.

`AgentTestResponse` includes `simulated: true`, ordered `AgentExecutionStep` values, token usage, latency, estimated cost, and a notice that no model, tool, or memory service was called. Step kinds are `validate`, `retrieve`, `tool`, `respond`, `limit`, and `error`.

The simulation stops when the next step would pass `maxSteps`, `timeoutMs`, `maxDurationMs`, `maxTokenBudget`, or `budgetUsd`. A step limit does not append an extra step past `maxSteps`. A timeout, token, or cost limit appends one `limit` step. Tool steps run only for enabled, allowed tools, and never more than `maxToolCalls`. `toolCalling: none` skips tools. Side-effect tools are not executed and no credentials are read. Retrieval lists ready chunks only, up to `topK`. Sensitive input is masked in the trace when masking is enabled.

Test runs are not written to execution history.

## Real mode

Every studio operation uses `scope: "contract"` and `transport: "rest"`. Real mode without `NEXT_PUBLIC_API_URL` throws `api_unavailable` and does not read or write `agentflow-mock-agent-studio`.

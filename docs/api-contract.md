# Backend integration contract

The Mission Control UI talks to one HTTP origin. In development, `NEXT_PUBLIC_API_MODE=mock` (the default) sends those calls to the page origin, where MSW answers them. `NEXT_PUBLIC_API_MODE=real` sends them to `NEXT_PUBLIC_API_URL` and never falls back to MSW.

There is no GraphQL schema and no working backend behind this contract. `apps/web/src/features/api/contract.ts` is the operation catalog. `callContract` in `apps/web/src/features/api/real-adapter.ts` is the real adapter: a missing origin, a mock-only route, the unimplemented event stream, or an HTTP 404/405/5xx response fails with `api_unavailable` and the text `Mock mode was not used`. The adapter does not invent a successful payload.

Operation ids below are the adapter names. Paths are REST.

## Switching modes

| `NEXT_PUBLIC_API_MODE` | Behavior |
| --- | --- |
| unset, empty, or `mock` | Development calls the page origin. Production throws before any request. |
| `real` | Requires `NEXT_PUBLIC_API_URL`. Network errors, 404, 405, and 5xx become `api_unavailable`. A JSON error body with a known `code` is passed through. |
| anything else | Throws `api_unavailable` immediately. Mock mode is not used. |

`auth.mockHint` (`GET /api/auth/mock-hint`) is rejected in real mode before `fetch`. `executions.stream` is rejected in every mode because no SSE or WebSocket handler exists.

## Error body

```json
{ "code": "validation_error", "message": "Human readable explanation." }
```

| Code | Typical status | Meaning |
| --- | --- | --- |
| `invalid_credentials` | 401 | Email or password did not match. |
| `email_taken` | 409 | Registration email already exists. |
| `unauthenticated` | 401 | Bearer token missing or unknown. |
| `session_expired` | 401 | Bearer token was valid and has expired. |
| `invalid_reset_token` | 400 | Reset token missing, used, or expired. |
| `validation_error` | 400 | Body or query failed validation. |
| `invalid_file_type` | 415 | The file extension or media type is not accepted. |
| `file_too_large` | 413 | The file is larger than the service limit. |
| `duplicate_name` | 409 | A knowledge base with that name already exists in the workspace. |
| `not_found` | 404 | The resource is missing in the caller's workspace. The body does not say whether it exists elsewhere. |
| `forbidden` | 403 | The caller is authenticated but is not allowed to perform the operation. Cross-workspace reads use `not_found` instead. |
| `invalid_job_transition` | 409 | Retry, cancel, or reindex is not legal for the current attempt. |
| `processing_failed` | 502, or on the job | The pipeline or a simulated upload failed. A failed ingestion job keeps this code and stays readable. |
| `rate_limited` | 429 | The service refused the call until the client waits. |
| `network` | 0 | Mock-mode transport failure. |
| `api_unavailable` | 0, 404, 405, 5xx | Real endpoint missing, origin unset, or transport failed. Mock was not used. |
| `unknown` | varies | Fallback when the body is an error but the code is not one of the above. The mock hint uses this when no seed account exists. |

## Authorization

Public operations: `auth.login`, `auth.register`, `auth.forgotPassword`, `auth.resetPassword`.

Every other contract operation sends `Authorization: Bearer <token>` when a token is stored. The token is the opaque string returned by login or register. The mock session lasts 8 hours and is not a secure cookie.

The development mock enforces the bearer token on `auth.session` and `auth.logout` only. Other mock routes still run without it and use the token only to name the audit actor. A real service must reject workspace routes without a valid bearer token using `unauthenticated` or `session_expired`. The UI already treats those codes as a return to `/login`.

## Pagination and filtering

List operations take `page` starting at 1. The response includes `page`, `pageSize`, and `total`. There is no cursor.

| Operation | Page size | Filters |
| --- | --- | --- |
| `agents.list` | 6 | `q`, `status` (`all\|active\|idle\|paused\|error`), `environment` (`all\|production\|staging\|sandbox`), `type` (`all\|planner\|researcher\|operator\|reviewer`), `sort` (`name\|updated\|success\|status`) |
| `workflows.list` | 6 | `q`, `status` (`all\|draft\|published`), `page` |
| `executions.list` | 8 | `q`, `agent` (id or `all`), `environment` (`all\|production\|staging\|sandbox`), `status` (`all\|queued\|running\|completed\|failed\|cancelled`), `range` (`all\|24h\|7d\|30d`), `sort` (`newest\|oldest\|duration\|status\|agent`) |
| `audit.list` | none; returns the filtered set | `q`, `actor` (`all` or a name), `resource` (`all` or a type), `outcome` (`all\|succeeded\|failed`), `range` (`all\|24h\|7d\|30d`) |
| `operations.dashboard` | n/a | `environment` (`all\|production\|staging\|sandbox`), `range` (`24h\|7d\|30d`) |
| `analytics.get` | n/a | same environment and range as the dashboard |
| `knowledge.bases.list` | 6 | `workspaceId`, `q`, `status` (`all\|empty\|processing\|ready\|attention`), `model` (`all\|orbit-embed-small\|orbit-embed-large`), `sort` (`updated\|name\|documents\|storage`), `page` |
| `knowledge.documents.list` | 8 | `workspaceId`, `q`, `status` (`all` or an ingestion stage), `page` |
| `rag` | n/a | `workspaceId` on every retrieval route. Filters travel in the retrieval body. |

Date windows are compared with the service clock. The mock clock is `2026-10-14T04:30:00.000Z`, not the browser clock.

## Idempotency

| Idempotent | Operations |
| --- | --- |
| Yes | All GETs, `auth.logout`, `auth.forgotPassword`, `auth.resetPassword`, `agents.update`, `agents.delete`, `workflows.update`, `workflows.delete`, `executions.cancel` (a second cancel of a cancelled run is a no-op; cancelling a completed run is `validation_error`), settings PATCH routes, `settings.memberDelete` |
| No | `auth.login`, `auth.register`, `operations.createAgent`, `agents.create`, `agents.trigger`, `workflows.create`, `workflows.publish`, `workflows.run`, `executions.tick`, `executions.retry`, `deployments.deploy`, `deployments.rollback`, `settings.memberCreate`, `settings.integrationCreate` |

Clients must not retry non-idempotent posts automatically. `executions.retry` always creates a new run. `agents.trigger` always creates a new execution. There is no `Idempotency-Key` header in this contract.

## Auth

### `auth.login` `POST /api/auth/login`

Request: `{ "email": string, "password": string }`

Response `200`: `{ "token": string, "expiresAt": string, "user": { "id": string, "name": string, "email": string } }`

Errors: `validation_error`, `invalid_credentials`. The address `network@agentflow.test` is a mock transport failure and must not be treated as a real account.

### `auth.register` `POST /api/auth/register`

Request: `{ "name": string, "email": string, "password": string }` with password length at least 8.

Response `201`: same session shape as login.

Errors: `validation_error`, `email_taken`.

### `auth.logout` `POST /api/auth/logout`

No body. Response `204` empty. Idempotent.

### `auth.session` `GET /api/auth/session`

Response `200`: the session shape. Errors: `unauthenticated`, `session_expired`.

### `auth.forgotPassword` `POST /api/auth/forgot-password`

Request: `{ "email": string }`

Response `200`: `{ "message": string, "resetToken"?: string }`. Unknown emails still return `200` and omit `resetToken`. The mock returns the token in the body because there is no mailer. A real service must send the token out of band and omit it.

### `auth.resetPassword` `POST /api/auth/reset-password`

Request: `{ "token": string, "password": string }`

Response `200`: `{ "message": string }`

Errors: `validation_error`, `invalid_reset_token`.

### `auth.mockHint` `GET /api/auth/mock-hint`

Development only. Response `200`: `{ "name", "email", "password", "notice" }`. Real mode fails before the request.

## Agents and dashboard

### `operations.dashboard` `GET /api/operations/dashboard`

Response `200` includes `simulated: true` in the mock, `asOf`, KPI counts, volume, status, and trend series, live executions, recent failures, and runtime health. Every number is derived from agent and execution records. `succeeded` and `completed` both count as success. `cancelled` does not.

### `operations.createAgent` `POST /api/operations/agents`

Dashboard quick-create. Request: `{ "name": string, "environment": "production"|"staging"|"sandbox" }`. Response `201`: `{ "agent": AgentRecord }`. A name shorter than 2 characters, or an unknown environment, is `400` `validation_error`.

### `agents.list` `GET /api/agents`

Response `200`: `{ "agents": AgentSummary[], "page": number, "pageSize": number, "total": number, "simulated": true }`

`AgentSummary` adds `successRate`, `totalExecutions`, and `recentRuns` to the profile. `successRate` is `null` when the agent has no finished runs.

### `agents.get` `GET /api/agents/:id`

Response `200`: `{ "simulated": true, "agent": AgentProfile, "stats", "executions", "logs", "versions" }`

`404` with `unknown` when the id is missing.

### `agents.create` `POST /api/agents`

Request: `name` (2–48), `description` (8–280), `type`, `environment`, `timeoutMs` (1000–300000), `retryPolicy` (`none|fixed|exponential`), `version` (`major.minor.patch`), `configuration` object.

Response `201`: `{ "agent": AgentProfile }`. New agents start `idle`.

### `agents.update` `PATCH /api/agents/:id`

Same write body, plus optional `status` (`active|idle|paused|error`). Activation from the studio sends `{ "status": "active" | "paused" }`. Response `200`: `{ "agent": AgentProfile }`.

### `agents.delete` `DELETE /api/agents/:id`

Response `204`.

### `agents.trigger` `POST /api/agents/:id/executions`

No body. Response `201`: `{ "execution": ExecutionRecord }`. A `paused` agent returns `409` `validation_error`. An `error` agent still records a failed run.

`AgentRecord.status` on stored executions remains `succeeded|completed|failed|running|queued|cancelled`. The observatory maps `succeeded` to the display status `completed`.

## Workflows

Graph nodes are `trigger`, `browser`, `api`, `model`, `condition`, `delay`, `approval`, `output`. A graph is `{ "nodes": WorkflowNode[], "edges": WorkflowEdge[] }`.

### `workflows.list` `GET /api/workflows`

Response `200`: `{ "workflows": WorkflowSummary[], "page", "pageSize", "total", "simulated": true }`

Summary fields: `id`, `name`, `description`, `status` (`draft|published`), `version`, `updatedAt`.

### `workflows.get` `GET /api/workflows/:id`

Response `200`: `{ "workflow": WorkflowRecord, "simulated": true }`. `WorkflowRecord` is the summary plus `graph`.

### `workflows.create` `POST /api/workflows`

Request: `{ "name", "description", "graph" }`. Response `201`: `{ "workflow": WorkflowRecord }` with `status: "draft"`.

### `workflows.update` `PATCH /api/workflows/:id`

Partial name, description, graph, and `status: "draft"`. Response `200`: `{ "workflow" }`.

### `workflows.delete` `DELETE /api/workflows/:id`

Response `204`.

### `workflows.publish` `POST /api/workflows/:id/publish`

No body. Response `200`: `{ "workflow" }` with `status: "published"` and an incremented `version` when the graph validates. Invalid graphs return `400` `validation_error` and do not publish. Validation codes inside the message are `missing_trigger`, `missing_output`, `unreachable`, `invalid_connection`, and `required`.

### `workflows.run` `POST /api/workflows/:id/runs`

No body. Response `201`: `{ "run": WorkflowRun }`. The run is a simulated plan (`succeeded` or `failed`) with per-node status. It does not execute a browser or call a model provider. A graph that fails validation returns `400`.

## Executions

### `executions.list` `GET /api/executions`

Response `200`: `{ "executions": ExecutionSummary[], "agents": { "id", "name" }[], "page", "pageSize", "total", "asOf", "simulated": true }`

Summary status is the observatory status: `queued|running|completed|failed|cancelled`.

### `executions.get` `GET /api/executions/:id`

Response `200`: `{ "execution": ExecutionDetail, "simulated": true }`

Detail adds `finishedAt`, `input`, `output`, `error`, `retry` (`attempt`, `maxAttempts`, `policy`, `retryOf`), `steps`, `logs`, and `permissions.cancel` / `permissions.retry` (`{ "allowed": boolean, "reason": string }`).

Logs: `{ "id", "at", "severity": "debug|info|warn|error", "message" }`.

### `executions.tick` `POST /api/executions/:id/tick`

Advances a non-terminal mock run by one step. Response `200`: `{ "execution": ExecutionDetail, "simulated": true }`. Not idempotent. A real service replaces this with the event stream below. The UI polls it through `createPollingFeed` and stops after a terminal status.

### `executions.cancel` `POST /api/executions/:id/cancel`

Allowed from `queued` or `running`. Response `200` with the cancelled detail. A completed run returns `409` `validation_error` and writes no audit event.

### `executions.retry` `POST /api/executions/:id/retry`

Allowed from `failed`. Response `201` with a new execution whose `retryOf` is the source id. A running run returns `409`.

### `executions.stream` `GET /api/executions/:id/events`

Unimplemented. Reserved SSE contract, one event per tick:

```
event: execution.updated
data: {"execution": ExecutionDetail, "simulated": false}
```

The stream ends after a terminal status. A future WebSocket frame uses the same JSON body and the event name `execution.updated`. Clients must ignore unknown event names. The adapter throws `api_unavailable` for this operation and does not open a socket.

## Analytics

### `analytics.get` `GET /api/analytics`

Query: `environment`, `range`. Unsupported values are `400` `validation_error`.

Response `200`: `{ "simulated": true, "asOf", "environment", "range", "runs", "succeeded", "failed", "cancelled", "successRate", "latency": { "p50", "p95", "p99" }, "throughput": ThroughputPoint[], "outcomes": OutcomeSlice[], "heatmap": HeatCell[], "tokens", "cost", "leaderboard": LeaderboardRow[] }`

Cancelled runs count in `runs` and the donut. They are excluded from latency, tokens, and the success rate. Token counts and `cost` use the mock price card (`orbit-large` 0.008, `orbit-small` 0.002, otherwise 0.004 per 1,000 tokens). This is not a provider bill.

## Deployments

Environments: `development`, `staging`, `production`. They map to agent runtimes `sandbox`, `staging`, and `production`.

### `deployments.list` `GET /api/deployments`

Response `200`: `{ "simulated": true, "environments": DeploymentSnapshot[] }`

### `deployments.get` `GET /api/deployments/:id`

Response `200`: `DeploymentSnapshot` with `health`, `active` release, and `releases`. Unknown ids return `404`.

Health is derived: an agent in `error`, or a success rate below 0.8, is `critical`. `paused`, or a rate below 0.95, is `degraded`. Otherwise `healthy`.

### `deployments.deploy` `POST /api/deployments/:id/deploy`

No body. A healthy or degraded target returns `201` with a new active release (patch version bumped) and pipeline frames `Build`, `Validate`, `Deploy`, `Health Check`, `Active`, all `succeeded`.

A `critical` target returns `200` (not 409) so the client can show the failed pipeline. Frames: Build, Validate, and Deploy `succeeded`; Health Check `failed`; Active `skipped`. The previous active release stays active. `release.note` explains that.

### `deployments.rollback` `POST /api/deployments/:id/rollback`

Response `200`: `{ "simulated": true, "release" }` restoring the newest superseded version. `409` `validation_error` when no superseded release exists (`There is no previous release to restore.`).

## Audit

### `audit.list` `GET /api/audit-logs`

Response `200`: `{ "simulated": true, "asOf", "events": AuditEvent[], "actors": string[], "resources": string[], "total": number }`

`AuditEvent`: `{ "id", "at", "actor", "action", "resourceType", "resourceId", "outcome": "succeeded"|"failed", "detail": string, "fields": Record<string, string> }`

Seed rows use action `agent.registered` and actor `Workspace seed`. Live rows are appended only after a successful mutation, at the mock clock, with the session user as actor. Failed validations such as a rejected cancel do not append a row. Field names matching password, token, secret, api key, authorization, or credential are masked before storage (`orbit-secret` becomes `or••••et`).

Actions the mock writes: `agent.created`, `agent.updated`, `agent.status_changed`, `agent.deleted`, `execution.triggered`, `workflow.created`, `workflow.updated`, `workflow.published`, `workflow.run_started`, `workflow.deleted`, `execution.cancelled`, `execution.retried`, `deployment.activated`, `deployment.health_failed`, `deployment.rolled_back`, `settings.organization_updated`, `settings.preferences_updated`, `member.added`, `member.role_changed`, `member.removed`, `integration.saved`.

Export is a client download of the current filtered response. There is no export endpoint.

## Settings

### `settings.get` `GET /api/settings`

Response `200`: `{ "simulated": true, "organization": { "name", "slug" }, "preferences": { "density": "comfortable"|"compact" }, "members": SettingsMember[], "integrations": SettingsIntegration[] }`

Slug pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Theme is not in this payload. It stays in the browser under `agentflow-theme`.

### `settings.organization` `PATCH /api/settings/organization`

Body: `{ "name", "slug" }`. Response `200`: the snapshot. Invalid slug is `400` `validation_error`.

### `settings.preferences` `PATCH /api/settings/preferences`

Body: `{ "density": "comfortable"|"compact" }`. Response `200`: the snapshot. Timezone is not editable; timestamps stay UTC.

### `settings.memberCreate` `POST /api/settings/members`

Body: `{ "name", "email", "role": "admin"|"operator"|"viewer" }`. Response `201`: snapshot. Duplicate email is `409` `validation_error`.

### `settings.memberRole` `PATCH /api/settings/members/:id`

Body: `{ "role": "admin"|"operator"|"viewer" }`. The owner role cannot be changed (`409`). Missing member is `404`.

### `settings.memberDelete` `DELETE /api/settings/members/:id`

Response `200`: snapshot. The owner cannot be removed (`409`).

### `settings.integrationCreate` `POST /api/settings/integrations`

Body: `{ "name": string, "secret": string }` with secret length at least 8. Response `201`: snapshot. The stored integration is `{ "id", "name", "status": "saved_locally", "secretMask", "note" }`. `note` is `Saved in this browser. No provider was contacted.` Status is never `connected`. The raw secret is not stored and is masked again if it appears in an audit field.

## Persistence in the mock

| Key | Contents |
| --- | --- |
| `agentflow-mock-auth` | Users, sessions, reset tokens |
| `agentflow-auth-token` | Client bearer token |
| `agentflow-mock-operations` | Agent and execution overlay |
| `agentflow-mock-workflows` | Workflow overlay |
| `agentflow-mock-deployments` | Release overlay |
| `agentflow-mock-audit` | Audit overlay |
| `agentflow-mock-settings` | Organization, preferences, members, integrations |
| `agentflow-mock-playground` | Playground conversations and presets |
| `agentflow-mock-knowledge` | Knowledge bases, documents, ingestion jobs, and chunks |
| `agentflow-mock-rag` | Last RAG Studio configuration per workspace |

## Playground

These routes are the simulated model gateway used by `/playground`. Assistant messages include `simulated: true`. They are not live provider output.

| Operation | Method and path | Notes |
| --- | --- | --- |
| `playground.catalog` | `GET /api/playground/catalog` | Models and saved presets. |
| `playground.conversations.list` | `GET /api/playground/conversations` | Newest first. |
| `playground.conversations.get` | `GET /api/playground/conversations/:id` | |
| `playground.conversations.create` | `POST /api/playground/conversations` | Body is model settings plus optional `title`. |
| `playground.conversations.delete` | `DELETE /api/playground/conversations/:id` | `204`. |
| `playground.presets.save` | `POST /api/playground/presets` | Name of at least 2 characters. |
| `playground.generate` | `POST /api/playground/generations` | Not idempotent. A message containing `rate limit` returns `429` `rate_limited`. A message containing `fail this run` returns `502`. |
| `playground.cancel` | `POST /api/playground/generations/:id/cancel` | Body `{ "content": string }` saves a stopped assistant message. |
| `playground.stream` | `GET /api/playground/generations/:id/events` | `text/event-stream` with `tool`, `citation`, `token`, and `done` events. Real mode fails with `api_unavailable` when the stream is missing. |

A real service stores these on the server. The browser keys are a development mock and are not an API.

## Knowledge bases

These routes back `/knowledge-bases`. Every record is scoped by `workspaceId`. The UI sends the local workspace id `local`. `workspaceId` selects a scope. It is not an authorization credential. A future service must resolve the caller's workspace membership from the bearer token. A missing membership is `401` `unauthenticated` or `403` `forbidden`. A read or write for an id outside the caller's workspace is `404` `not_found` with the same message as a missing id (`Knowledge base not found.`, `Document not found.`, or `Ingestion job not found.`). The body does not reveal that the record exists in another workspace.

The response always includes `simulated: true` in the mock. Text, chunks, and embeddings are produced by the mock ingestion service. They are not parsed from file bytes and no vectors are computed.

`workspaceId` is required on every route as a query parameter. It must match `^[a-z0-9][a-z0-9_-]{0,63}$`. Create and upload also send `workspaceId` in the body, and it must equal the query. A mismatch is `400` `validation_error` with `Workspace scope does not match.`

Pagination matches the rest of the contract: `page` starts at 1, and the body includes `page`, `pageSize`, and `total`. `total` counts the filtered set. A page past the end returns an empty `items` array. Knowledge bases use page size 6. Documents use page size 8.

### Types

`KnowledgeBaseSettings`: `{ "embeddingModel": "orbit-embed-small"|"orbit-embed-large", "chunkSize": number, "chunkOverlap": number, "retrieval": { "topK": number, "scoreThreshold": number }, "metadataSchema": Record<string, "string"|"number"|"boolean"> }`

`KnowledgeBase`: settings plus `id`, `workspaceId`, `name`, `description`, `documentCount`, `storageBytes`, `ingestionStatus` (`empty|processing|ready|attention`), `reindexRequired`, `createdAt`, `updatedAt`, `simulated`. `documentCount` and `storageBytes` are derived from the documents in that workspace. They are not stored separately. `reindexRequired` is true when chunk size, overlap, or the embedding model differ from the settings that last reached `READY`.

`KnowledgeBaseCreateRequest`: `{ "workspaceId", "name", "description", "settings" }`

`KnowledgeBaseUpdateRequest`: `{ "name", "description", "settings" }`

`KnowledgeBaseListResponse`: `{ "simulated": true, "workspaceId", "page", "pageSize", "total", "items": KnowledgeBase[] }`

`DocumentRecord`: `{ "id", "workspaceId", "knowledgeBaseId", "jobId", "name", "extension": "pdf"|"docx"|"txt"|"md", "mediaType", "sizeBytes", "status", "progress", "attempt", "error", "extractedText", "metadata", "createdAt", "updatedAt", "simulated" }`

`DocumentUploadRequest`: `{ "workspaceId", "name", "mediaType", "sizeBytes" }`

`DocumentUploadResponse`: `{ "simulated": true, "document", "job" }`

`IngestionJob`: `{ "id", "workspaceId", "knowledgeBaseId", "documentId", "attempt", "stage", "failedStage", "progress", "durationMs", "error", "errorCode", "cancelled", "startedAt", "updatedAt", "simulated" }`. `id` is immutable. `attempt` starts at 1. `errorCode` is `processing_failed` or null. Cancel keeps `errorCode` null.

`IngestionStage`: `UPLOADED | QUEUED | PARSING | CHUNKING | EMBEDDING | INDEXING | READY | FAILED`

`DocumentChunk`: `{ "id", "documentId", "index", "content", "tokenCount", "startOffset", "endOffset", "metadata", "simulated" }`. Offsets are character positions in the simulated extract.

`PaginatedResponse<T>`: `{ "page", "pageSize", "total", "items": T[] }`

Errors use the shared body `{ "code", "message" }`. Duplicate names use `409` `duplicate_name`. An unsupported type uses `415` `invalid_file_type`. A file over 5 MB uses `413` `file_too_large`. Missing or cross-workspace records use `404` `not_found`. Illegal retry, cancel, or reindex uses `409` `invalid_job_transition`. A rejected simulated upload and a failed pipeline use `processing_failed`. A name containing `rate-limit` uses `429` `rate_limited` before a row is written. `forbidden` is reserved for a member who may see the workspace but may not perform the operation. The mock does not assign roles.

### Validation

Name is required, trimmed, 2 to 80 characters, and unique in the workspace without regard to case. Description may be empty and is at most 500 characters. Chunk size is an integer from 128 to 2048. Chunk overlap is an integer greater than or equal to 0 and strictly less than the chunk size. Top K is an integer from 1 to 20. Score threshold is a number from 0 to 1. The embedding model must be one of the two simulated models. Metadata schema is a JSON object of at most 12 keys. Keys match `^[a-z][a-z0-9_]{0,31}$`. Values are `string`, `number`, or `boolean`.

Files must use `.pdf`, `.docx`, `.txt`, or `.md`. Empty files and files larger than 5 MB are rejected. The upload body carries the name, media type, and size. File bytes are not stored. A name containing `fail-upload` is rejected with `502` `processing_failed` before a document row is written.

The browser checks type and size before the request so the user gets immediate feedback. That check is not authoritative. The service repeats it and returns `invalid_file_type`, `file_too_large`, or `validation_error`. A client that skips its own check still cannot store a bad file.

### Production upload sequence

The working mock route `knowledge.documents.upload` collapses the sequence below and returns `session.status = "completed"` with `uploadUrl: null`. It does not send bytes to object storage.

Production clients will use this sequence instead. The session routes are in the catalog as `unimplemented`, so real mode fails closed and the current UI does not call them.

1. `POST /api/knowledge-bases/:id/uploads` creates an upload session after authoritative type and size checks.
2. The client uploads the bytes with `PUT` to the returned `uploadUrl`. That URL is an authorized gateway or a presigned object-storage URL. It is not a knowledge-base route.
3. `POST /api/knowledge-bases/:id/uploads/:uploadId/complete` marks the object stored.
4. Completion creates the document and the first ingestion job at `UPLOADED`.
5. The client polls `GET` document and knowledge-base routes, or a future event stream, for job progress.

`workspaceId` on the session must match the authenticated membership. The presigned URL must be bound to that session and must expire.

### Operations

| Operation | Method and path | Idempotent | Success |
| --- | --- | --- | --- |
| `knowledge.bases.list` | `GET /api/knowledge-bases` | Yes | `200` list |
| `knowledge.bases.get` | `GET /api/knowledge-bases/:id` | Yes | `200` `{ "simulated", "knowledgeBase", "activeJobs" }` |
| `knowledge.bases.create` | `POST /api/knowledge-bases` | No | `201` `{ "simulated", "knowledgeBase" }` |
| `knowledge.bases.update` | `PATCH /api/knowledge-bases/:id` | Yes | `200` `{ "simulated", "knowledgeBase" }` |
| `knowledge.bases.delete` | `DELETE /api/knowledge-bases/:id` | Yes | `204`. Deletes documents, jobs, and chunks for that base. |
| `knowledge.documents.list` | `GET /api/knowledge-bases/:id/documents` | Yes | `200` list |
| `knowledge.documents.get` | `GET /api/knowledge-bases/:id/documents/:documentId` | Yes | `200` `{ "simulated", "document", "job", "jobs", "chunks" }` |
| `knowledge.documents.upload` | `POST /api/knowledge-bases/:id/documents` | No | `201` upload response. Status starts at `UPLOADED`. |
| `knowledge.documents.delete` | `DELETE /api/knowledge-bases/:id/documents/:documentId` | Yes | `204`. Deletes jobs and chunks for that document. |
| `knowledge.documents.retry` | `POST /api/knowledge-bases/:id/documents/:documentId/retry` | No | `201`. Only a `FAILED` document can be retried. The new job id is a new attempt. |
| `knowledge.bases.reindex` | `POST /api/knowledge-bases/:id/reindex` | No | `200` `{ "simulated", "jobs" }`. One new `QUEUED` attempt per terminal document. |
| `knowledge.jobs.cancel` | `POST /api/knowledge-bases/:id/jobs/:jobId/cancel` | Yes | `200`. A second cancel of a cancelled job returns the same row. Cancelling a finished job is `409` `invalid_job_transition`. |
| `knowledge.chunks.list` | `GET /api/knowledge-bases/:id/documents/:documentId/chunks` | Yes | `200` `{ "simulated", "chunks" }` |
| `knowledge.uploads.create` | `POST /api/knowledge-bases/:id/uploads` | No | Unimplemented. Real mode fails before fetch. |
| `knowledge.uploads.complete` | `POST /api/knowledge-bases/:id/uploads/:uploadId/complete` | Yes | Unimplemented. Real mode fails before fetch. |

There is no `jobs.tick` route. The UI only reads job state and sends retry, cancel, and reindex. In the mock, a worker inside the store advances each current attempt by one stage about every 700 ms and writes that state before the next read. The page polls `GET` every 700 ms while a job is non-terminal and clears the timer on unmount. Tests do not start the worker; they call the store helper `advanceIngestionJob`. A Python worker can own the same stage updates later without a UI change.

`activeJobs` lists non-terminal jobs for the whole knowledge base, including jobs whose documents are on another page. `READY` and `FAILED` are the only terminal stages. A document has one current attempt (`document.jobId`). Older attempt rows stay. Retry and reindex refuse with `invalid_job_transition` while any current attempt is non-terminal, so two attempts cannot run for the same document. Reindex also refuses when the base has no documents or when any document is still running. It clears extracted text and chunks, then starts `attempt + 1` at `QUEUED`. Changing chunk size, overlap, or the embedding model sets `reindexRequired` and does not rebuild chunks by itself.

### Ingestion transitions

`UPLOADED → QUEUED → PARSING → CHUNKING → EMBEDDING → INDEXING → READY`

Each completed step adds a fixed simulated duration: 200, 300, 400, 500, 400, then 300 ms. The budget is 2100 ms. `progress` is 0 at `UPLOADED` and 100 at `READY`.

Extracted text is written when the job enters `PARSING`. It always says the text was not parsed from the file. Chunks are written when the job enters `CHUNKING` and say embeddings were not computed. A retry clears extracted text and chunks, then starts a new job at `QUEUED` with `attempt + 1`. The previous job row is kept.

A file whose name contains `fail-parse` fails as it would enter `PARSING`. A file whose name contains `fail-once` fails as it would enter `EMBEDDING` on attempt 1 and can reach `READY` on attempt 2. Cancel sets `FAILED`, `cancelled: true`, and the error `Ingestion was cancelled. No embedding was written.`

`ingestionStatus` on the knowledge base is `empty` with no documents, `processing` while any document is not terminal, `attention` when any document failed and none are still running, and `ready` when every document is `READY`.

Changing chunk settings does not rebuild chunks that already exist. The new window applies to later ingestion and to an explicit reindex.

### Backend handoff

A Node.js GraphQL gateway can expose these REST operations without changing the UI paths. A Python ingestion service owns parsing, chunking, and embeddings. It should accept the same stage names, return `simulated: false` when a real model ran, and keep workspace isolation on every read and write. The browser storage key is not part of that API. Real mode already fails closed when these routes are missing. Retrieval experiments are documented in `docs/api-contracts/rag-service-integration.md`.

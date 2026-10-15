# Node.js Workflow Service integration

The workflow canvas keeps the existing editor, graph, and integer publish route. Studio snapshots and simulated executions are additional contracts. The browser calls only the public gateway origin. It does not call the Node.js Workflow Service, the Node.js Job Service, the Python Agent Runtime, the Python LLM Gateway, or the Python RAG Service directly.

`NEXT_PUBLIC_API_MODE=real` sends these operations to `NEXT_PUBLIC_API_URL` and fails closed when that origin is missing. The mock stores snapshots and executions in `agentflow-mock-workflow-studio`. It does not run tools, models, or retrieval.

## Ownership

| Contract | Owner | Browser responsibility |
| --- | --- | --- |
| `WorkflowDefinition` (`WorkflowRecord`), `WorkflowNode`, `WorkflowEdge`, `WorkflowNodeConfiguration` | Node.js Workflow Service | Edit the draft graph. Preserve node ids. |
| `WorkflowVersionSnapshot`, `WorkflowPublishRequest`, `WorkflowValidationResult` | Node.js Workflow Service | Publish an immutable copy and compare versions. |
| `WorkflowExecutionRequest`, `WorkflowExecutionRecord`, `WorkflowNodeExecution` | Node.js Job Service coordinates lifecycle. Python Agent Runtime performs agent and tool steps. | Request a labeled simulation. |
| `WorkflowApprovalRequest` is the pending approval on an execution. `WorkflowApprovalDecision` resumes it. | Node.js Job Service | Pause until an authorized mock decision. |
| Model inference | Python LLM Gateway | Do not call a provider from the browser. |
| Retrieval and embeddings | Python RAG Service | Select an existing knowledge base. |

`workspaceId` selects a scope. It is not a credential. Snapshots and executions for one workspace are not visible in another. The shared workflow catalog is unchanged by a snapshot publish.

## Operations

| Operation | Method and path | Success |
| --- | --- | --- |
| `workflows.studio.get` | `GET /api/workflows/:id/studio?workspaceId=` | `200` snapshots |
| `workflows.validation` | `GET /api/workflows/:id/validation?workspaceId=` | `200` `WorkflowValidationResult` |
| `workflows.studio.publish` | `POST /api/workflows/:id/studio/publish?workspaceId=` | `200` record with a new immutable snapshot |
| `workflows.studio.rollback` | `POST /api/workflows/:id/studio/rollback?workspaceId=` | `200` record. The draft graph is replaced. |
| `workflows.executions.list` | `GET /api/workflows/:id/executions?workspaceId=` | `200` executions for that workspace |
| `workflows.executions.start` | `POST /api/workflows/:id/executions?workspaceId=` | `201` `WorkflowExecutionRecord` |
| `workflows.executions.approval` | `POST /api/workflows/:id/executions/:executionId/approval?workspaceId=` | `200` resumed record |
| `workflows.executions.cancel` | `POST /api/workflows/:id/executions/:executionId/cancel?workspaceId=` | `200` cancelled record |

`workflows.publish` and `workflows.studio.publish` both commit an immutable snapshot through the same operation. A published workflow points at that snapshot. `workflows.run` executes the published snapshot when one exists. A duplicate version is rejected, and a published snapshot is not edited when the draft changes.

The body `workspaceId` must equal the query. A mismatch is `400` `validation_error` with `Workspace scope does not match.`

## Nodes and ports

Each node has a typed configuration and ports.

| Node | Input | Output | Branches |
| --- | --- | --- | --- |
| LLM Generation | text | text |  |
| RAG Retrieval | text | retrieval |  |
| Document Ingestion | document | document |  |
| Embedding Generation | text | embedding |  |
| Tool Invocation | json | tool result |  |
| Agent Execution | text | agent result |  |
| Human Approval | text | text | `approve`, `reject` |
| Structured Output Validation | json | json | `valid`, `error` |

Legacy nodes keep their previous connection rules. A connection that involves a studio node is rejected when the port types are incompatible. Cycles are rejected. Human approval and structured output require both branch connections before publish. A published workflow cannot reference a missing knowledge base, a missing tool, a missing agent, or an agent version that is not published in that workspace.

## Versions

`WorkflowPublishRequest` is `{ workspaceId, version, note }`. `version` is `major.minor.patch`. `note` is 4 to 160 characters. The snapshot copies the draft graph, including node ids, and sets `immutable: true`. Publishing the same version again is `409` `invalid_job_transition`.

Rollback copies that snapshot into the editable draft. It does not change the snapshot. A later edit to the draft does not change a published graph. An execution names `workflowVersion` and uses that snapshot when the version is not `draft`.

## Simulation

Statuses are `queued`, `running`, `waiting_for_approval`, `completed`, `failed`, and `cancelled`. The record includes `traceId`, node results, token total, estimated cost, and a notice that no service was called.

A human approval node stops the walk until `WorkflowApprovalDecision` arrives with the configured role. Approve follows the approve branch. Reject follows the reject branch. A different role is `400`. Cancel while the run is waiting marks it `cancelled` and does not execute later nodes. A tool marked `fail-once` fails when retries are 0 and succeeds on attempt 2 when a retry is configured. Retrieval lists ready chunks only.

## Real mode

These operations use `scope: "contract"` and `transport: "rest"`. Real mode without `NEXT_PUBLIC_API_URL` throws `api_unavailable` and does not read the mock store.

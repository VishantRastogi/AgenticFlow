# Python RAG service integration

The RAG Studio page calls three REST operations through the same adapter as the rest of Mission Control. `NEXT_PUBLIC_API_MODE=real` sends them to `NEXT_PUBLIC_API_URL` and fails closed when that origin is missing or the route returns 404, 405, or 5xx. The mock lives in the browser and reads ready chunks from the knowledge store. It does not compute embeddings.

The browser must not call the Python service directly. A Node gateway can forward these paths later. This document is the contract that service should implement.

## Operations

| Operation | Method and path | Idempotent | Success |
| --- | --- | --- | --- |
| `rag.configuration.get` | `GET /api/rag/configuration?workspaceId=` | Yes | `200` saved or default configuration |
| `rag.configuration.save` | `PATCH /api/rag/configuration?workspaceId=` | Yes | `200` stored configuration |
| `rag.retrieve` | `POST /api/rag/retrievals?workspaceId=` | No | `200` retrieval response |

`workspaceId` is a scope selector. It is not a credential. The service authorizes the bearer token, loads the caller's workspace membership, and ignores a body or query workspace the caller does not belong to. A knowledge base outside that membership is `404` `not_found` with `Knowledge base not found.` The same message is used when the id does not exist.

The body `workspaceId` must equal the query. A mismatch is `400` `validation_error` with `Workspace scope does not match.`

## Request

```json
{
  "workspaceId": "local",
  "knowledgeBaseId": "kb_1",
  "query": "reset a device",
  "strategy": "hybrid",
  "topK": 4,
  "scoreThreshold": 0.2,
  "filters": [{ "key": "filename", "op": "eq", "value": "notes.md" }],
  "rerank": { "enabled": true, "model": "orbit-rerank-mini" },
  "contextTokenBudget": 800,
  "generateAnswer": true
}
```

| Field | Rules |
| --- | --- |
| `strategy` | `vector`, `keyword`, or `hybrid` |
| `query` | Trimmed, 2 to 500 characters |
| `topK` | Integer 1 to 20 |
| `scoreThreshold` | Number 0 to 1, compared with the strategy's **normalized** score |
| `filters` | At most 6. `op` is `eq` or `contains`. Keys match `^[a-z][a-z0-9_]{0,31}$`. |
| `rerank.model` | `orbit-rerank-mini` in the mock. Production may add models. |
| `contextTokenBudget` | Integer 64 to 8192 |
| `generateAnswer` | When false, `answer` is null and retrieval results are still returned |

## Score normalization

Raw scores are not interchangeable.

| Kind | `raw` | `normalized` | Threshold |
| --- | --- | --- | --- |
| `vector` | Simulated cosine in `[0, 1]` | Same as `raw` | Applied before top K |
| `keyword` | Count of query tokens found in the chunk | `raw / queryTokenCount` in `[0, 1]` | Applied to `normalized`, not to the hit count |
| `hybrid` | Equal blend `(vectorNormalized + keywordNormalized) / 2` | Same as that blend | Applied to the blend. `vectorNormalized` and `keywordNormalized` are included so callers can see both inputs |
| `rerank` | Independent coverage and position score in `[0, 1]` | Same as `raw` | Not used as a second threshold. Rerank only reorders the chunks that already passed |

A keyword `raw` of `3` and a vector `raw` of `0.82` do not mean the same thing. Rank and filter on `normalized` for the selected strategy. Show `rerankScore` separately from `score`.

## Response

```json
{
  "simulated": true,
  "workspaceId": "local",
  "knowledgeBaseId": "kb_1",
  "requestId": "req_1",
  "traceId": "trc_1",
  "strategy": "hybrid",
  "query": "reset a device",
  "notice": "Simulated retrieval. Scores are not from a vector database, and no model wrote this ranking.",
  "results": [
    {
      "rank": 1,
      "chunk": {
        "chunkId": "chk_1",
        "documentId": "doc_1",
        "documentName": "notes.md",
        "index": 0,
        "content": "Simulated extract…",
        "startOffset": 0,
        "endOffset": 120,
        "tokenCount": 30,
        "metadata": { "filename": "notes.md" },
        "embeddingModel": "orbit-embed-small",
        "score": { "kind": "hybrid", "raw": 0.5, "normalized": 0.5, "vectorNormalized": 0.2, "keywordNormalized": 0.8 },
        "rerankScore": { "kind": "rerank", "raw": 0.91, "normalized": 0.91 },
        "explanation": "Equal blend of the normalized vector score and the normalized keyword score."
      }
    }
  ],
  "context": {
    "tokenBudget": 800,
    "tokensUsed": 30,
    "chunkIds": ["chk_1"],
    "preview": "Simulated extract…",
    "simulated": true
  },
  "answer": {
    "text": "Simulated answer. This was not produced by a model.",
    "model": "orbit-small",
    "citations": [
      {
        "citationId": "cite_chk_1",
        "chunkId": "chk_1",
        "documentId": "doc_1",
        "documentName": "notes.md",
        "index": 0,
        "quote": "Simulated extract…"
      }
    ],
    "usage": { "promptTokens": 32, "completionTokens": 20, "totalTokens": 52 },
    "estimatedCostUsd": 0.000104,
    "simulated": true
  },
  "timing": {
    "validationMs": 3,
    "embeddingMs": 20,
    "retrievalMs": 6,
    "filterMs": 3,
    "rerankMs": 7,
    "assemblyMs": 3,
    "generationMs": 80,
    "totalMs": 122
  },
  "trace": {
    "requestId": "req_1",
    "traceId": "trc_1",
    "stages": [{ "name": "validation", "durationMs": 3, "skipped": false }]
  }
}
```

Production sets `simulated` to `false` only after a real embedder, index, reranker, or model ran. Citations may reference only chunk ids that were placed in `context.chunkIds`. Those ids must also appear in `results`. An empty knowledge base, or a base whose documents are not `READY`, returns `200` with `results: []` and a notice that no chunks were invented.

The mock answer price is `$0.002` per 1,000 tokens for `orbit-small`. That figure is a label, not a provider invoice.

## Errors

```json
{ "code": "not_found", "message": "Knowledge base not found." }
```

| Status | Code | When |
| --- | --- | --- |
| 400 | `validation_error` | Query, strategy, top K, threshold, budget, filters, or workspace mismatch |
| 401 | `unauthenticated` | Missing or unknown bearer token |
| 403 | `forbidden` | Authenticated caller is not allowed to run retrieval in this workspace |
| 404 | `not_found` | Unknown knowledge base, including a base in another workspace |
| 429 | `rate_limited` | Caller should wait. The mock uses this when the query contains `rate limit` |
| 502 | `processing_failed` | The retrieval dependency failed after the request was accepted |

## Retrieval lifecycle

```text
Query → Validation → Query embedding → Retrieval → Filtering → Reranking → Context assembly → LLM generation → Citations
```

| Stage | Vector | Keyword | Hybrid |
| --- | --- | --- | --- |
| Validation | Required | Required | Required |
| Query embedding | Required | Skipped | Required for the vector leg |
| Retrieval | Vector index | Keyword index | Both indexes |
| Metadata and threshold filtering | Required | Required | Required. Threshold uses the hybrid normalized blend |
| Reranking | Optional | Optional | Optional |
| Context assembly | Required | Required | Required. Stops when the token budget is full |
| LLM generation | Optional | Optional | Optional. Off when `generateAnswer` is false |
| Citations | Only if an answer was generated | Same | Same |

Only documents in `READY` are candidates. `UPLOADED`, `QUEUED`, `PARSING`, `CHUNKING`, `EMBEDDING`, `INDEXING`, and `FAILED` contribute nothing.

## Service responsibilities

**Python FastAPI RAG service**

- Validate the request and the caller's workspace membership.
- Embed the query with the knowledge base's embedding model when the strategy needs it.
- Call the vector index and, for keyword or hybrid, the keyword index.
- Apply metadata filters and the normalized threshold before top K.
- Call the reranker only when `rerank.enabled` is true, and do not drop chunks with the retrieval threshold a second time.
- Assemble context inside `contextTokenBudget`.
- When generation is on, call the LLM with that context and return citations that point at returned chunks.
- Emit `requestId` and `traceId` on every response.

**Vector database**

- Store chunk vectors, the embedding model id, dimensions, and the chunk offsets.
- Partition or filter by `workspaceId` and `knowledgeBaseId` on every search.
- Do not return chunks whose document is not `READY`.
- A reindex from the knowledge API replaces vectors for that document. The previous attempt's vectors are not searchable.

**Gateway**

- Terminate the browser session and forward the bearer identity.
- Do not trust `workspaceId` from the browser without the membership check.
- Stream generation later on `GET /api/rag/retrievals/:requestId/events` as `text/event-stream`. The studio currently uses the JSON response. Until that route exists it stays unimplemented, the same way `executions.stream` does. Events should be `citation` and `token`, followed by a final usage event. The JSON `answer` remains available for clients that do not stream.

## Observability

Every response carries `requestId` and `traceId`. `trace.stages` records `validation`, `query_embedding`, `retrieval`, `filtering`, `reranking`, `context_assembly`, and `generation`, with `skipped: true` when that strategy or toggle omitted the stage. `timing` uses the same names in milliseconds. Production should put the same ids on logs and traces. The mock timings are deterministic functions of the query and the candidate count, not wall-clock samples.

## Mock limits

The mock ranks with token buckets and string overlap. It does not call a vector database or an LLM. Repeated queries with the same body return the same ranking, scores, citations, and cost. `requestId` and `traceId` change per execution. Configuration is stored under `agentflow-mock-rag` so a refresh can restore the last experiment. That key is not part of the Python API.

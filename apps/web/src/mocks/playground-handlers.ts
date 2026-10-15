import { http, HttpResponse } from "msw"
import type { PlaygroundConfig } from "@/features/playground/types"
import {
  cancelPlaygroundGeneration,
  completePlaygroundGeneration,
  createPlaygroundConversation,
  deletePlaygroundConversation,
  generationChunks,
  getPlaygroundConversation,
  listPlaygroundConversations,
  playgroundCatalog,
  savePlaygroundPreset,
  startPlaygroundGeneration,
} from "@/mocks/playground-store"

function error(status: number, code: "validation_error" | "rate_limited" | "unknown", message: string) {
  return HttpResponse.json({ code, message }, { status })
}

function readConfig(body: Partial<PlaygroundConfig>): PlaygroundConfig | null {
  if (!body || typeof body.model !== "string" || typeof body.provider !== "string") return null
  if (typeof body.temperature !== "number" || body.temperature < 0 || body.temperature > 2) return null
  if (typeof body.maxTokens !== "number" || body.maxTokens < 16 || body.maxTokens > 4096) return null
  if (typeof body.retrieval !== "boolean" || typeof body.systemPrompt !== "string") return null
  if (!body.guardrails || typeof body.guardrails.refuseSecrets !== "boolean" || typeof body.guardrails.citeSources !== "boolean") {
    return null
  }
  return {
    systemPrompt: body.systemPrompt,
    provider: body.provider,
    model: body.model,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    retrieval: body.retrieval,
    guardrails: body.guardrails,
  }
}

export const playgroundHandlers = [
  http.get("*/api/playground/catalog", () => HttpResponse.json(playgroundCatalog())),

  http.get("*/api/playground/conversations", () => HttpResponse.json(listPlaygroundConversations())),

  http.get("*/api/playground/conversations/:id", ({ params }) => {
    const conversation = getPlaygroundConversation(String(params.id))
    if (!conversation) return error(404, "unknown", "This conversation is not in the playground.")
    return HttpResponse.json({ simulated: true, conversation })
  }),

  http.post("*/api/playground/conversations", async ({ request }) => {
    const body = (await request.json()) as Partial<PlaygroundConfig> & { title?: string }
    const config = readConfig(body)
    if (!config) return error(400, "validation_error", "Model, temperature, and guardrail settings are required.")
    const conversation = createPlaygroundConversation({ ...config, title: body.title })
    return HttpResponse.json({ simulated: true, conversation }, { status: 201 })
  }),

  http.delete("*/api/playground/conversations/:id", ({ params }) => {
    if (!deletePlaygroundConversation(String(params.id))) {
      return error(404, "unknown", "This conversation is not in the playground.")
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.post("*/api/playground/presets", async ({ request }) => {
    const body = (await request.json()) as { name?: string } & Partial<PlaygroundConfig>
    const config = readConfig(body)
    const name = body.name?.trim() ?? ""
    if (!config || name.length < 2) return error(400, "validation_error", "A preset needs a name and model settings.")
    const preset = savePlaygroundPreset({
      name,
      systemPrompt: config.systemPrompt,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      retrieval: config.retrieval,
    })
    return HttpResponse.json({ simulated: true, preset }, { status: 201 })
  }),

  http.post("*/api/playground/generations", async ({ request }) => {
    const body = (await request.json()) as Partial<PlaygroundConfig> & { conversationId?: string; message?: string }
    const config = readConfig(body)
    if (!config || !body.message?.trim()) {
      return error(400, "validation_error", "A message and model settings are required.")
    }
    const result = startPlaygroundGeneration({
      ...config,
      ...(body.conversationId ? { conversationId: body.conversationId } : {}),
      message: body.message,
    })
    if (result.error === "rate_limited") {
      return error(429, "rate_limited", "The simulated gateway applied a rate limit. Wait and retry this message.")
    }
    if (result.error === "provider") {
      return error(502, "unknown", "The simulated provider failed this run. Mock mode recorded no assistant text.")
    }
    if (result.error === "missing") return error(404, "unknown", "This conversation is not in the playground.")
    if (result.error === "validation") return error(400, "validation_error", "Enter a message before generating.")
    return HttpResponse.json(
      { simulated: true, generationId: result.generationId, conversation: result.conversation },
      { status: 201 },
    )
  }),

  http.post("*/api/playground/generations/:id/cancel", async ({ params, request }) => {
    const body = (await request.json()) as { content?: string }
    const result = cancelPlaygroundGeneration(String(params.id), body.content ?? "")
    if (!result) return error(404, "unknown", "This generation is not running.")
    return HttpResponse.json({ simulated: true, conversation: result.conversation })
  }),

  http.get("*/api/playground/generations/:id/events", ({ params, request }) => {
    const planned = generationChunks(String(params.id))
    if (!planned) return error(404, "unknown", "This generation has no event stream.")
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }
        try {
          for (const tool of planned.generation.turn.tools) {
            if (request.signal.aborted) return
            send("tool", tool)
          }
          for (const citation of planned.generation.turn.citations) {
            if (request.signal.aborted) return
            send("citation", citation)
          }
          for (const text of planned.chunks) {
            if (request.signal.aborted) return
            send("token", { text })
            if (process.env.VITEST !== "true") {
              await new Promise((resolve) => setTimeout(resolve, 16))
            }
          }
          if (request.signal.aborted) return
          const saved = completePlaygroundGeneration(planned.generation.id)
          send("done", {
            simulated: true,
            latencyMs: planned.generation.turn.latencyMs,
            usage: planned.generation.turn.usage,
            messageId: saved?.message.id ?? null,
          })
        } finally {
          controller.close()
        }
      },
    })
    return new HttpResponse(stream, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
    })
  }),
]

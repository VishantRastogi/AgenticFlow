"use client"

import { useMemo, useRef, useState } from "react"
import {
  AIModelSelector,
  CostIndicator,
  GuardrailConfiguration,
  ModelConfigurationPanel,
  PromptEditor,
  TokenUsageBadge,
} from "@/components/ai/model-controls"
import { CitationCard, StreamingMessage, ToolInvocationCard } from "@/components/ai/messages"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import { getApiMode } from "@/features/auth/api/mode"
import {
  cancelPlaygroundGeneration,
  openPlaygroundStream,
  startPlaygroundGeneration,
} from "@/features/playground/api"
import { modelById } from "@/features/playground/catalog"
import {
  useDeletePlaygroundConversation,
  usePlaygroundCatalog,
  usePlaygroundConversation,
  usePlaygroundConversations,
  useRefreshPlaygroundConversation,
  useSavePlaygroundPreset,
} from "@/features/playground/hooks"
import { readPlaygroundStream } from "@/features/playground/stream"
import type { PlaygroundCitation, PlaygroundConfig, PlaygroundMessage, PlaygroundToolCall, PlaygroundUsage } from "@/features/playground/types"

const initialConfig = (): PlaygroundConfig => ({
  systemPrompt: "",
  provider: "AgentFlow Simulated",
  model: "orbit-small",
  temperature: 0.4,
  maxTokens: 400,
  retrieval: false,
  guardrails: { refuseSecrets: true, citeSources: true },
})

type LiveTurn = {
  content: string
  tools: PlaygroundToolCall[]
  citations: PlaygroundCitation[]
  usage: PlaygroundUsage | null
  latencyMs: number | null
}

export function PlaygroundScreen() {
  const catalog = usePlaygroundCatalog()
  const conversations = usePlaygroundConversations()
  const removeConversation = useDeletePlaygroundConversation()
  const savePreset = useSavePlaygroundPreset()
  const refresh = useRefreshPlaygroundConversation()
  const [activeId, setActiveId] = useState<string | null>(null)
  const conversation = usePlaygroundConversation(activeId)
  const [config, setConfig] = useState<PlaygroundConfig>(initialConfig)
  const [draft, setDraft] = useState("")
  const [presetName, setPresetName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [copyNote, setCopyNote] = useState<string | null>(null)
  const [live, setLive] = useState<LiveTurn | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const generationRef = useRef<string | null>(null)
  const liveRef = useRef<LiveTurn | null>(null)

  const messages = conversation.data?.conversation.messages
  const lastAssistant = useMemo(
    () => [...(messages ?? [])].reverse().find((message) => message.role === "assistant") ?? null,
    [messages],
  )
  const usage = live?.usage ?? lastAssistant?.usage ?? null
  const tools = live?.tools.length ? live.tools : lastAssistant?.tools ?? []
  const citations = live?.citations.length ? live.citations : lastAssistant?.citations ?? []

  const applyConversation = (next: PlaygroundConfig) => setConfig(next)

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || streaming) return
    setError(null)
    setCopyNote(null)
    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    const starting: LiveTurn = { content: "", tools: [], citations: [], usage: null, latencyMs: null }
    liveRef.current = starting
    setLive(starting)

    try {
      const started = await startPlaygroundGeneration({
        ...config,
        ...(activeId ? { conversationId: activeId } : {}),
        message,
      })
      const conversationId = started.conversation.id
      setActiveId(conversationId)
      generationRef.current = started.generationId
      await refresh(conversationId)
      const response = await openPlaygroundStream(started.generationId, controller.signal)
      await readPlaygroundStream(response, controller.signal, (event) => {
        const current = liveRef.current ?? starting
        const next =
          event.event === "token"
            ? { ...current, content: current.content + event.data.text }
            : event.event === "tool"
              ? { ...current, tools: [...current.tools, event.data] }
              : event.event === "citation"
                ? { ...current, citations: [...current.citations, event.data] }
                : { ...current, usage: event.data.usage, latencyMs: event.data.latencyMs }
        liveRef.current = next
        setLive(next)
      })
      if (!controller.signal.aborted) {
        await refresh(conversationId)
        setLive(null)
        liveRef.current = null
        setDraft("")
      }
    } catch (caught) {
      if (controller.signal.aborted) return
      setLive(null)
      liveRef.current = null
      setError(isApiError(caught) ? caught.message : "The simulated gateway could not complete this turn.")
    } finally {
      if (!controller.signal.aborted) {
        setStreaming(false)
        generationRef.current = null
      }
    }
  }

  const stop = async () => {
    const generationId = generationRef.current
    const conversationId = activeId
    abortRef.current?.abort()
    setStreaming(false)
    try {
      if (generationId) {
        await cancelPlaygroundGeneration(generationId, liveRef.current?.content ?? "")
      }
      if (conversationId) await refresh(conversationId)
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : "The generation could not be stopped.")
    } finally {
      setLive(null)
      liveRef.current = null
      generationRef.current = null
    }
  }

  const copyMessage = async (message: PlaygroundMessage) => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopyNote("Copied the simulated response.")
    } catch {
      setCopyNote("The browser blocked clipboard access.")
    }
  }

  const history = (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Conversations</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => { setActiveId(null); setConfig(initialConfig()) }}>
          New
        </Button>
      </div>
      {conversations.isPending ? <p role="status">Loading conversations</p> : null}
      {conversations.isError ? <p role="alert">Conversations could not be loaded.</p> : null}
      <ul className="grid max-h-64 gap-1 overflow-y-auto lg:max-h-none">
        {(conversations.data?.conversations ?? []).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
              aria-current={item.id === activeId ? "true" : undefined}
              onClick={() => {
                setActiveId(item.id)
                applyConversation(item)
                setHistoryOpen(false)
              }}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
      {(conversations.data?.conversations.length ?? 0) === 0 && !conversations.isPending ? (
        <p className="text-sm text-muted-foreground">No simulated conversations yet.</p>
      ) : null}
      {activeId ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true)
              return
            }
            void removeConversation.mutateAsync(activeId).then(() => {
              setActiveId(null)
              setConfirmDelete(false)
            })
          }}
        >
          {confirmDelete ? "Confirm delete" : "Delete conversation"}
        </Button>
      ) : null}
      <h2 className="text-sm font-medium">Presets</h2>
      <ul className="grid gap-1">
        {(catalog.data?.presets ?? []).map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() =>
                setConfig((current) => ({
                  ...current,
                  systemPrompt: preset.systemPrompt,
                  model: preset.model,
                  provider: modelById(preset.model).provider,
                  temperature: preset.temperature,
                  maxTokens: preset.maxTokens,
                  retrieval: preset.retrieval,
                }))
              }
            >
              {preset.name}
            </button>
          </li>
        ))}
      </ul>
      <label className="grid gap-1.5 text-sm">
        Preset name
        <input
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
          className="h-10 rounded-lg border border-input bg-transparent px-2.5"
        />
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={savePreset.isPending}
        onClick={() => {
          void savePreset.mutateAsync({
            name: presetName,
            systemPrompt: config.systemPrompt,
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            retrieval: config.retrieval,
          }).then(() => setPresetName(""))
        }}
      >
        Save preset
      </Button>
    </div>
  )

  const inspector = (
    <div className="grid gap-4">
      <AIModelSelector
        provider={config.provider}
        model={config.model}
        disabled={streaming}
        onProviderChange={(provider) => {
          const nextModel = modelById(config.model).provider === provider ? config.model : "orbit-small"
          setConfig((current) => ({ ...current, provider, model: nextModel }))
        }}
        onModelChange={(model) => setConfig((current) => ({ ...current, model, provider: modelById(model).provider }))}
      />
      <PromptEditor
        id="playground-system"
        label="System prompt"
        value={config.systemPrompt}
        disabled={streaming}
        onChange={(systemPrompt) => setConfig((current) => ({ ...current, systemPrompt }))}
      />
      <ModelConfigurationPanel
        temperature={config.temperature}
        maxTokens={config.maxTokens}
        retrieval={config.retrieval}
        disabled={streaming}
        onTemperatureChange={(temperature) => setConfig((current) => ({ ...current, temperature }))}
        onMaxTokensChange={(maxTokens) => setConfig((current) => ({ ...current, maxTokens }))}
        onRetrievalChange={(retrieval) => setConfig((current) => ({ ...current, retrieval }))}
      />
      <GuardrailConfiguration
        refuseSecrets={config.guardrails.refuseSecrets}
        citeSources={config.guardrails.citeSources}
        disabled={streaming}
        onRefuseSecretsChange={(refuseSecrets) =>
          setConfig((current) => ({ ...current, guardrails: { ...current.guardrails, refuseSecrets } }))
        }
        onCiteSourcesChange={(citeSources) =>
          setConfig((current) => ({ ...current, guardrails: { ...current.guardrails, citeSources } }))
        }
      />
      <section className="grid gap-2" aria-label="Execution inspector">
        <h2 className="text-sm font-medium">Inspector</h2>
        {usage ? (
          <>
            <TokenUsageBadge promptTokens={usage.promptTokens} completionTokens={usage.completionTokens} />
            <CostIndicator amount={usage.estimatedCost} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Token usage appears after a simulated turn.</p>
        )}
        <p className="text-xs text-muted-foreground">
          {lastAssistant?.latencyMs || live?.latencyMs
            ? `Latency ${live?.latencyMs ?? lastAssistant?.latencyMs} ms · ${config.model}`
            : `Model ${config.model}`}
        </p>
        {tools.length === 0 ? <p className="text-sm text-muted-foreground">No tool calls for this turn.</p> : tools.map((tool) => <ToolInvocationCard key={tool.id} tool={tool} />)}
        {config.retrieval && citations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Citations appear when retrieval returns a chunk.</p>
        ) : null}
        {citations.map((citation) => (
          <CitationCard key={citation.id} citation={citation} />
        ))}
      </section>
    </div>
  )

  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">AI Playground</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {getApiMode() === "mock" ? "Mock mode. " : ""}
          Assistant text from this playground is a simulated gateway response, not live model output.
        </p>
      </header>
      <div className="flex gap-2 lg:hidden">
        <Button type="button" variant="outline" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>
          History
        </Button>
        <Button type="button" variant="outline" aria-expanded={inspectorOpen} onClick={() => setInspectorOpen((open) => !open)}>
          Inspector
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_18rem] lg:items-start">
        <aside className={`${historyOpen ? "grid" : "hidden"} rounded-xl border border-border bg-card p-3 lg:grid`}>
          {history}
        </aside>
        <section className="grid min-h-[28rem] gap-3 rounded-xl border border-border bg-card p-3">
          <div className="grid content-start gap-3">
            {conversation.isPending ? <p role="status">Loading the conversation</p> : null}
            {(messages ?? []).map((message) => (
              <div key={message.id} className="grid gap-2">
                <StreamingMessage role={message.role} content={message.content} simulated={message.simulated} />
                {message.role === "assistant" ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void copyMessage(message)}>
                    Copy response
                  </Button>
                ) : null}
              </div>
            ))}
            {live ? <StreamingMessage role="assistant" content={live.content} streaming simulated /> : null}
            {(messages?.length ?? 0) === 0 && !live ? (
              <p className="text-sm text-muted-foreground">Send a message to start a simulated conversation.</p>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {copyNote ? <p role="status">{copyNote}</p> : null}
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void send(draft)
            }}
          >
            <label htmlFor="playground-message" className="text-sm font-medium">
              Message
            </label>
            <textarea
              id="playground-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={streaming || draft.trim().length === 0}>
                Send
              </Button>
              <Button type="button" variant="outline" disabled={!streaming} onClick={() => void stop()}>
                Stop generation
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={streaming || !(messages ?? []).some((message) => message.role === "user")}
                onClick={() => {
                  const previous = [...(messages ?? [])].reverse().find((message) => message.role === "user")
                  if (previous) void send(previous.content)
                }}
              >
                Retry generation
              </Button>
            </div>
          </form>
        </section>
        <aside className={`${inspectorOpen ? "grid" : "hidden"} rounded-xl border border-border bg-card p-3 lg:grid`}>
          {inspector}
        </aside>
      </div>
    </div>
  )
}

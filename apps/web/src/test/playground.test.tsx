import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { PlaygroundScreen } from "@/features/playground/playground-screen"
import { readPlaygroundStream } from "@/features/playground/stream"
import { buildSimulatedTurn } from "@/features/playground/script"
import { listPlaygroundConversations } from "@/features/playground/api"
import { renderWithProviders } from "@/test/render"

const config = {
  systemPrompt: "Stay concise.",
  provider: "AgentFlow Simulated",
  model: "orbit-small",
  temperature: 0.2,
  maxTokens: 400,
  retrieval: true,
  guardrails: { refuseSecrets: true, citeSources: true },
}

describe("playground script", () => {
  it("builds the same simulated turn for the same input", () => {
    const first = buildSimulatedTurn("Search the handbook", config)
    const second = buildSimulatedTurn("Search the handbook", config)
    expect(first).toEqual(second)
    expect(first.content).toContain("not a live provider")
    expect(first.citations).toHaveLength(1)
    expect(first.tools[0]?.name).toBe("workspace.lookup")
  })
})

describe("playground stream", () => {
  it("stops reading when the caller aborts", async () => {
    let release: (() => void) | undefined
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: token\ndata: {"text":"Hi"}\n\n'))
        release = () => controller.close()
      },
    })
    const controller = new AbortController()
    const pending = readPlaygroundStream(new Response(stream), controller.signal, () => undefined)
    controller.abort()
    await pending
    try {
      release?.()
    } catch {
      // Cancelling the reader already closed the stream.
    }
  })
})

describe("AI Playground", () => {
  it("streams a simulated reply and keeps the conversation", async () => {
    const user = userEvent.setup()
    renderWithProviders(<PlaygroundScreen />)

    expect(await screen.findByRole("heading", { name: "AI Playground" })).toBeInTheDocument()
    await user.type(screen.getByLabelText("Message"), "Search the handbook")
    await user.click(screen.getByRole("button", { name: "Send" }))

    await waitFor(() => {
      expect(screen.getByText(/not a live provider/)).toBeInTheDocument()
      expect(screen.getByText("Simulated response", { exact: true })).toBeInTheDocument()
      expect(screen.getByLabelText("Tool workspace.lookup")).toBeInTheDocument()
    })

    const listed = await listPlaygroundConversations()
    expect(listed.conversations.some((conversation) => conversation.title.includes("Search the handbook"))).toBe(true)
  })

  it("shows the simulated rate limit without writing a conversation", async () => {
    const user = userEvent.setup()
    renderWithProviders(<PlaygroundScreen />)
    await screen.findByRole("heading", { name: "AI Playground" })
    await user.type(screen.getByLabelText("Message"), "rate limit this turn")
    await user.click(screen.getByRole("button", { name: "Send" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/rate limit/i)
    const listed = await listPlaygroundConversations()
    expect(listed.conversations).toHaveLength(0)
  })
})

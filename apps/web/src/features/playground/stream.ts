import type { PlaygroundCitation, PlaygroundToolCall, PlaygroundUsage } from "@/features/playground/types"

export type PlaygroundStreamEvent =
  | { event: "token"; data: { text: string } }
  | { event: "tool"; data: PlaygroundToolCall }
  | { event: "citation"; data: PlaygroundCitation }
  | { event: "done"; data: { simulated: true; latencyMs: number; usage: PlaygroundUsage; messageId: string | null } }

export async function readPlaygroundStream(
  response: Response,
  signal: AbortSignal,
  onEvent: (event: PlaygroundStreamEvent) => void,
) {
  if (!response.body) throw new Error("The event stream has no body.")
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const emit = (block: string) => {
    const eventLine = block.split("\n").find((line) => line.startsWith("event:"))
    const dataLine = block.split("\n").find((line) => line.startsWith("data:"))
    if (!eventLine || !dataLine) return
    const event = eventLine.slice(6).trim()
    const data = JSON.parse(dataLine.slice(5).trim()) as PlaygroundStreamEvent["data"]
    if (event === "token" || event === "tool" || event === "citation" || event === "done") {
      onEvent({ event, data } as PlaygroundStreamEvent)
    }
  }

  const stop = () => {
    void reader.cancel()
  }
  signal.addEventListener("abort", stop)

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split("\n\n")
      buffer = blocks.pop() ?? ""
      for (const block of blocks) emit(block)
    }
    if (!signal.aborted && buffer.trim()) emit(buffer)
  } catch (error) {
    if (!signal.aborted) throw error
  } finally {
    signal.removeEventListener("abort", stop)
    reader.releaseLock()
  }
}

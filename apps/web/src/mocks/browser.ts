import { handlers } from "@/mocks/handlers"

export async function startMockWorker() {
  const { setupWorker } = await import("msw/browser")
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledFrame: "bypass",
    quiet: true,
  })
}

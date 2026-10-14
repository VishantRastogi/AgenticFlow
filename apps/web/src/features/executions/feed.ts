export type FeedHandle = { cancel: () => void }

export function createPollingFeed<T>(options: {
  poll: () => Promise<T>
  intervalMs: number
  isTerminal: (value: T) => boolean
  schedule?: (callback: () => void, delayMs: number) => FeedHandle
}) {
  const schedule =
    options.schedule ??
    ((callback, delayMs) => {
      const id = setTimeout(callback, delayMs)
      return { cancel: () => clearTimeout(id) }
    })

  return {
    start(listener: (value: T) => void, onError: (error: unknown) => void) {
      let stopped = false
      let timer: FeedHandle | null = null
      const stop = () => {
        stopped = true
        timer?.cancel()
      }
      const run = async () => {
        try {
          const value = await options.poll()
          if (stopped) return
          listener(value)
          if (options.isTerminal(value)) {
            stop()
            return
          }
          timer?.cancel()
          timer = schedule(() => {
            void run()
          }, options.intervalMs)
        } catch (error) {
          if (!stopped) onError(error)
          stop()
        }
      }
      void run()
      return stop
    },
  }
}

export function formatTimestamp(iso: string) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(new Date(iso))

  return `${formatted} UTC`
}

export function formatDuration(ms: number | null) {
  if (ms === null) return "—"
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function formatPercent(rate: number | null) {
  if (rate === null) return "—"
  return `${(rate * 100).toFixed(1)}%`
}

export function formatSeconds(ms: number | null) {
  if (ms === null) return "—"
  return `${(ms / 1000).toFixed(1)} s`
}

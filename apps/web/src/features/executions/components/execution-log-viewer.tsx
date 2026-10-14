"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { filterLogs, logsAsText } from "@/features/executions/project"
import type { ExecutionLog, LogSeverity } from "@/features/executions/types"
import { formatTimestamp } from "@/features/dashboard/format"
import { motionTransition } from "@/lib/motion"

const severities = ["all", "debug", "info", "warn", "error"] as const

const severityClass = {
  debug: "text-muted-foreground",
  info: "text-highlight",
  warn: "text-amber-800 dark:text-amber-100",
  error: "text-destructive",
} as const

export function ExecutionLogViewer({ executionId, logs }: { executionId: string; logs: ExecutionLog[] }) {
  const [severity, setSeverity] = useState<(typeof severities)[number]>("all")
  const [q, setQ] = useState("")
  const [notice, setNotice] = useState("")
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  const visible = filterLogs(logs, severity, q)

  async function copyLogs() {
    const text = logsAsText(visible)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement("textarea")
      area.value = text
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.left = "-9999px"
      document.body.append(area)
      area.select()
      const copied = document.execCommand("copy")
      area.remove()
      if (!copied) {
        setNotice("The browser blocked clipboard access.")
        return
      }
    }
    setNotice(visible.length === 0 ? "Nothing to copy." : `Copied ${visible.length} log lines.`)
  }

  function exportLogs() {
    const blob = new Blob([JSON.stringify(visible, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${executionId}-logs.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice(`Exported ${visible.length} log lines.`)
  }

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-medium">Logs</h2>
          <p className="mt-1 text-sm text-muted-foreground">Timestamps stay on the simulated clock. Filter, copy, or export the visible lines.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void copyLogs()} disabled={visible.length === 0}>
            Copy
          </Button>
          <Button type="button" variant="outline" onClick={exportLogs} disabled={visible.length === 0}>
            Export
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="grid gap-1 text-xs text-muted-foreground sm:min-w-40">
          Severity
          <select
            aria-label="Log severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as "all" | LogSeverity)}
            className="h-11 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground lg:h-8"
          >
            {severities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid flex-1 gap-1 text-xs text-muted-foreground">
          Filter logs
          <Input aria-label="Filter logs" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Message" />
        </label>
      </div>
      <p role="status" className="mt-2 text-xs text-muted-foreground">
        {notice || `${visible.length} lines`}
      </p>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No log lines match this filter.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {visible.map((log, index) => (
            <motion.li
              key={log.id}
              className="rounded-lg bg-background px-3 py-2 font-mono text-xs leading-5 ring-1 ring-foreground/10"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...motionTransition(reduced), delay: reduced ? 0 : Math.min(index, 6) * 0.04 }}
            >
              <span className="text-muted-foreground">{formatTimestamp(log.at)}</span>{" "}
              <span className={severityClass[log.severity]}>{log.severity}</span> {log.message}
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  )
}

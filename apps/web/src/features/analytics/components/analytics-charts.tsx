"use client"

import { useReducedMotion } from "framer-motion"
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { AnalyticsSnapshot } from "@/features/analytics/types"

const outcomeColor = {
  succeeded: "var(--primary)",
  failed: "var(--destructive)",
  cancelled: "var(--muted-foreground)",
} as const

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label ? <p className="mb-1 font-medium text-foreground">{label}</p> : null}
      {payload.map((item) => (
        <p key={`${item.name}-${item.value}`} className="text-muted-foreground">
          {item.name}: <span className="font-mono text-foreground">{item.value}</span>
        </p>
      ))}
    </div>
  )
}

export function ThroughputChart({ data }: { data: AnalyticsSnapshot["throughput"] }) {
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: 256 }}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="analyticsThroughput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <YAxis allowDecimals={false} width={32} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="executions" name="Runs" stroke="var(--primary)" strokeWidth={2} fill="url(#analyticsThroughput)" isAnimationActive={!reduced} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function OutcomeDonut({ data }: { data: AnalyticsSnapshot["outcomes"] }) {
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  const slices = data.filter((item) => item.count > 0)
  if (slices.length === 0) return <p className="text-sm text-muted-foreground">No finished or cancelled runs in this window.</p>
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 208 }}>
        <PieChart>
          <Pie data={slices} dataKey="count" nameKey="outcome" innerRadius={52} outerRadius={76} paddingAngle={2} isAnimationActive={!reduced}>
            {slices.map((slice) => (
              <Cell key={slice.outcome} fill={outcomeColor[slice.outcome]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ExecutionHeatmap({ heatmap }: { heatmap: AnalyticsSnapshot["heatmap"] }) {
  return (
    <div className="overflow-x-auto" role="img" aria-label="Execution heatmap by day and hour">
      <div className="grid min-w-[720px] gap-1" style={{ gridTemplateColumns: `4.5rem repeat(24, minmax(0, 1fr))` }}>
        <span />
        {heatmap.hours.map((hour) => (
          <span key={hour} className="text-center font-mono text-[10px] text-muted-foreground">
            {String(hour).padStart(2, "0")}
          </span>
        ))}
        {heatmap.days.map((day) => (
          <div key={day} className="contents">
            <span className="font-mono text-[10px] text-muted-foreground">{day.slice(5)}</span>
            {heatmap.hours.map((hour) => {
              const cell = heatmap.cells.find((item) => item.day === day && item.hour === hour)
              const count = cell?.count ?? 0
              const strength = heatmap.max === 0 ? 0 : count / heatmap.max
              return (
                <span
                  key={`${day}-${hour}`}
                  title={`${day} ${String(hour).padStart(2, "0")}:00 UTC · ${count} runs`}
                  className="h-4 rounded-sm bg-primary"
                  style={{ opacity: count === 0 ? 0.08 : 0.2 + strength * 0.8 }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

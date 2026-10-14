"use client"

import { useReducedMotion } from "framer-motion"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { AgentStatus, StatusPoint, TrendPoint, VolumePoint } from "@/features/dashboard/types"

const statusLabel: Record<AgentStatus, string> = {
  active: "Active",
  idle: "Idle",
  paused: "Paused",
  error: "Error",
}

const statusColor: Record<AgentStatus, string> = {
  active: "var(--primary)",
  idle: "var(--highlight)",
  paused: "var(--muted-foreground)",
  error: "var(--destructive)",
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
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

export function ExecutionVolumeChart({ data }: { data: VolumePoint[] }) {
  const reduced = useReducedMotion() === true

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 256 }}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="executionVolumeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.38} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <YAxis allowDecimals={false} width={32} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--highlight)", strokeOpacity: 0.45 }} />
          <Area
            type="monotone"
            dataKey="executions"
            name="Executions"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#executionVolumeFill)"
            isAnimationActive={!reduced}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AgentStatusChart({ data }: { data: StatusPoint[] }) {
  const reduced = useReducedMotion() === true
  const points = data
    .filter((point) => point.count > 0)
    .map((point) => ({ ...point, name: statusLabel[point.status] }))

  return (
    <div className="flex flex-col gap-3">
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 208 }}>
          <PieChart>
            <Pie data={points} dataKey="count" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={3} isAnimationActive={!reduced}>
              {points.map((point) => (
                <Cell key={point.status} fill={statusColor[point.status]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {data.map((point) => (
          <li key={point.status} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: statusColor[point.status] }} />
              {statusLabel[point.status]}
            </span>
            <span className="font-mono text-foreground">{point.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ExecutionTrendChart({ data }: { data: TrendPoint[] }) {
  const reduced = useReducedMotion() === true

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 256 }}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <YAxis allowDecimals={false} width={32} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="succeeded" name="Succeeded" stroke="var(--highlight)" strokeWidth={2} dot={false} isAnimationActive={!reduced} />
          <Line type="monotone" dataKey="failed" name="Failed" stroke="var(--destructive)" strokeWidth={2} dot={false} isAnimationActive={!reduced} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

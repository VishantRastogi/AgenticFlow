import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Bot,
  ChartColumn,
  GitBranch,
  LayoutDashboard,
  Rocket,
  ScrollText,
  Settings,
  Waypoints,
} from "lucide-react"

export type ModuleKey =
  | "dashboard"
  | "overview"
  | "agents"
  | "workflows"
  | "executions"
  | "analytics"
  | "deployments"
  | "audit-logs"
  | "settings"

export type ModuleDefinition = {
  key: ModuleKey
  href: string
  title: string
  description: string
  icon: LucideIcon
  keywords: string
  emptyTitle?: string
  emptyDescription?: string
  action?: {
    label: string
    reason: string
  }
  chart?: {
    title: string
    description: string
  }
}

export const modules: Record<ModuleKey, ModuleDefinition> = {
  dashboard: {
    key: "dashboard",
    href: "/dashboard",
    title: "Dashboard",
    description: "Command center for agents, executions, and runtime health.",
    icon: Activity,
    keywords: "command center metrics health live runs",
  },
  overview: {
    key: "overview",
    href: "/overview",
    title: "Overview",
    description:
      "A summary of this workspace appears here once agents and workflows are connected.",
    icon: LayoutDashboard,
    keywords: "home dashboard mission control",
    emptyTitle: "Workspace is quiet",
    emptyDescription:
      "There are no agents, workflows, or executions to summarize. This view stays empty until those services are connected.",
    action: {
      label: "New agent",
      reason: "Creating agents is unavailable until the agents service is connected.",
    },
  },
  agents: {
    key: "agents",
    href: "/agents",
    title: "Agents",
    description: "Create, inspect, and run the agents in this workspace.",
    icon: Bot,
    keywords: "bots workers assistants studio",
  },
  workflows: {
    key: "workflows",
    href: "/workflows",
    title: "Workflows",
    description: "Draft and publish workflows on the canvas.",
    icon: GitBranch,
    keywords: "graphs canvas pipelines editor",
  },
  executions: {
    key: "executions",
    href: "/executions",
    title: "Executions",
    description: "Search run history, logs, and simulated job progress.",
    icon: Waypoints,
    keywords: "runs jobs history logs",
  },
  analytics: {
    key: "analytics",
    href: "/analytics",
    title: "Analytics",
    description: "Throughput, latency, tokens, and cost derived from execution records.",
    icon: ChartColumn,
    keywords: "metrics charts performance tokens cost",
  },
  deployments: {
    key: "deployments",
    href: "/deployments",
    title: "Deployments",
    description: "Environment health, releases, and simulated rollbacks.",
    icon: Rocket,
    keywords: "releases environments ship rollback",
  },
  "audit-logs": {
    key: "audit-logs",
    href: "/audit-logs",
    title: "Audit Logs",
    description: "Search workspace changes recorded by the mock API.",
    icon: ScrollText,
    keywords: "security history trail events",
  },
  settings: {
    key: "settings",
    href: "/settings",
    title: "Settings",
    description: "Organization, members, theme, and local integration records.",
    icon: Settings,
    keywords: "preferences theme account workspace",
  },
}

export const moduleOrder = [
  "dashboard",
  "overview",
  "agents",
  "workflows",
  "executions",
  "analytics",
  "deployments",
  "audit-logs",
  "settings",
] as const satisfies readonly ModuleKey[]

export function moduleList() {
  return moduleOrder.map((key) => modules[key])
}

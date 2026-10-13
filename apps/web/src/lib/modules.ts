import type { LucideIcon } from "lucide-react"
import {
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
    description: "Define and supervise the agents that run in this workspace.",
    icon: Bot,
    keywords: "bots workers assistants",
    emptyTitle: "No agents yet",
    emptyDescription:
      "Agent definitions will show up here when the agents service is connected.",
    action: {
      label: "New agent",
      reason: "Creating agents is unavailable until the agents service is connected.",
    },
  },
  workflows: {
    key: "workflows",
    href: "/workflows",
    title: "Workflows",
    description: "Orchestrate how agents hand work to each other.",
    icon: GitBranch,
    keywords: "graphs canvas pipelines",
    emptyTitle: "No workflows yet",
    emptyDescription:
      "The orchestration canvas is unavailable until the workflow service is connected.",
    action: {
      label: "New workflow",
      reason: "Creating workflows is unavailable until the workflow service is connected.",
    },
  },
  executions: {
    key: "executions",
    href: "/executions",
    title: "Executions",
    description: "Inspect runs after an execution service is connected.",
    icon: Waypoints,
    keywords: "runs jobs history",
    emptyTitle: "No executions yet",
    emptyDescription:
      "Runs will be listed here when an execution service is connected.",
    action: {
      label: "Run workflow",
      reason: "Runs are unavailable until the execution service is connected.",
    },
  },
  analytics: {
    key: "analytics",
    href: "/analytics",
    title: "Analytics",
    description: "Performance series for this workspace will render in this view.",
    icon: ChartColumn,
    keywords: "metrics charts performance",
    action: {
      label: "Export",
      reason: "Exports are unavailable until analytics is connected.",
    },
    chart: {
      title: "Workspace series",
      description: "Charts stay empty until an analytics source is connected.",
    },
  },
  deployments: {
    key: "deployments",
    href: "/deployments",
    title: "Deployments",
    description: "Release targets for agents and workflows.",
    icon: Rocket,
    keywords: "releases environments ship",
    emptyTitle: "No deployments yet",
    emptyDescription:
      "Deployment targets will appear here when the deployment service is connected.",
    action: {
      label: "Deploy",
      reason: "Deploys are unavailable until the deployment service is connected.",
    },
  },
  "audit-logs": {
    key: "audit-logs",
    href: "/audit-logs",
    title: "Audit Logs",
    description: "A record of workspace activity once the audit service is connected.",
    icon: ScrollText,
    keywords: "security history trail events",
    emptyTitle: "No audit events yet",
    emptyDescription:
      "Audit events will appear here when the audit log service is connected.",
    action: {
      label: "Export",
      reason: "Exports are unavailable until the audit log service is connected.",
    },
  },
  settings: {
    key: "settings",
    href: "/settings",
    title: "Settings",
    description: "Browser preferences for this Mission Control shell.",
    icon: Settings,
    keywords: "preferences theme account workspace",
  },
}

export const moduleOrder = [
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

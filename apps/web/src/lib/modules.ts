import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Bot,
  ChartColumn,
  Database,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Library,
  Rocket,
  ScrollText,
  Settings,
  Sparkles,
  Waypoints,
} from "lucide-react"

export type ModuleKey =
  | "dashboard"
  | "overview"
  | "agents"
  | "playground"
  | "knowledge-bases"
  | "rag-studio"
  | "workflows"
  | "executions"
  | "evaluations"
  | "analytics"
  | "deployments"
  | "audit-logs"
  | "settings"

export type ModuleSectionId = "workspace" | "intelligence" | "operations" | "administration"

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
  playground: {
    key: "playground",
    href: "/playground",
    title: "AI Playground",
    description: "Try prompts against the simulated model gateway. Responses are not live provider output.",
    icon: Sparkles,
    keywords: "chat prompt model streaming playground",
  },
  "knowledge-bases": {
    key: "knowledge-bases",
    href: "/knowledge-bases",
    title: "Knowledge Bases",
    description: "Document collections for retrieval will be managed here.",
    icon: Library,
    keywords: "documents ingestion embeddings knowledge",
    emptyTitle: "Knowledge bases are not connected",
    emptyDescription:
      "This workspace has no knowledge base records yet. Creating and ingesting documents waits for the knowledge API.",
  },
  "rag-studio": {
    key: "rag-studio",
    href: "/rag-studio",
    title: "RAG Studio",
    description: "Retrieval experiments will run against a knowledge base.",
    icon: Database,
    keywords: "retrieval search chunks rag",
    emptyTitle: "Retrieval studio is not connected",
    emptyDescription:
      "Ranked chunks and grounded answers appear here after the retrieval API is connected. No scores are invented on this screen.",
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
  evaluations: {
    key: "evaluations",
    href: "/evaluations",
    title: "Evaluations",
    description: "Dataset runs and simulated quality scores will be compared here.",
    icon: FlaskConical,
    keywords: "eval tests groundedness quality",
    emptyTitle: "Evaluations are not connected",
    emptyDescription:
      "Test cases and score history stay empty until the evaluation API is connected. This screen does not invent pass or fail results.",
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

export const moduleSections: readonly {
  id: ModuleSectionId
  title: string
  keys: readonly ModuleKey[]
}[] = [
  { id: "workspace", title: "Workspace", keys: ["overview", "dashboard", "agents"] },
  { id: "intelligence", title: "AI Intelligence", keys: ["playground", "knowledge-bases", "rag-studio"] },
  { id: "operations", title: "Operations", keys: ["workflows", "executions", "evaluations", "analytics", "deployments"] },
  { id: "administration", title: "Administration", keys: ["audit-logs", "settings"] },
]

export const moduleOrder = moduleSections.flatMap((section) => section.keys)

export function moduleList() {
  return moduleOrder.map((key) => modules[key])
}

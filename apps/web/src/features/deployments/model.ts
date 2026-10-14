import { isSuccessfulExecution, type AgentRecord, type ExecutionRecord, type RuntimeEnvironment, type RuntimeHealth } from "@/features/dashboard/types"
import { percentile } from "@/features/dashboard/derive"

export const DEPLOYMENT_ENVIRONMENTS = ["development", "staging", "production"] as const
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number]
export type ReleaseStatus = "active" | "superseded" | "failed"

export type Release = {
  id: string
  environment: DeploymentEnvironment
  version: string
  status: ReleaseStatus
  createdAt: string
  note: string
}

export type PipelineFrame = {
  label: string
  state: "succeeded" | "failed" | "skipped"
}

export const PIPELINE_STEPS = ["Build", "Validate", "Deploy", "Health Check", "Active"] as const

export function isDeploymentEnvironment(value: string): value is DeploymentEnvironment {
  return DEPLOYMENT_ENVIRONMENTS.includes(value as DeploymentEnvironment)
}

export function runtimeForDeployment(environment: DeploymentEnvironment): RuntimeEnvironment {
  if (environment === "development") return "sandbox"
  return environment
}

export function nextReleaseVersion(version: string) {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((part) => Number(part) || 0)
  return `${major}.${minor}.${patch + 1}`
}

export function previousReleaseVersion(version: string) {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((part) => Number(part) || 0)
  if (patch > 0) return `${major}.${minor}.${patch - 1}`
  if (minor > 0) return `${major}.${minor - 1}.0`
  return "0.0.0"
}

export type EnvironmentHealth = {
  status: RuntimeHealth
  summary: string
  runtime: RuntimeEnvironment
  agentCount: number
  successRate: number | null
  p95DurationMs: number | null
}

export function deriveEnvironmentHealth(agents: AgentRecord[], executions: ExecutionRecord[], environment: DeploymentEnvironment): EnvironmentHealth {
  const runtime = runtimeForDeployment(environment)
  const scopedAgents = agents.filter((agent) => agent.environment === runtime)
  const scoped = executions.filter((execution) => execution.environment === runtime)
  const finished = scoped.filter((execution) => isSuccessfulExecution(execution.status) || execution.status === "failed")
  const succeeded = finished.filter((execution) => isSuccessfulExecution(execution.status))
  const durations = finished.flatMap((execution) => (execution.durationMs === null ? [] : [execution.durationMs]))
  const successRate = finished.length === 0 ? null : succeeded.length / finished.length
  const errorAgents = scopedAgents.filter((agent) => agent.status === "error").length
  let status: RuntimeHealth = "healthy"
  if (errorAgents > 0 || (successRate !== null && successRate < 0.8)) status = "critical"
  else if (scopedAgents.some((agent) => agent.status === "paused") || (successRate !== null && successRate < 0.95)) status = "degraded"
  const agentLabel = scopedAgents.length === 1 ? "agent" : "agents"
  const summary =
    scopedAgents.length === 0
      ? "No agents are assigned to this environment."
      : errorAgents > 0
        ? `${errorAgents} agent${errorAgents === 1 ? "" : "s"} in error.`
        : successRate === null
          ? `${scopedAgents.length} ${agentLabel}. No finished runs yet.`
          : `${scopedAgents.length} ${agentLabel}. Success rate ${(successRate * 100).toFixed(1)}%.`
  return {
    status,
    summary,
    runtime,
    agentCount: scopedAgents.length,
    successRate,
    p95DurationMs: percentile(durations, 0.95),
  }
}

export function pipelineFrames(health: RuntimeHealth): PipelineFrame[] {
  return PIPELINE_STEPS.map((label, index) => {
    if (health === "critical" && index === 3) return { label, state: "failed" }
    if (health === "critical" && index > 3) return { label, state: "skipped" }
    return { label, state: "succeeded" }
  })
}

export function versionRank(version: string) {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((part) => Number(part) || 0)
  return major * 1_000_000 + minor * 1_000 + patch
}

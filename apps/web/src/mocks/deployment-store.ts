import { SIMULATED_NOW } from "@/mocks/fixtures/operations"
import { listAgents, listExecutions } from "@/mocks/operations-store"
import {
  deriveEnvironmentHealth,
  isDeploymentEnvironment,
  nextReleaseVersion,
  pipelineFrames,
  previousReleaseVersion,
  runtimeForDeployment,
  versionRank,
  type DeploymentEnvironment,
  type Release,
} from "@/features/deployments/model"

const STORAGE_KEY = "agentflow-mock-deployments"

type Overlay = {
  sequence: number
  releases: Release[]
}

function emptyOverlay(): Overlay {
  return { sequence: 0, releases: [] }
}

function readOverlay(): Overlay {
  if (typeof localStorage === "undefined") return emptyOverlay()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyOverlay()
  try {
    const parsed = JSON.parse(raw) as Partial<Overlay>
    if (!parsed || !Array.isArray(parsed.releases) || typeof parsed.sequence !== "number") return emptyOverlay()
    return { sequence: parsed.sequence, releases: parsed.releases }
  } catch {
    return emptyOverlay()
  }
}

function writeOverlay(overlay: Overlay) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay))
}

function seedReleases(environment: DeploymentEnvironment): Release[] {
  const agents = listAgents().filter((agent) => agent.environment === runtimeForDeployment(environment))
  const ranked = [...agents].sort((a, b) => versionRank(b.version) - versionRank(a.version) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const current = ranked[0]
  const version = current?.version ?? "0.0.0"
  const createdAt = current?.updatedAt ?? SIMULATED_NOW
  return [
    {
      id: `rel_${environment}_current`,
      environment,
      version,
      status: "active",
      createdAt,
      note: current ? `Derived from ${current.name} ${current.version}.` : "No agents are assigned to this environment.",
    },
    {
      id: `rel_${environment}_previous`,
      environment,
      version: previousReleaseVersion(version),
      status: "superseded",
      createdAt,
      note: "Previous release derived from the current agent version.",
    },
  ]
}

export function listReleases(environment: DeploymentEnvironment) {
  const overlay = readOverlay().releases.filter((release) => release.environment === environment)
  const seed = seedReleases(environment)
  const overlayActive = overlay.some((release) => release.status === "active")
  const base = overlayActive ? seed.map((release) => (release.status === "active" ? { ...release, status: "superseded" as const } : release)) : seed
  return [...overlay, ...base].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || versionRank(b.version) - versionRank(a.version))
}

export function activeRelease(environment: DeploymentEnvironment) {
  return listReleases(environment).find((release) => release.status === "active") ?? listReleases(environment)[0]
}

export function deploymentSnapshot(environment: DeploymentEnvironment) {
  const agents = listAgents()
  const executions = listExecutions()
  const health = deriveEnvironmentHealth(agents, executions, environment)
  return {
    simulated: true as const,
    environment,
    health,
    active: activeRelease(environment),
    releases: listReleases(environment),
  }
}

export function listDeploymentSnapshots() {
  return (["development", "staging", "production"] as const).map((environment) => deploymentSnapshot(environment))
}

export function deployEnvironment(environment: DeploymentEnvironment) {
  const snapshot = deploymentSnapshot(environment)
  const failed = snapshot.health.status === "critical"
  const overlay = readOverlay()
  overlay.sequence += 1
  if (!failed) {
    overlay.releases = overlay.releases.map((release) =>
      release.environment === environment && release.status === "active" ? { ...release, status: "superseded" } : release,
    )
  }
  const release: Release = {
    id: `rel_${environment}_${overlay.sequence}`,
    environment,
    version: failed ? snapshot.active.version : nextReleaseVersion(snapshot.active.version),
    status: failed ? "failed" : "active",
    createdAt: SIMULATED_NOW,
    note: failed
      ? "Simulated health check failed. The active release was left in place."
      : "Simulated pipeline finished. This release was saved in the mock workspace.",
  }
  overlay.releases.unshift(release)
  writeOverlay(overlay)
  return { release, health: snapshot.health, frames: pipelineFrames(snapshot.health.status), simulated: true as const }
}

export function rollbackEnvironment(environment: DeploymentEnvironment): { error: "unavailable"; reason: string } | { release: Release; simulated: true } {
  const releases = listReleases(environment)
  const previous = releases.find((release) => release.status === "superseded")
  if (!previous) return { error: "unavailable" as const, reason: "There is no previous release to restore." }
  const overlay = readOverlay()
  overlay.sequence += 1
  overlay.releases = overlay.releases.map((release) =>
    release.environment === environment && release.status === "active" ? { ...release, status: "superseded" } : release,
  )
  const release: Release = {
    id: `rel_${environment}_${overlay.sequence}`,
    environment,
    version: previous.version,
    status: "active",
    createdAt: SIMULATED_NOW,
    note: `Rolled back to ${previous.version}. Saved in the mock workspace.`,
  }
  overlay.releases.unshift(release)
  writeOverlay(overlay)
  return { release, simulated: true as const }
}

export function requireDeploymentEnvironment(value: string) {
  if (!isDeploymentEnvironment(value)) return null
  return value
}

import type { DeploymentEnvironment, EnvironmentHealth, PipelineFrame, Release } from "@/features/deployments/model"
import { operationsRequest } from "@/features/operations/request"

const messages = {
  network: "The deployment service could not be reached.",
  unavailable: "The real deployment API is unavailable. Mock mode was not used.",
}

export type DeploymentSnapshot = {
  simulated: true
  environment: DeploymentEnvironment
  health: EnvironmentHealth
  active: Release
  releases: Release[]
}

export type DeployResult = {
  simulated: true
  release: Release
  health: EnvironmentHealth
  frames: PipelineFrame[]
}

export function listDeployments() {
  return operationsRequest<{ simulated: true; environments: DeploymentSnapshot[] }>("/api/deployments", "GET", messages)
}

export function getDeployment(id: string) {
  return operationsRequest<DeploymentSnapshot>(`/api/deployments/${id}`, "GET", messages)
}

export function deployRelease(id: string) {
  return operationsRequest<DeployResult>(`/api/deployments/${id}/deploy`, "POST", messages)
}

export function rollbackRelease(id: string) {
  return operationsRequest<{ simulated: true; release: Release }>(`/api/deployments/${id}/rollback`, "POST", messages)
}

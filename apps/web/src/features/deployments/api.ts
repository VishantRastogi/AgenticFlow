import type { DeploymentEnvironment, EnvironmentHealth, PipelineFrame, Release } from "@/features/deployments/model"
import { operationsRequest } from "@/features/operations/request"

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
  return operationsRequest<{ simulated: true; environments: DeploymentSnapshot[] }>("deployments.list")
}

export function getDeployment(id: string) {
  return operationsRequest<DeploymentSnapshot>("deployments.get", { params: { id } })
}

export function deployRelease(id: string) {
  return operationsRequest<DeployResult>("deployments.deploy", { params: { id } })
}

export function rollbackRelease(id: string) {
  return operationsRequest<{ simulated: true; release: Release }>("deployments.rollback", { params: { id } })
}

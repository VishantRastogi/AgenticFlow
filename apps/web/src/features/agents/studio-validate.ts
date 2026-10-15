import { agentModel } from "@/features/agents/studio-catalog"
import type { AgentConfiguration, AgentKnowledgeBinding, AgentToolDefinition } from "@/features/agents/studio-types"

function schemaObject(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function assessAgentConfiguration(input: AgentConfiguration): { ok: true; configuration: AgentConfiguration } | { ok: false; message: string } {
  const config = structuredClone(input)
  const model = agentModel(config.model?.model)
  if (!model || model.provider !== config.model.provider) return { ok: false, message: "Choose a model offered by that provider." }
  if (typeof config.model.temperature !== "number" || config.model.temperature < 0 || config.model.temperature > model.maxTemperature) {
    return { ok: false, message: `${model.label} accepts a temperature from 0 to ${model.maxTemperature}.` }
  }
  if (!Number.isInteger(config.model.maxOutputTokens) || config.model.maxOutputTokens < 1 || config.model.maxOutputTokens > model.maxOutputTokens) {
    return { ok: false, message: `${model.label} accepts at most ${model.maxOutputTokens} output tokens.` }
  }
  if (!model.toolCalling.includes(config.model.toolCalling)) {
    return { ok: false, message: `${model.label} does not support ${config.model.toolCalling} tool calling.` }
  }
  if (config.model.structuredOutput && !model.structuredOutput) {
    return { ok: false, message: `${model.label} does not support structured output.` }
  }
  if (config.model.structuredOutput && !schemaObject(config.model.outputSchema)) {
    return { ok: false, message: "Structured output needs a JSON object schema." }
  }
  if (!config.model.structuredOutput) config.model.outputSchema = null
  if (config.model.systemPrompt.trim().length < 8 || config.model.systemPrompt.length > 2000) {
    return { ok: false, message: "Enter a system prompt between 8 and 2000 characters." }
  }

  const policy = config.execution
  if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs < 1000 || policy.timeoutMs > 300000) {
    return { ok: false, message: "Timeout must be between 1 second and 5 minutes." }
  }
  if (!Number.isInteger(policy.maxDurationMs) || policy.maxDurationMs < policy.timeoutMs || policy.maxDurationMs > 300000) {
    return { ok: false, message: "The execution budget duration must cover the timeout and stay within 5 minutes." }
  }
  if (typeof policy.budgetUsd !== "number" || policy.budgetUsd < 0 || policy.budgetUsd > 100) {
    return { ok: false, message: "The cost budget must be from 0 to 100 USD." }
  }
  if (!Number.isInteger(policy.maxSteps) || policy.maxSteps < 1 || policy.maxSteps > 20) {
    return { ok: false, message: "Maximum steps must be an integer from 1 to 20." }
  }
  if (!Number.isInteger(policy.maxToolCalls) || policy.maxToolCalls < 0 || policy.maxToolCalls > 20) {
    return { ok: false, message: "Maximum tool calls must be an integer from 0 to 20." }
  }
  if (!Number.isInteger(policy.maxTokenBudget) || policy.maxTokenBudget < config.model.maxOutputTokens || policy.maxTokenBudget > 100000) {
    return { ok: false, message: "The token budget must cover the maximum output tokens." }
  }
  if (!["none", "fixed", "exponential"].includes(policy.retryPolicy)) return { ok: false, message: "Choose a retry policy." }

  if (!Array.isArray(config.knowledge) || config.knowledge.length > 8) return { ok: false, message: "Attach at most 8 knowledge bases." }
  for (const binding of config.knowledge) {
    const message = knowledgeError(binding)
    if (message) return { ok: false, message }
  }

  if (!Array.isArray(config.tools)) return { ok: false, message: "Tool configuration is missing." }
  const ids = new Set<string>()
  for (const item of config.tools) {
    const message = toolError(item, config)
    if (message) return { ok: false, message }
    if (ids.has(item.id)) return { ok: false, message: "Tool identifiers must be unique." }
    ids.add(item.id)
  }

  const memory = config.memory
  if (!["stateless", "conversation", "short_term", "long_term"].includes(memory.mode)) {
    return { ok: false, message: "Choose a memory mode." }
  }
  if (!Number.isInteger(memory.retentionDays) || memory.retentionDays < 0 || memory.retentionDays > 365) {
    return { ok: false, message: "Retention must be from 0 to 365 days." }
  }
  if (memory.mode === "stateless" && memory.retentionDays !== 0) {
    return { ok: false, message: "Stateless execution does not retain memory." }
  }

  const allowed = config.guardrails.allowedToolIds
  if (!Array.isArray(allowed) || allowed.some((id) => !ids.has(id))) {
    return { ok: false, message: "The allowed tool list can only name configured tools." }
  }
  if (config.tools.some((item) => item.enabled && !allowed.includes(item.id))) {
    return { ok: false, message: "An enabled tool must be on the allowed tool list." }
  }

  return { ok: true, configuration: config }
}

function knowledgeError(binding: AgentKnowledgeBinding) {
  if (!binding.knowledgeBaseId?.trim()) return "Choose a knowledge base."
  if (!["vector", "keyword", "hybrid"].includes(binding.strategy)) return "Choose a retrieval strategy."
  if (!Number.isInteger(binding.topK) || binding.topK < 1 || binding.topK > 20) return "Top K must be an integer from 1 to 20."
  if (typeof binding.scoreThreshold !== "number" || binding.scoreThreshold < 0 || binding.scoreThreshold > 1) {
    return "The score threshold must be between 0 and 1."
  }
  if (!Number.isInteger(binding.contextTokenBudget) || binding.contextTokenBudget < 64 || binding.contextTokenBudget > 8192) {
    return "The context budget must be an integer from 64 to 8192."
  }
  return null
}

function toolError(tool: AgentToolDefinition, config: AgentConfiguration) {
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(tool.id)) return "Tool identifiers use lowercase letters, numbers, and underscores."
  if (tool.name.trim().length < 2) return "Enter a tool name."
  if (!schemaObject(tool.inputSchema) || !schemaObject(tool.outputSchema)) return `${tool.name} needs JSON object schemas.`
  if (!Number.isInteger(tool.timeoutMs) || tool.timeoutMs < 100 || tool.timeoutMs > 60000) return `${tool.name} timeout must be from 100 ms to 60 seconds.`
  if (tool.permission !== "read" && tool.permission !== "side_effect") return `${tool.name} needs a permission.`
  if (tool.enabled && tool.permission === "side_effect" && config.guardrails.requireHumanApproval && !tool.requiresApproval) {
    return `${tool.name} performs a side effect and needs human approval.`
  }
  if (config.guardrails.enforceToolPermissions && tool.enabled && tool.permission === "side_effect" && !config.guardrails.allowedToolIds.includes(tool.id)) {
    return `${tool.name} is not on the allowed tool list.`
  }
  return null
}

export function compareConfigurations(left: AgentConfiguration, right: AgentConfiguration) {
  const changes: string[] = []
  if (left.model.model !== right.model.model) changes.push(`Model ${left.model.model} to ${right.model.model}`)
  if (left.model.temperature !== right.model.temperature) changes.push(`Temperature ${left.model.temperature} to ${right.model.temperature}`)
  if (left.model.toolCalling !== right.model.toolCalling) changes.push(`Tool calling ${left.model.toolCalling} to ${right.model.toolCalling}`)
  if (left.execution.maxSteps !== right.execution.maxSteps) changes.push(`Max steps ${left.execution.maxSteps} to ${right.execution.maxSteps}`)
  if (left.execution.budgetUsd !== right.execution.budgetUsd) changes.push(`Cost budget ${left.execution.budgetUsd} to ${right.execution.budgetUsd}`)
  if (JSON.stringify(left.knowledge) !== JSON.stringify(right.knowledge)) changes.push("Knowledge bindings differ")
  if (JSON.stringify(left.tools) !== JSON.stringify(right.tools)) changes.push("Tool configuration differs")
  if (left.memory.mode !== right.memory.mode) changes.push(`Memory ${left.memory.mode} to ${right.memory.mode}`)
  if (JSON.stringify(left.guardrails) !== JSON.stringify(right.guardrails)) changes.push("Guardrails differ")
  return changes.length > 0 ? changes : ["No configuration differences."]
}

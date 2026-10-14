import { z } from "zod"

const configurationField = z.string().trim().min(2, "Enter a JSON configuration.").refine((value) => {
  try {
    const parsed = JSON.parse(value) as unknown
    return Boolean(parsed) && typeof parsed === "object" && !Array.isArray(parsed)
  } catch {
    return false
  }
}, "Configuration must be a JSON object.")

export const agentFormSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(48, "Use 48 characters or fewer."),
  description: z.string().trim().min(8, "Describe the agent in at least 8 characters.").max(280, "Use 280 characters or fewer."),
  type: z.enum(["planner", "researcher", "operator", "reviewer"]),
  environment: z.enum(["production", "staging", "sandbox"]),
  timeoutMs: z.number({ error: "Enter a timeout in milliseconds." }).int().min(1000, "Timeout must be at least 1 second.").max(300000, "Timeout must be 5 minutes or less."),
  retryPolicy: z.enum(["none", "fixed", "exponential"]),
  version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, "Use a version like 1.0.0."),
  configuration: configurationField,
})

export const agentUpdateSchema = agentFormSchema.extend({
  status: z.enum(["active", "idle", "paused", "error"]),
})

export type AgentFormValues = z.infer<typeof agentFormSchema>
export type AgentUpdateValues = z.infer<typeof agentUpdateSchema>

export function parseConfiguration(value: string) {
  return JSON.parse(value) as Record<string, unknown>
}

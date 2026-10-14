import { z } from "zod"

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Enter an organization name.").max(80, "Use 80 characters or fewer."),
  slug: z
    .string()
    .trim()
    .min(2, "Enter a slug.")
    .max(48, "Use 48 characters or fewer.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
})

export const preferencesSchema = z.object({
  density: z.enum(["comfortable", "compact"]),
})

export const memberSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(80, "Use 80 characters or fewer."),
  email: z.string().trim().email("Enter a valid email."),
  role: z.enum(["admin", "operator", "viewer"]),
})

export const memberRoleSchema = z.object({
  role: z.enum(["admin", "operator", "viewer"]),
})

export const integrationSchema = z.object({
  name: z.string().trim().min(2, "Enter an integration name.").max(48, "Use 48 characters or fewer."),
  secret: z.string().trim().min(8, "Enter a secret of at least 8 characters.").max(120, "Use 120 characters or fewer."),
})

export type OrganizationInput = z.infer<typeof organizationSchema>
export type PreferencesInput = z.infer<typeof preferencesSchema>
export type MemberInput = z.infer<typeof memberSchema>
export type IntegrationInput = z.infer<typeof integrationSchema>

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the form and try again."
}

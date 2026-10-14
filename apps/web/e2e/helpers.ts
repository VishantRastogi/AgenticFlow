import { expect, type Page } from "@playwright/test"

export async function signIn(page: Page, next = "/overview") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await page.getByLabel("Email").fill("ada@agentflow.test")
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("orbit-7481")
  await page.getByRole("button", { name: "Sign in" }).click()
}

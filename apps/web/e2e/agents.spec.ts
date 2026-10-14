import { expect, test } from "@playwright/test"
import { signIn } from "./helpers"

test("creates an agent and keeps it after reload", async ({ page }) => {
  await signIn(page, "/agents")
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Atlas" })).toBeVisible()

  await page.getByRole("link", { name: "New agent" }).click()
  await expect(page.getByRole("heading", { name: "New agent" })).toBeVisible()
  await page.getByLabel("Name").fill("Relay")
  await page.getByLabel("Description").fill("Routes a checked handoff.")
  await page.getByRole("button", { name: "Create agent" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Relay" })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("heading", { level: 1, name: "Relay" })).toBeVisible()
})

import { expect, test } from "@playwright/test"
import { signIn } from "./helpers"

test("opens a recorded execution from history", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await signIn(page, "/executions")
  await expect(page.getByRole("heading", { level: 1, name: "Executions" })).toBeVisible()
  await expect(page.getByRole("table", { name: "Execution history" })).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 800 })
  const run = page.getByRole("link", { name: /^exe_/ }).first()
  const id = await run.innerText()
  await run.click()
  await expect(page.getByRole("heading", { level: 1, name: id })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Logs", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Traces" })).toBeVisible()
  await expect(page.getByText("Unknown").first()).toBeVisible()
})

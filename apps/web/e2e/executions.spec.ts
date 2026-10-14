import { expect, test } from "@playwright/test"
import { signIn } from "./helpers"

test("opens a recorded execution from history", async ({ page }) => {
  await signIn(page, "/executions")
  await expect(page.getByRole("heading", { level: 1, name: "Executions" })).toBeVisible()
  const run = page.getByRole("link", { name: /^exe_/ }).first()
  const id = await run.innerText()
  await run.click()
  await expect(page.getByRole("heading", { level: 1, name: id })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Logs" })).toBeVisible()
})

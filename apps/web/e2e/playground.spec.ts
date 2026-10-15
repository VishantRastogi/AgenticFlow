import { expect, test } from "@playwright/test"
import { signIn } from "./helpers"

test("sends a simulated playground message", async ({ page }) => {
  await signIn(page, "/playground")
  await expect(page.getByRole("heading", { level: 1, name: "AI Playground" })).toBeVisible()
  await expect(page.getByText(/not live model output/)).toBeVisible()
  await page.getByLabel("Message").fill("Search the handbook")
  await page.getByRole("button", { name: "Send" }).click()
  await expect(page.getByText(/not a live provider/)).toBeVisible()
  await expect(page.getByText("Simulated response", { exact: true })).toBeVisible()
})
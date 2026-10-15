import { expect, test } from "@playwright/test"
import { signIn } from "./helpers"

test("shows simulated knowledge and tool sections on a narrow agent page", async ({ page }) => {
  await signIn(page, "/agents/agt_cedar")
  await expect(page.getByRole("heading", { level: 1, name: "Cedar" })).toBeVisible()
  await page.getByRole("tab", { name: "Knowledge" }).click()
  await expect(page.getByText(/Simulated studio configuration/)).toBeVisible()
  await expect(page.getByLabel("Knowledge base")).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("tab", { name: "Tools" }).click()
  await expect(page.getByText("Read-only").first()).toBeVisible()
  await expect(page.getByText(/Credentials are not collected or stored/)).toBeVisible()
})

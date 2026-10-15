import { expect, test } from "@playwright/test"
import { signIn } from "./helpers"

test("edits a new workflow and reports the missing output", async ({ page }) => {
  await signIn(page, "/workflows/new")
  await expect(page.getByRole("heading", { name: "Untitled workflow" })).toBeVisible()
  await expect(page.getByText("Add an output so the workflow has a result.")).toBeVisible()

  await page.getByRole("button", { name: "Output Result" }).click()
  await expect(page.getByText("Output", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Add an output so the workflow has a result.")).toHaveCount(0)
})

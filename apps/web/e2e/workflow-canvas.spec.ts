import { expect, test } from "@playwright/test"
import { signIn } from "./helpers"

test("adds an LLM node and keeps the inspector usable on a narrow canvas", async ({ page }) => {
  await signIn(page, "/workflows/wf_draft_intake/edit")
  await expect(page.getByLabel("Workflow name")).toHaveValue("Draft intake")
  await page.getByRole("button", { name: "LLM Generation" }).click()
  await expect(page.getByLabel("Prompt template")).toBeVisible()
  await expect(page.getByLabel("Provider")).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("button", { name: "Nodes" }).click()
  await expect(page.getByRole("button", { name: "RAG Retrieval" })).toBeVisible()
})

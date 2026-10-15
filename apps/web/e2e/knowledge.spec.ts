import { expect, test } from "@playwright/test"
import { signIn } from "./helpers"

test("creates a knowledge base and stores a simulated document", async ({ page }) => {
  await signIn(page, "/knowledge-bases")
  await expect(page.getByRole("heading", { level: 1, name: "Knowledge Bases" })).toBeVisible()
  await page.getByRole("link", { name: "New knowledge base" }).click()
  await page.getByLabel("Name").fill("Handbook")
  await page.getByRole("button", { name: "Create knowledge base" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Handbook" })).toBeVisible()
  await expect(page.getByText(/no embeddings are computed/i)).toBeVisible()
  await page.getByLabel("Upload documents").setInputFiles({
    name: "notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# notes"),
  })
  await expect(page.getByRole("link", { name: "notes.md" })).toBeVisible()
  await page.getByRole("link", { name: "notes.md" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "notes.md" })).toBeVisible()
  await expect(page.getByText(/Simulated pipeline/)).toBeVisible()
})

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { renderWithProviders } from "@/test/render"

describe("theme switcher", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ""
  })

  it("persists light, dark, and system themes", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeToggle />)

    await user.click(screen.getByRole("button", { name: "Theme" }))
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }))

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark")
    })
    expect(localStorage.getItem("agentflow-theme")).toBe("dark")

    await user.click(screen.getByRole("button", { name: "Theme" }))
    await user.click(screen.getByRole("menuitemradio", { name: "Light" }))

    await waitFor(() => {
      expect(document.documentElement).not.toHaveClass("dark")
    })
    expect(localStorage.getItem("agentflow-theme")).toBe("light")

    await user.click(screen.getByRole("button", { name: "Theme" }))
    await user.click(screen.getByRole("menuitemradio", { name: "System" }))

    await waitFor(() => {
      expect(localStorage.getItem("agentflow-theme")).toBe("system")
    })
  })
})

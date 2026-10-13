import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SearchCommand } from "@/components/shared/search-command"
import { renderWithProviders } from "@/test/render"
import { useUiStore } from "@/stores/ui-store"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  usePathname: () => "/overview",
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

describe("command palette", () => {
  beforeEach(() => {
    push.mockReset()
    localStorage.clear()
    useUiStore.setState({
      sidebarCollapsed: false,
      commandOpen: false,
      mobileNavOpen: false,
      hydrated: true,
    })
  })

  it("opens with the keyboard shortcut and navigates", async () => {
    const user = userEvent.setup()
    renderWithProviders(<SearchCommand />)

    await user.keyboard("{Control>}k{/Control}")

    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeInTheDocument()

    await user.click(screen.getByRole("option", { name: "Workflows" }))

    expect(push).toHaveBeenCalledWith("/workflows")
    expect(useUiStore.getState().commandOpen).toBe(false)
  })
})

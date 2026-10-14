import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserMenu } from "@/components/shell/user-menu"
import { login } from "@/features/auth/api/client"
import { ApiError } from "@/features/auth/api/errors"
import { AuthGate } from "@/features/auth/components/auth-gate"
import { LoginForm } from "@/features/auth/components/login-form"
import { RegisterForm } from "@/features/auth/components/register-form"
import { expireMockSession, MOCK_NETWORK_EMAIL } from "@/mocks/store"
import { server } from "@/mocks/server"
import { renderWithProviders } from "@/test/render"

const navigation = vi.hoisted(() => ({
  pathname: "/overview",
  replace: vi.fn(),
  search: new URLSearchParams(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.search,
  useRouter: () => ({
    replace: navigation.replace,
    push: navigation.replace,
    refresh: vi.fn(),
  }),
}))

describe("authentication", () => {
  beforeEach(() => {
    navigation.pathname = "/overview"
    navigation.replace.mockReset()
    navigation.search = new URLSearchParams()
  })

  it("signs in and opens the requested console route", async () => {
    const user = userEvent.setup()
    navigation.pathname = "/login"
    navigation.search = new URLSearchParams("next=/workflows")
    renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText("Email"), "ada@agentflow.test")
    await user.type(screen.getByLabelText("Password"), "orbit-7481")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByRole("status")).toHaveTextContent("Signed in")
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/workflows")
    })
  })

  it("shows invalid credentials from the auth service", async () => {
    const user = userEvent.setup()
    navigation.pathname = "/login"
    renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText("Email"), "ada@agentflow.test")
    await user.type(screen.getByLabelText("Password"), "wrong-password")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.")
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it("shows a network failure without leaving the form", async () => {
    const user = userEvent.setup()
    navigation.pathname = "/login"
    renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText("Email"), MOCK_NETWORK_EMAIL)
    await user.type(screen.getByLabelText("Password"), "orbit-7481")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("The auth service could not be reached.")
  })

  it("creates an account and opens the console", async () => {
    const user = userEvent.setup()
    navigation.pathname = "/register"
    renderWithProviders(<RegisterForm />)

    await user.type(screen.getByLabelText("Name"), "Grace Hopper")
    await user.type(screen.getByLabelText("Email"), "grace@agentflow.test")
    await user.type(screen.getByLabelText("Password"), "orbit-7481")
    await user.type(screen.getByLabelText("Confirm password"), "orbit-7481")
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(await screen.findByRole("status")).toHaveTextContent("Account created")
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/overview")
    })
  })

  it("rejects a duplicate registration", async () => {
    const user = userEvent.setup()
    navigation.pathname = "/register"
    renderWithProviders(<RegisterForm />)

    await user.type(screen.getByLabelText("Name"), "Ada Lovelace")
    await user.type(screen.getByLabelText("Email"), "ada@agentflow.test")
    await user.type(screen.getByLabelText("Password"), "orbit-7481")
    await user.type(screen.getByLabelText("Confirm password"), "orbit-7481")
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists.")
  })

  it("signs out from the account menu", async () => {
    const user = userEvent.setup()
    await login({ email: "ada@agentflow.test", password: "orbit-7481" })
    renderWithProviders(<UserMenu />)

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Account menu" }))
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }))

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/login")
    })
    expect(localStorage.getItem("agentflow-auth-token")).toBeNull()
  })

  it("redirects an anonymous visit away from a protected route", async () => {
    navigation.pathname = "/overview"
    renderWithProviders(
      <AuthGate>
        <p>Protected console</p>
      </AuthGate>,
    )

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/login?next=%2Foverview")
    })
    expect(screen.queryByText("Protected console")).not.toBeInTheDocument()
  })

  it("sends an expired session back to sign in", async () => {
    const session = await login({ email: "ada@agentflow.test", password: "orbit-7481" })
    expireMockSession(session.token)
    navigation.pathname = "/agents"
    renderWithProviders(
      <AuthGate>
        <p>Protected console</p>
      </AuthGate>,
    )

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/login?next=%2Fagents&reason=expired")
    })
    expect(screen.queryByText("Protected console")).not.toBeInTheDocument()
  })

  it("fails real mode before any mock request when the API origin is missing", async () => {
    const previousMode = process.env.NEXT_PUBLIC_API_MODE
    const previousUrl = process.env.NEXT_PUBLIC_API_URL
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    process.env.NEXT_PUBLIC_API_MODE = "real"
    delete process.env.NEXT_PUBLIC_API_URL

    await expect(login({ email: "ada@agentflow.test", password: "orbit-7481" })).rejects.toEqual(
      expect.any(ApiError),
    )
    await expect(login({ email: "ada@agentflow.test", password: "orbit-7481" })).rejects.toMatchObject({
      code: "api_unavailable",
      message: expect.stringContaining("Mock mode was not used"),
    })
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    process.env.NEXT_PUBLIC_API_MODE = previousMode
    if (previousUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL
    } else {
      process.env.NEXT_PUBLIC_API_URL = previousUrl
    }
  })

  it("does not use the mock service when the real API cannot be reached", async () => {
    const previousMode = process.env.NEXT_PUBLIC_API_MODE
    const previousUrl = process.env.NEXT_PUBLIC_API_URL

    process.env.NEXT_PUBLIC_API_MODE = "real"
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:9"
    server.close()

    try {
      await expect(login({ email: "ada@agentflow.test", password: "orbit-7481" })).rejects.toMatchObject({
        code: "api_unavailable",
        message: expect.stringContaining("Mock mode was not used"),
      })
    } finally {
      server.listen({ onUnhandledFrame: "bypass" })
      process.env.NEXT_PUBLIC_API_MODE = previousMode
      if (previousUrl === undefined) {
        delete process.env.NEXT_PUBLIC_API_URL
      } else {
        process.env.NEXT_PUBLIC_API_URL = previousUrl
      }
    }
  })
})

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

type UiState = {
  sidebarCollapsed: boolean
  commandOpen: boolean
  mobileNavOpen: boolean
  hydrated: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setCommandOpen: (open: boolean) => void
  setMobileNavOpen: (open: boolean) => void
  setHydrated: (hydrated: boolean) => void
}

function writeSidebarAttribute(collapsed: boolean) {
  if (typeof document === "undefined") {
    return
  }

  document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "expanded"
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      commandOpen: false,
      mobileNavOpen: false,
      hydrated: false,
      toggleSidebar: () => {
        const sidebarCollapsed = !get().sidebarCollapsed
        writeSidebarAttribute(sidebarCollapsed)
        set({ sidebarCollapsed })
      },
      setSidebarCollapsed: (sidebarCollapsed) => {
        writeSidebarAttribute(sidebarCollapsed)
        set({ sidebarCollapsed })
      },
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "agentflow-ui",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return
        }

        writeSidebarAttribute(state.sidebarCollapsed)
        state.setHydrated(true)
      },
    },
  ),
)

import { createRoot } from "react-dom/client"
import AgentHealthCard from "./AgentHealthCard"

const root = document.getElementById("root")
if (!root) throw new Error("Remote root is missing.")

createRoot(root).render(
  <main>
    <p>AgentFlow remote</p>
    <AgentHealthCard />
  </main>,
)

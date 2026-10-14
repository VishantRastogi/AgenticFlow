import { useEffect, useState, version } from "react"
import { createRoot } from "react-dom/client"

function Host() {
  const [status, setStatus] = useState("loading")
  const [Card, setCard] = useState(null)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      import("agentflow_remote/AgentHealthCard")
        .then((mod) => {
          if (!active) return
          setCard(() => mod.default)
          setStatus("ready")
        })
        .catch(() => {
          if (active) setStatus("error")
        })
    }, 300)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <main>
      <p>AgentFlow host</p>
      <h1>Mission shell</h1>
      <p>
        Host React <span data-host-react>{version}</span>
      </p>
      {status === "loading" ? <p role="status">Loading the remote feature…</p> : null}
      {status === "error" ? (
        <p role="alert">
          The remote feature could not be loaded. The host is still running, and the remote can be deployed on its own.
        </p>
      ) : null}
      {status === "ready" && Card ? <Card /> : null}
    </main>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("Host root is missing.")
createRoot(root).render(<Host />)

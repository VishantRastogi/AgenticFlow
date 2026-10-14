import { useState, version } from "react"

export default function AgentHealthCard() {
  const [healthy, setHealthy] = useState(true)

  return (
    <section aria-label="Remote agent health" data-federation="agentflow-remote">
      <p>Remote feature</p>
      <h2>Orbit health</h2>
      <p>This card is rendered from the remote build, not from the host bundle.</p>
      <p>
        Shared React <span data-react-version>{version}</span>
      </p>
      <button type="button" onClick={() => setHealthy((current) => !current)}>
        {healthy ? "Mark unchecked" : "Mark healthy"}
      </button>
      <p role="status">{healthy ? "Runtime status: healthy" : "Runtime status: unchecked"}</p>
    </section>
  )
}

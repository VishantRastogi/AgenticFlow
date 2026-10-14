import type { WorkflowRecord } from "@/features/workflows/types"

export const workflowFixture: WorkflowRecord[] = [
  {
    id: "wf_release_gate",
    name: "Release gate",
    description: "Checks a release, then ships it or asks for approval.",
    status: "published",
    version: 3,
    updatedAt: "2026-10-14T02:00:00.000Z",
    graph: {
      nodes: [
        { id: "node_1", type: "trigger", position: { x: 40, y: 200 }, data: { label: "Trigger", event: "release.requested" } },
        {
          id: "node_2",
          type: "api",
          position: { x: 300, y: 200 },
          data: { label: "API request", url: "https://api.agentflow.test/releases", method: "POST" },
        },
        { id: "node_3", type: "condition", position: { x: 580, y: 200 }, data: { label: "Condition", expression: "checks == pass" } },
        { id: "node_4", type: "output", position: { x: 880, y: 80 }, data: { label: "Shipped" } },
        {
          id: "node_5",
          type: "approval",
          position: { x: 880, y: 320 },
          data: { label: "Human approval", assignee: "owner", prompt: "Approve this release before it ships." },
        },
        { id: "node_6", type: "output", position: { x: 1140, y: 320 }, data: { label: "Held" } },
      ],
      edges: [
        { id: "edge_1", source: "node_1", target: "node_2" },
        { id: "edge_2", source: "node_2", target: "node_3" },
        { id: "edge_3", source: "node_3", target: "node_4", sourceHandle: "true" },
        { id: "edge_4", source: "node_3", target: "node_5", sourceHandle: "false" },
        { id: "edge_5", source: "node_5", target: "node_6" },
      ],
    },
  },
  {
    id: "wf_draft_intake",
    name: "Draft intake",
    description: "Summarizes new intake and returns the result.",
    status: "draft",
    version: 1,
    updatedAt: "2026-10-13T18:00:00.000Z",
    graph: {
      nodes: [
        { id: "node_1", type: "trigger", position: { x: 80, y: 180 }, data: { label: "Trigger", event: "intake.received" } },
        {
          id: "node_2",
          type: "model",
          position: { x: 360, y: 180 },
          data: { label: "AI model", model: "orbit-small", prompt: "Summarize the incoming intake." },
        },
        { id: "node_3", type: "output", position: { x: 660, y: 180 }, data: { label: "Summary" } },
      ],
      edges: [
        { id: "edge_1", source: "node_1", target: "node_2" },
        { id: "edge_2", source: "node_2", target: "node_3" },
      ],
    },
  },
]

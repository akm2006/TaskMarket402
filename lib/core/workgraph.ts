import type { Mission, WorkGraph } from "./types";

export function createInitialWorkGraph(mission: Mission): WorkGraph {
  return {
    missionId: mission.id,
    nodes: [
      {
        id: `mission:${mission.id}`,
        label: "Mission Budget",
        status: "planned",
        kind: "mission",
        metadata: {
          budget: `${mission.budgetPolicy.totalBudget.amount} ${mission.budgetPolicy.totalBudget.currency}`
        }
      }
    ],
    edges: []
  };
}

export function appendWorkGraphNode(graph: WorkGraph, node: WorkGraph["nodes"][number]): WorkGraph {
  return {
    ...graph,
    nodes: [...graph.nodes, node]
  };
}

"use client";

import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes
} from "reactflow";
import type { WorkGraph, WorkGraphNode, WorkGraphNodeStatus } from "@/lib/core/types";

type GraphCategory = WorkGraphNode["kind"] | "manager" | "blocked";

type AuditNodeData = WorkGraphNode & {
  category: GraphCategory;
  eyebrow: string;
  primary: string;
  secondary: string;
};

type AuditFlowNode = Node<AuditNodeData>;

const NODE_WIDTH = 260;
const NODE_HEIGHT = 172;
const COLUMN_GAP = 295;
const ROW_GAP = 205;
const fitViewOptions = { padding: 0.18 };
const defaultEdgeOptions = { type: "smoothstep" };

const layeredPositions: Record<string, { column: number; row: number }> = {
  "mission-budget": { column: 0, row: 1 },
  "metamask-permission": { column: 1, row: 1 },
  "manager-agent": { column: 2, row: 1 },
  "contract-scanner": { column: 3, row: 0 },
  "wallet-behavior": { column: 3, row: 1 },
  "market-context": { column: 3, row: 2 },
  "x402-payment": { column: 4, row: 0 },
  "oneshot-relay": { column: 5, row: 0 },
  "venice-verification": { column: 4, row: 1.5 },
  "final-report": { column: 5, row: 1.5 },
  "blocked-payment": { column: 4, row: 2.85 }
};

const categoryLabels: Record<GraphCategory, string> = {
  mission: "Mission",
  permission: "Permission",
  manager: "Manager",
  agent: "Specialist",
  payment: "Payment",
  relay: "Relay",
  verification: "Verification",
  report: "Report",
  blocked: "Policy Block"
};

const statusLabels: Record<WorkGraphNodeStatus, string> = {
  planned: "Planned",
  running: "Running",
  payment_required: "Payment required",
  paid: "Paid",
  relayed: "Relayed",
  verified: "Verified",
  blocked: "Blocked",
  failed: "Failed",
  completed: "Completed"
};

const nodeThemes: Record<GraphCategory, string> = {
  mission: "border-cyan-300/70 bg-cyan-950/90 text-cyan-50 shadow-cyan-950/40",
  permission: "border-sky-300/70 bg-sky-950/90 text-sky-50 shadow-sky-950/40",
  manager: "border-violet-300/70 bg-violet-950/90 text-violet-50 shadow-violet-950/40",
  agent: "border-emerald-300/65 bg-emerald-950/90 text-emerald-50 shadow-emerald-950/40",
  payment: "border-amber-300/75 bg-amber-950/90 text-amber-50 shadow-amber-950/40",
  relay: "border-indigo-300/70 bg-indigo-950/90 text-indigo-50 shadow-indigo-950/40",
  verification: "border-teal-300/70 bg-teal-950/90 text-teal-50 shadow-teal-950/40",
  report: "border-zinc-200/70 bg-zinc-800/95 text-zinc-50 shadow-black/40",
  blocked: "border-red-300/80 bg-red-950/90 text-red-50 shadow-red-950/40"
};

const minimapColors: Record<GraphCategory, string> = {
  mission: "#22d3ee",
  permission: "#38bdf8",
  manager: "#a78bfa",
  agent: "#34d399",
  payment: "#f59e0b",
  relay: "#818cf8",
  verification: "#2dd4bf",
  report: "#e4e4e7",
  blocked: "#ef4444"
};

function getNodeCategory(node: WorkGraphNode): GraphCategory {
  if (node.id === "manager-agent") {
    return "manager";
  }

  if (node.status === "blocked") {
    return "blocked";
  }

  return node.kind;
}

function getNodeText(node: WorkGraphNode): Pick<AuditNodeData, "eyebrow" | "primary" | "secondary"> {
  const metadata = node.metadata ?? {};

  switch (node.id) {
    case "mission-budget":
      return {
        eyebrow: "Budget authority",
        primary: metadata.budget ?? "3.00 USDC",
        secondary: `Max ${metadata.maxPerAgent ?? "0.50 USDC"} per agent`
      };
    case "metamask-permission":
      return {
        eyebrow: metadata.network ?? "Base Sepolia",
        primary: metadata.status ?? "Permission proof pending",
        secondary: metadata.scope ?? "Scoped mission-budget permission receipt"
      };
    case "manager-agent":
      return {
        eyebrow: "Budget splitter",
        primary: metadata.output ?? "Three-task plan",
        secondary: metadata.objective ?? "Splits the mission into bounded work"
      };
    case "contract-scanner":
    case "wallet-behavior":
    case "market-context":
      return {
        eyebrow: metadata.subBudget ?? "Sub-budget",
        primary: metadata.output ?? "Mock specialist output",
        secondary: metadata.paymentMode ?? metadata.source ?? "Typed mock output"
      };
    case "x402-payment":
      return {
        eyebrow: metadata.amount ?? "0.40 USDC",
        primary: metadata.status ?? "x402 payment state",
        secondary: metadata.resource ?? "Specialist resource"
      };
    case "oneshot-relay":
      return {
        eyebrow: "Relay placeholder",
        primary: metadata.status ?? "Future relay proof",
        secondary: metadata.currentState ?? "Not implemented"
      };
    case "venice-verification":
      return {
        eyebrow: "AI verification",
        primary: metadata.status ?? "Provider-layer verification",
        secondary: metadata.implementation ?? "Venice/Gemini/mock provider state shown after runtime run"
      };
    case "final-report":
      return {
        eyebrow: "Mission result",
        primary: metadata.status ?? "Final report",
        secondary: metadata.synthesis ?? "Awaiting AI synthesis"
      };
    case "blocked-payment":
      return {
        eyebrow: metadata.attemptedAmount ?? "0.80 USDC",
        primary: "Policy blocked spend",
        secondary: metadata.reason ?? "Exceeded per-agent cap"
      };
    default:
      return {
        eyebrow: categoryLabels[getNodeCategory(node)],
        primary: node.label,
        secondary: statusLabels[node.status]
      };
  }
}

function nodeBadges(node: AuditNodeData): string[] {
  const metadata = node.metadata ?? {};
  const badges: string[] = [];

  if (metadata.paymentMode) {
    badges.push(metadata.paymentMode);
  }

  if (metadata.outputMode) {
    badges.push(metadata.outputMode);
  }

  if (metadata.aiMode) {
    badges.push(metadata.aiMode);
  }

  if (metadata.proofState) {
    badges.push(metadata.proofState);
  }

  return badges.slice(0, 2);
}

function AuditGraphNode({ data }: NodeProps<AuditNodeData>) {
  const badges = nodeBadges(data);

  return (
    <div
      className={`audit-node h-[172px] w-[260px] rounded-lg border p-4 text-left shadow-2xl ${nodeThemes[data.category]}`}
      data-testid={`workgraph-node-${data.id}`}
    >
      <Handle className="audit-handle" type="target" position={Position.Left} />
      <div className="flex h-full flex-col justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="rounded border border-white/20 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
              {categoryLabels[data.category]}
            </span>
            <span className="rounded border border-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
              {statusLabels[data.status]}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold leading-tight">{data.label}</h3>
          {badges.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded border border-white/15 bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <p className="text-base font-semibold leading-5">{data.primary}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-5 opacity-[0.84]">{data.secondary}</p>
        </div>
      </div>
      <Handle className="audit-handle" type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  audit: AuditGraphNode
};

function getPosition(id: string, index: number) {
  const layout = layeredPositions[id] ?? { column: index, row: 0 };

  return {
    x: layout.column * COLUMN_GAP,
    y: layout.row * ROW_GAP
  };
}

function edgeTone(edge: WorkGraph["edges"][number]) {
  if (edge.target === "blocked-payment") {
    return "#f87171";
  }

  if (edge.target === "venice-verification" || edge.target === "final-report") {
    return "#2dd4bf";
  }

  if (edge.target === "x402-payment" || edge.target === "oneshot-relay") {
    return "#fbbf24";
  }

  return "#94a3b8";
}

export function WorkGraphCanvas({ graph }: { graph: WorkGraph }) {
  const stableNodeTypes = useMemo(() => nodeTypes, []);
  const [selectedNode, setSelectedNode] = useState<AuditNodeData>(() => {
    const firstNode = graph.nodes[0];
    return {
      ...firstNode,
      category: getNodeCategory(firstNode),
      ...getNodeText(firstNode)
    };
  });

  const nodes = useMemo<AuditFlowNode[]>(
    () =>
      graph.nodes.map((workGraphNode, index) => {
        const category = getNodeCategory(workGraphNode);

        return {
          id: workGraphNode.id,
          type: "audit",
          data: {
            ...workGraphNode,
            category,
            ...getNodeText(workGraphNode)
          },
          position: getPosition(workGraphNode.id, index),
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          width: NODE_WIDTH,
          height: NODE_HEIGHT
        };
      }),
    [graph.nodes]
  );

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: edge.target === "blocked-payment",
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeTone(edge), width: 18, height: 18 },
        style: {
          stroke: edgeTone(edge),
          strokeWidth: edge.target === "blocked-payment" ? 3 : 2.25
        }
      })),
    [graph.edges]
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]" data-testid="workgraph-shell">
      <div
        className="h-[720px] min-h-[640px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/30"
        data-testid="workgraph-canvas"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={stableNodeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.24}
          maxZoom={1.15}
          defaultEdgeOptions={defaultEdgeOptions}
          onlyRenderVisibleElements={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_, node) => setSelectedNode(node.data)}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#334155" gap={28} size={1.2} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => minimapColors[(node.data as AuditNodeData).category]}
            maskColor="rgba(9, 9, 11, 0.72)"
            className="!border !border-zinc-700 !bg-zinc-950/90"
          />
          <Controls className="!border !border-zinc-700 !bg-zinc-950/90 !shadow-xl" showInteractive={false} />
        </ReactFlow>
      </div>

      <aside
        className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl shadow-black/20"
        data-testid="workgraph-node-details"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Inspect Node</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{selectedNode.label}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-200">
            {categoryLabels[selectedNode.category]}
          </span>
          <span className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-200">
            {statusLabels[selectedNode.status]}
          </span>
        </div>
        <p className="mt-5 text-sm font-semibold leading-6 text-zinc-100">{selectedNode.primary}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{selectedNode.secondary}</p>
        <dl className="mt-6 space-y-4 text-sm">
          {Object.entries(selectedNode.metadata ?? {}).map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {key.replace(/([A-Z])/g, " $1")}
              </dt>
              <dd className="mt-1 leading-6 text-zinc-200">{value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}

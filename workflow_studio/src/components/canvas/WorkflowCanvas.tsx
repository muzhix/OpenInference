/** React Flow canvas: derived nodes/edges, interactions, palette, toolbar (03). */

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import type { Connection, NodeChange, NodeTypes, OnBeforeDelete } from "@xyflow/react";

import { connectNodes, disconnectEdge, sectionMetaOf, specToGraph } from "../../adapter";
import type { AppEdge, AppNode, WorkflowNodeData } from "../../adapter";
import { useEditorStore } from "../../state/editorStore";
import { useRegistryStore } from "../../state/registryStore";
import { BlocksPalette } from "./BlocksPalette";
import { UiIcon } from "./hollowIcons";
import { CanvasToolbar } from "./CanvasToolbar";
import { StickyNoteNode } from "./nodes/StickyNoteNode";
import { WorkflowInputNode } from "./nodes/WorkflowInputNode";
import { WorkflowOutputNode } from "./nodes/WorkflowOutputNode";
import { WorkflowStepNode } from "./nodes/WorkflowStepNode";

const nodeTypes = {
  workflowInput: WorkflowInputNode,
  workflowStep: WorkflowStepNode,
  workflowOutput: WorkflowOutputNode,
  stickyNote: StickyNoteNode,
} satisfies NodeTypes;

function focusIsInFormControl(): boolean {
  const element = document.activeElement;
  if (!element) {
    return false;
  }
  const tag = element.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || (element as HTMLElement).isContentEditable;
}

export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const { screenToFlowPosition } = useReactFlow();
  // Second press of a very fast double-click can hit-test the pane while the
  // selection re-render settles; remember the last node press to recover it.
  const lastNodeClick = useRef<{ id: string; x: number; y: number; at: number } | null>(null);  const spec = useEditorStore((state) => state.spec);
  const registry = useRegistryStore((state) => state.registry);
  const livePositions = useEditorStore((state) => state.livePositions);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const openNodeId = useEditorStore((state) => state.expandedNodeId);
  const minimapVisible = useEditorStore((state) => state.minimapVisible);
  const locked = useEditorStore((state) => state.canvasLocked);

  const graph = useMemo(
    () => (spec ? specToGraph(spec, registry) : { nodes: [] as AppNode[], edges: [] }),
    [spec, registry],
  );
  const nodes = useMemo(
    () =>
      graph.nodes.map((node) => ({
        ...node,
        position: livePositions[node.id] ?? node.position,
        selected: node.id === selectedNodeId,
      })),
    [graph, livePositions, selectedNodeId],
  );
  // Official edge styling: 1px gray with a closed arrowhead; edges touching
  // the selected node highlight purple and thicken.
  const edges = useMemo(
    () =>
      graph.edges.map((edge) =>
        edge.source === selectedNodeId || edge.target === selectedNodeId
          ? { ...edge, style: { ...(edge.style ?? {}), stroke: "#7C3AED", strokeWidth: 2 } }
          : edge,
      ),
    [graph, selectedNodeId],
  );

  const onNodesChange = useCallback((changes: NodeChange<AppNode>[]) => {
    const store = useEditorStore.getState();
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        store.setLivePosition(change.id, change.position);
      } else if (change.type === "select") {
        store.setSelected(change.selected ? change.id : null);
      }
    }
  }, []);

  const onNodeDragStop = useCallback(() => {
    useEditorStore.getState().commitLivePositions();
  }, []);

  // Handles are node-level, so the drag only tells us WHICH nodes to bind:
  // connectNodes picks the target property (first unset kind-compatible
  // selector property, else the primary image-ish one) and the source
  // selector ($inputs.<name> / $steps.<name>.<firstOutput>).
  const onConnect = useCallback((connection: Connection) => {
    const { source, target } = connection;
    if (!source || !target || source === target) {
      return;
    }
    const registry = useRegistryStore.getState().registry;
    useEditorStore.getState().mutate((spec) => connectNodes(spec, source, target, registry));
  }, []);

  // Edge = reference: deleting an edge removes the binding (step property or
  // outputs row) that produced it. Cascade edges die with their node instead —
  // their references stay dangling, matching cloud's save-blocking behavior.
  const onEdgesDelete = useCallback((edges: AppEdge[]) => {
    if (edges.length === 0) {
      return;
    }
    useEditorStore.getState().mutate((spec) => edges.reduce((acc, edge) => disconnectEdge(acc, edge), spec));
  }, []);

  const isValidConnection = useCallback((edge: AppEdge | Connection) => edge.source !== edge.target, []);

  const onBeforeDelete = useCallback<OnBeforeDelete<AppNode, AppEdge>>(async ({ nodes: markedNodes, edges: markedEdges }) => {
    if (focusIsInFormControl()) {
      return false;
    }
    const deletableNodes = markedNodes.filter((node) => node.id.startsWith("$steps.") || node.id.startsWith("note:"));
    const deletedNodeIds = new Set(deletableNodes.map((node) => node.id));
    const deletableEdges = markedEdges.filter(
      (edge) => edge.source !== null && !deletedNodeIds.has(edge.source) && !deletedNodeIds.has(edge.target),
    );
    return { nodes: deletableNodes, edges: deletableEdges };
  }, []);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest(".react-flow__node") !== null || target.closest(".react-flow__edge") !== null) {
        return; // node double-clicks arrive through onNodeDoubleClick; edges have no action
      }
      const recent = lastNodeClick.current;
      if (
        recent !== null &&
        Date.now() - recent.at < 350 &&
        Math.abs(event.clientX - recent.x) < 16 &&
        Math.abs(event.clientY - recent.y) < 16
      ) {
        lastNodeClick.current = null;
        if (!recent.id.startsWith("note:")) {
          useEditorStore.getState().setExpanded(recent.id);
        }
      }
    },
    [],
  );
  // Single click toggles a node open/collapsed (selection drives expansion);
  // holding and moving drags the node instead. A click right after a drag is
  // swallowed, and the second press of a double-click is ignored so the toggle
  // does not fight the (legacy) double-click expansion path.
  const suppressClickAfterDrag = useRef(false);
  const lastToggleClick = useRef<{ id: string; at: number } | null>(null);
  const handleNodeClick = useCallback((event: React.MouseEvent, node: AppNode) => {
    lastNodeClick.current = { id: node.id, x: event.clientX, y: event.clientY, at: Date.now() };
    if (suppressClickAfterDrag.current) {
      suppressClickAfterDrag.current = false;
      return;
    }
    // Clicks on controls INSIDE an open node (buttons, inputs, links) must not
    // collapse it — only clicks on the node body toggle open/closed.
    const target = event.target as Element;
    if (target.closest("button, input, textarea, select, a, [role='button'], [role='switch'], [role='tooltip']")) {
      return;
    }
    const recent = lastToggleClick.current;
    lastToggleClick.current = { id: node.id, at: Date.now() };
    if (recent && recent.id === node.id && Date.now() - recent.at < 320) {
      return;
    }
    // react-flow selects the node on mousedown already; the OPEN state is our
    // own single toggle so the form/mask follow clicks, not drags.
    const store = useEditorStore.getState();
    store.setExpanded(store.expandedNodeId === node.id ? null : node.id);
  }, []);

  // react-flow starts a "drag" on mere mousedown; only real movement should
  // swallow the click that follows.
  const handleNodeDrag = useCallback(() => {
    suppressClickAfterDrag.current = true;
  }, []);

  // React Flow's interaction layer reports node double-clicks even while the
  // selection re-render is in flight, unlike a raw DOM dblclick on the card.
  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: AppNode) => {
    if (node.id.startsWith("note:")) {
      return;
    }
    useEditorStore.getState().setExpanded(node.id);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") {
      return;
    }
    const store = useEditorStore.getState();
    if (store.palette) {
      store.closePalette();
    } else if (store.expandedNodeId) {
      store.setExpanded(null);
    } else {
      store.setSelected(null);
    }
  }, []);

  // Undo/redo shortcuts (B7): Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Cmd/Ctrl+Y.
  // Guarded while typing in form controls; preventDefault keeps the browser's
  // own text undo out of the way on the canvas.
  useEffect(() => {
    const onDocumentKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = (key === "z" && event.shiftKey) || key === "y";
      if (!isUndo && !isRedo) {
        return;
      }
      if (focusIsInFormControl()) {
        return;
      }
      event.preventDefault();
      const store = useEditorStore.getState();
      if (isUndo) {
        store.undo();
      } else {
        store.redo();
      }
    };
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, []);

  return (
    <div
      className="workflow-studio-canvas relative h-full w-full"
      data-node-open={openNodeId ? "true" : undefined}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      <ReactFlow<AppNode, AppEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeClick={handleNodeClick}
        onPaneClick={() => {
          const store = useEditorStore.getState();
          store.setSelected(null);
          store.closePalette();
        }}
        onNodesDelete={(deleted) => useEditorStore.getState().removeNodes(deleted.map((node) => node.id))}
        onBeforeDelete={onBeforeDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        deleteKeyCode={["Backspace", "Delete"]}
        zoomOnDoubleClick={false}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2.5}
      >
        {minimapVisible ? (
          <MiniMap
            position="top-right"
            pannable
            zoomable
            aria-label="Workflow minimap"
            nodeColor={(node) => {
              const data = node.data as WorkflowNodeData;
              return data.kind === "step" ? sectionMetaOf(data.section).color : "#D1D5DB";
            }}
          />
        ) : null}
      </ReactFlow>
      {/* Official add-block entry: the black circular + pinned to the canvas's
          upper-left. Opens the fixed left-side blocks palette. */}
      <button
        type="button"
        aria-label="Add block"
        onClick={(event) => {
          const container = event.currentTarget.closest(".workflow-studio-canvas");
          const rect = container?.getBoundingClientRect();
          const center = rect
            ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
            : { x: 240, y: 200 };
          useEditorStore.getState().openPalette({ flowX: center.x, flowY: center.y });
        }}
        className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white shadow-xl ring-1 ring-black/10 transition-colors hover:bg-gray-700"
      >
        <UiIcon name="plus" className="text-base" />
      </button>
      <CanvasToolbar />
      <BlocksPalette />
    </div>
  );
}

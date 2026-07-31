import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useParams } from "react-router-dom";

import { BlockNode } from "../components/BlockNode";
import { BlockPalette } from "../components/BlockPalette";
import { Inspector } from "../components/Inspector";
import { Toolbar } from "../components/Toolbar";
import {
  describeBlocks,
  getWorkflow,
  listModels,
  runWorkflow,
  saveWorkflow,
  validateWorkflow,
  type BlockDescription,
  type CachedModel,
  type WorkflowDocument,
  type WorkflowSpecification,
} from "../lib/api";
import { readSession } from "../lib/session";
import { notifyNavigate, notifySetTitle } from "../lib/shell";
import {
  airGappedUnavailable,
  canvasToSpecification,
  defaultParamsForBlock,
  outputNames,
  slugId,
  specificationToCanvas,
  type StepNodeData,
} from "../lib/workflow";

const nodeTypes: NodeTypes = { step: BlockNode };

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function EditorPage() {
  const { workflowId: routeId } = useParams();
  const session = useMemo(() => readSession(), []);
  const [workflowId, setWorkflowId] = useState(routeId || slugId());
  const [blocks, setBlocks] = useState<BlockDescription[]>([]);
  const [models, setModels] = useState<CachedModel[]>([]);
  const [filter, setFilter] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StepNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [runResult, setRunResult] = useState("");
  const [busy, setBusy] = useState(false);

  const blocksByType = useMemo(() => {
    const map = new Map<string, BlockDescription>();
    for (const b of blocks) {
      map.set(b.manifest_type_identifier, b);
      for (const alias of b.manifest_type_identifier_aliases || []) {
        map.set(alias, b);
      }
    }
    return map;
  }, [blocks]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("Loading blocks…");
        const [desc, modelRes] = await Promise.all([
          describeBlocks(session),
          listModels(session).catch(() => ({ models: [] as CachedModel[] })),
        ]);
        if (cancelled) return;
        setBlocks(desc.blocks || []);
        setModels(modelRes.models || []);
        setStatus(`Loaded ${(desc.blocks || []).length} blocks`);
      } catch (err) {
        if (!cancelled) setStatus(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!routeId) {
      notifySetTitle("InferGraph Build");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setStatus(`Loading workflow ${routeId}…`);
        const res = await getWorkflow(session, routeId);
        if (cancelled) return;
        const config = res.data.config;
        setWorkflowId(config.id || routeId);
        if (config.ui?.nodes && config.ui?.edges) {
          setNodes(config.ui.nodes as Node<StepNodeData>[]);
          setEdges(config.ui.edges as Edge[]);
        } else {
          const spec =
            config.specification ||
            ((config as { version?: string }).version
              ? (config as unknown as WorkflowSpecification)
              : null);
          if (spec?.steps) {
            const canvas = specificationToCanvas(spec, blocksByType);
            setNodes(canvas.nodes);
            setEdges(canvas.edges);
          }
        }
        notifySetTitle(`Editing ${config.id || routeId}`);
        setStatus("Workflow loaded");
      } catch (err) {
        if (!cancelled) setStatus(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId, session, blocksByType, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const addBlock = useCallback(
    (block: BlockDescription) => {
      if (airGappedUnavailable(block)) return;
      const id = `${block.human_friendly_block_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")}_${Math.random().toString(36).slice(2, 5)}`;
      const node: Node<StepNodeData> = {
        id,
        type: "step",
        position: { x: 120 + nodes.length * 40, y: 80 + nodes.length * 30 },
        data: {
          label: block.human_friendly_block_name,
          blockType: block.manifest_type_identifier,
          params: defaultParamsForBlock(block),
          outputs: outputNames(block),
          airGappedUnavailable: false,
        },
      };
      setNodes((ns) => [...ns, node]);
      setSelectedId(id);
    },
    [nodes.length, setNodes],
  );

  const selected = nodes.find((n) => n.id === selectedId) || null;
  const selectedBlock = selected
    ? blocksByType.get(selected.data.blockType)
    : undefined;

  const buildDoc = useCallback((): WorkflowDocument => {
    const specification = canvasToSpecification(nodes, edges);
    return {
      id: workflowId,
      name: workflowId,
      specification,
      ui: { nodes, edges },
    };
  }, [nodes, edges, workflowId]);

  const onSave = async () => {
    setBusy(true);
    try {
      const doc = buildDoc();
      await saveWorkflow(session, workflowId, doc);
      notifyNavigate(`edit/${workflowId}`);
      notifySetTitle(`Editing ${workflowId}`);
      setStatus(`Saved ${workflowId}`);
      if (!routeId) {
        const qs = window.location.search;
        window.history.replaceState({}, "", `/workflows/local/${workflowId}${qs}`);
      }
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  };

  const onValidate = async () => {
    setBusy(true);
    try {
      const spec = canvasToSpecification(nodes, edges);
      const res = await validateWorkflow(session, spec);
      setStatus("Validate OK");
      setRunResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  };

  const onRun = async () => {
    setBusy(true);
    try {
      const spec = canvasToSpecification(nodes, edges);
      const res = await runWorkflow(session, spec, {
        image: { type: "base64", value: TINY_PNG_B64 },
      });
      setStatus("Run OK");
      setRunResult(JSON.stringify(res, null, 2).slice(0, 4000));
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  };

  const onExport = () => {
    const doc = buildDoc();
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflowId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as WorkflowDocument & WorkflowSpecification;
      let spec: WorkflowSpecification | null = null;
      let id = workflowId;
      if (parsed.specification?.steps) {
        spec = parsed.specification;
        if (parsed.id) id = parsed.id;
        if (parsed.ui?.nodes) {
          setNodes(parsed.ui.nodes as Node<StepNodeData>[]);
          setEdges((parsed.ui.edges || []) as Edge[]);
          setWorkflowId(id);
          setStatus(`Imported ${file.name}`);
          return;
        }
      } else if (parsed.steps) {
        spec = parsed as WorkflowSpecification;
      }
      if (!spec) throw new Error("Unrecognized workflow JSON");
      const canvas = specificationToCanvas(spec, blocksByType);
      setNodes(canvas.nodes);
      setEdges(canvas.edges);
      setWorkflowId(id);
      setStatus(`Imported ${file.name}`);
    } catch (err) {
      setStatus(String(err));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        workflowId={workflowId}
        onWorkflowId={setWorkflowId}
        onSave={onSave}
        onValidate={onValidate}
        onRun={onRun}
        onExport={onExport}
        onImport={onImport}
        busy={busy}
      />
      <div className="flex min-h-0 flex-1">
        <BlockPalette
          blocks={blocks}
          filter={filter}
          onFilter={setFilter}
          onAdd={addBlock}
        />
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onSelectionChange={({ nodes: sel }) =>
              setSelectedId(sel[0]?.id ?? null)
            }
            fitView
          >
            <Background gap={16} color="#2a3542" />
            <Controls />
            <MiniMap
              style={{ background: "var(--ig-panel)" }}
              maskColor="rgb(15 20 25 / 0.7)"
            />
          </ReactFlow>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-[var(--ig-panel)]/90 px-2 py-1 text-[11px] text-[var(--ig-muted)]">
            Drag blocks from the left · connect handles · Save to /build/api
          </div>
        </div>
        <Inspector
          selected={selected ? { id: selected.id, data: selected.data } : null}
          block={selectedBlock}
          models={models}
          onChangeParams={(id, params) =>
            setNodes((ns) =>
              ns.map((n) =>
                n.id === id ? { ...n, data: { ...n.data, params } } : n,
              ),
            )
          }
          status={status}
          runResult={runResult}
        />
      </div>
    </div>
  );
}

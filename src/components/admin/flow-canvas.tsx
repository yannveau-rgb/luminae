'use client';

/**
 * Studio de Workflows Visuel No-Code Luminae (Flow Canvas).
 * Canvas interactif par nœuds et câbles courbes SVG, zoom, mini-map,
 * boutons de choix visiteur et simulateur de test en direct.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ChoiceOption,
  type FlowEdge,
  type FlowNode,
  type FlowNodeType,
  type VisualWorkflow,
  VISUAL_WORKFLOW_TEMPLATES
} from '@/lib/visual-workflow';
import { cn } from '@/lib/utils';
import { BotOrb } from '@/components/widget/parts';

interface FlowCanvasProps {
  workflow: VisualWorkflow;
  onSave: (wf: VisualWorkflow) => void;
  onClose: () => void;
}

export function FlowCanvas({ workflow: initialWf, onSave, onClose }: FlowCanvasProps) {
  const [workflow, setWorkflow] = useState<VisualWorkflow>(initialWf);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Nœud en cours de déplacement
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeOffset, setNodeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Nœud sélectionné pour édition dans le tiroir latéral
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = workflow.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Simulateur de test en direct
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simHistory, setSimHistory] = useState<Array<{ sender: 'bot' | 'visitor'; text: string; options?: ChoiceOption[] }>>([]);
  const [simCurrentNodeId, setSimCurrentNodeId] = useState<string | null>(null);

  // Palette d'ajout de bloc
  const [paletteOpen, setPaletteOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── GESTION DU DÉPLACEMENT PAN DU CANVAS ──────────────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.flow-node') || (e.target as HTMLElement).closest('.canvas-ui')) {
      return;
    }
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isPanning) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else if (draggingNodeId) {
      const newX = Math.round((e.clientX - pan.x - nodeOffset.x) / zoom / 10) * 10;
      const newY = Math.round((e.clientY - pan.y - nodeOffset.y) / zoom / 10) * 10;
      setWorkflow((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === draggingNodeId ? { ...n, position: { x: Math.max(20, newX), y: Math.max(20, newY) } } : n))
      }));
    }
  }

  function handleMouseUp() {
    setIsPanning(false);
    setDraggingNodeId(null);
  }

  function handleWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(1.8, Math.max(0.4, Number((z + delta).toFixed(2)))));
    }
  }

  function handleNodeDragStart(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    setNodeOffset({
      x: e.clientX - pan.x - node.position.x * zoom,
      y: e.clientY - pan.y - node.position.y * zoom
    });
  }

  // ── AJOUTER UN NOUVEAU NŒUD ───────────────────────────────────────────────
  function addNode(type: FlowNodeType) {
    const id = `node_${Date.now()}`;
    const x = Math.round((-pan.x + 300) / zoom / 10) * 10;
    const y = Math.round((-pan.y + 200) / zoom / 10) * 10;

    let newNode: FlowNode;
    if (type === 'message') {
      newNode = {
        id,
        type: 'message',
        title: '💬 Nouveau Message Bot',
        position: { x, y },
        data: { message: 'Bonjour ! Comment pouvons-nous vous aider aujourd’hui ?' }
      };
    } else if (type === 'buttons') {
      newNode = {
        id,
        type: 'buttons',
        title: '🔘 Choix & Boutons Visiteur',
        position: { x, y },
        data: {
          question: 'Que souhaitez-vous faire ?',
          options: [
            { id: `opt_1_${Date.now()}`, label: 'Option A' },
            { id: `opt_2_${Date.now()}`, label: 'Option B' }
          ]
        }
      };
    } else if (type === 'condition') {
      newNode = {
        id,
        type: 'condition',
        title: '🔀 Condition (Horaires)',
        position: { x, y },
        data: { conditionType: 'business_hours' }
      };
    } else {
      newNode = {
        id,
        type: 'action',
        title: '🚀 Action Métier',
        position: { x, y },
        data: { actionType: 'add_tag', actionPayload: 'Nouveau Tag' }
      };
    }

    setWorkflow((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setSelectedNodeId(id);
    setPaletteOpen(false);
  }

  function deleteNode(nodeId: string) {
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
    }));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }

  function updateSelectedNode(updates: Partial<FlowNode>) {
    if (!selectedNodeId) return;
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === selectedNodeId ? { ...n, ...updates } : n))
    }));
  }

  function updateSelectedData(dataUpdates: Partial<FlowNode['data']>) {
    if (!selectedNodeId) return;
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...dataUpdates } } : n))
    }));
  }

  // ── SIMULATEUR DE WORKFLOW (« TESTER LE WORKFLOW ») ───────────────────────
  const startSimulator = useCallback(() => {
    setSimulatorOpen(true);
    setSimHistory([]);

    const rootNode = workflow.nodes.find((n) => n.type === 'trigger') || workflow.nodes[0];
    if (!rootNode) return;

    advanceSimulator(rootNode.id);
  }, [workflow.nodes]);

  function advanceSimulator(nodeId: string) {
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSimCurrentNodeId(nodeId);

    if (node.type === 'trigger') {
      const nextEdge = workflow.edges.find((e) => e.source === node.id);
      if (nextEdge) advanceSimulator(nextEdge.target);
    } else if (node.type === 'message') {
      setSimHistory((prev) => [...prev, { sender: 'bot', text: node.data.message || 'Message' }]);
      const nextEdge = workflow.edges.find((e) => e.source === node.id);
      if (nextEdge) {
        setTimeout(() => advanceSimulator(nextEdge.target), 600);
      }
    } else if (node.type === 'buttons') {
      const options = node.data.options || [];
      setSimHistory((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: node.data.question || 'Veuillez faire un choix :',
          options
        }
      ]);
    } else if (node.type === 'condition') {
      setSimHistory((prev) => [
        ...prev,
        { sender: 'bot', text: `🔀 [Évaluation condition : ${node.title}] -> Branche active.` }
      ]);
      const nextEdge = workflow.edges.find((e) => e.source === node.id);
      if (nextEdge) {
        setTimeout(() => advanceSimulator(nextEdge.target), 600);
      }
    } else if (node.type === 'action') {
      setSimHistory((prev) => [
        ...prev,
        { sender: 'bot', text: `🚀 [Action exécutée] : ${node.title} (${node.data.actionPayload || ''})` }
      ]);
      const nextEdge = workflow.edges.find((e) => e.source === node.id);
      if (nextEdge) {
        setTimeout(() => advanceSimulator(nextEdge.target), 600);
      }
    }
  }

  function handleSimChoice(option: ChoiceOption) {
    setSimHistory((prev) => [...prev, { sender: 'visitor', text: option.label }]);
    const directTarget = option.targetNodeId;
    const edgeTarget = workflow.edges.find((e) => e.source === simCurrentNodeId && e.sourceHandle === option.id)?.target;
    const targetId = directTarget || edgeTarget;
    if (targetId) {
      setTimeout(() => advanceSimulator(targetId), 400);
    }
  }

  // ── CALCUL DES CÂBLES COURBES SVG ─────────────────────────────────────────
  const nodeWidth = 240;
  const nodeHeight = 120;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none overflow-hidden animate-fade-in font-sans">
      {/* ── BARRE D'OUTILS SUPÉRIEURE ───────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/90 px-4 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10 hover:text-white transition active:scale-95"
          >
            <span>&larr;</span>
            <span>Retour</span>
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          <div className="flex items-center gap-2">
            <BotOrb size={22} glow />
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              className="bg-transparent font-display text-sm font-bold text-white outline-none border-b border-transparent hover:border-white/30 focus:border-lagoon-400 px-1 py-0.5"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-white/80 cursor-pointer ml-3 bg-white/5 rounded-xl px-2.5 py-1 border border-white/10">
            <input
              type="checkbox"
              checked={workflow.enabled}
              onChange={(e) => setWorkflow({ ...workflow, enabled: e.target.checked })}
              className="accent-lagoon-500 rounded"
            />
            <span>{workflow.enabled ? '🟢 En ligne' : '⚪ En pause'}</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {/* Bouton Ajouter Bloc */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-white/20 transition active:scale-95"
          >
            <span>+</span>
            <span>Ajouter un bloc</span>
          </button>

          {/* Bouton Tester le Workflow */}
          <button
            type="button"
            onClick={startSimulator}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 transition active:scale-95"
          >
            <span>🧪</span>
            <span>Tester le workflow</span>
          </button>

          {/* Bouton Enregistrer */}
          <button
            type="button"
            onClick={() => onSave(workflow)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-lagoon-600 px-4 py-1.5 text-xs font-semibold text-white shadow-glow-sm hover:bg-lagoon-500 transition active:scale-95"
          >
            <span>💾</span>
            <span>Enregistrer</span>
          </button>
        </div>
      </header>

      {/* ── ZONE DE CANVAS PRINCIPALE ────────────────────────────────────────── */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className={cn(
          'relative flex-1 cursor-grab overflow-hidden active:cursor-grabbing',
          'bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px]'
        )}
      >
        {/* Conteneur transformé (Pan & Zoom) */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {/* SVG des Câbles de connexion */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
            <defs>
              <marker
                id="flow-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
              </marker>
              <linearGradient id="cable-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Rendu des flèches entre les nœuds */}
            {workflow.edges.map((edge) => {
              const src = workflow.nodes.find((n) => n.id === edge.source);
              const tgt = workflow.nodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;

              const x1 = src.position.x + nodeWidth / 2;
              const y1 = src.position.y + nodeHeight;
              const x2 = tgt.position.x + nodeWidth / 2;
              const y2 = tgt.position.y;

              const deltaY = Math.max(40, (y2 - y1) / 2);
              const pathD = `M ${x1} ${y1} C ${x1} ${y1 + deltaY}, ${x2} ${y2 - deltaY}, ${x2} ${y2}`;

              return (
                <g key={edge.id} className="pointer-events-auto group">
                  <path
                    d={pathD}
                    fill="none"
                    stroke="url(#cable-gradient)"
                    strokeWidth="2.5"
                    markerEnd="url(#flow-arrow)"
                    className="transition hover:stroke-sun-500 hover:stroke-[3.5px] cursor-pointer"
                  />
                  {/* Point lumineux interactif */}
                  <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="3" fill="#38bdf8" className="animate-pulse" />
                </g>
              );
            })}
          </svg>

          {/* Rendu des Nœuds (Blocs Visuels) */}
          <div className="absolute inset-0 pointer-events-auto">
            {workflow.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  style={{
                    transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`,
                    width: `${nodeWidth}px`
                  }}
                  className={cn(
                    'flow-node absolute rounded-2xl border transition-all duration-75 shadow-2xl backdrop-blur-md cursor-pointer select-none',
                    isSelected
                      ? 'border-lagoon-400 ring-2 ring-lagoon-400/50 bg-slate-900/95 scale-102 z-20'
                      : 'border-white/10 bg-slate-900/85 hover:border-white/30 z-10'
                  )}
                >
                  {/* En-tête coloré par type de nœud */}
                  <div
                    className={cn(
                      'flex items-center justify-between rounded-t-2xl px-3.5 py-2 text-xs font-bold border-b border-white/10',
                      node.type === 'trigger' && 'bg-amber-500/20 text-amber-300',
                      node.type === 'message' && 'bg-emerald-500/20 text-emerald-300',
                      node.type === 'buttons' && 'bg-sky-500/20 text-sky-300',
                      node.type === 'condition' && 'bg-rose-500/20 text-rose-300',
                      node.type === 'action' && 'bg-purple-500/20 text-purple-300'
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span>
                        {node.type === 'trigger' && '⚡'}
                        {node.type === 'message' && '💬'}
                        {node.type === 'buttons' && '🔘'}
                        {node.type === 'condition' && '🔀'}
                        {node.type === 'action' && '🚀'}
                      </span>
                      <span className="truncate">{node.title}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode(node.id);
                      }}
                      className="text-white/40 hover:text-rose-400 rounded px-1 transition text-[11px]"
                      title="Supprimer ce bloc"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Corps du bloc */}
                  <div className="p-3 text-xs space-y-2 text-white/80">
                    {node.type === 'trigger' && (
                      <div className="space-y-1">
                        <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10.5px] font-mono text-amber-300 block truncate">
                          Intention : {node.data.triggerValue || 'Toute intention'}
                        </span>
                        {node.data.keywords && node.data.keywords.length > 0 && (
                          <p className="text-[10px] text-white/50 truncate">
                            Mots : {node.data.keywords.slice(0, 3).join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {node.type === 'message' && (
                      <p className="text-[11.5px] leading-relaxed text-white/90 line-clamp-3 italic">
                        « {node.data.message || 'Texte du message…'} »
                      </p>
                    )}

                    {node.type === 'buttons' && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-white/70 line-clamp-1">{node.data.question}</p>
                        <div className="space-y-1">
                          {(node.data.options || []).map((opt) => (
                            <div
                              key={opt.id}
                              className="flex items-center justify-between rounded-lg bg-sky-500/15 px-2 py-1 text-[10.5px] font-medium text-sky-200 border border-sky-500/30"
                            >
                              <span className="truncate">{opt.label}</span>
                              <span className="text-[9px] text-sky-400">&rarr;</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {node.type === 'condition' && (
                      <div className="rounded-lg bg-rose-500/10 p-2 text-[10.5px] text-rose-200 border border-rose-500/20">
                        <span>Horaires ouvrés : Ouvert / Fermé</span>
                      </div>
                    )}

                    {node.type === 'action' && (
                      <div className="rounded-lg bg-purple-500/10 p-2 text-[10.5px] text-purple-200 border border-purple-500/20 truncate">
                        <span>{node.data.actionPayload || 'Action configurée'}</span>
                      </div>
                    )}
                  </div>

                  {/* Connecteur de sortie inférieur */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center h-4 w-4 rounded-full bg-sky-500 border-2 border-slate-900 shadow-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CONTRÔLES DE ZOOM ET VUE (EN BAS À DROITE) ──────────────────────── */}
        <div className="canvas-ui absolute bottom-6 right-6 flex items-center gap-1 rounded-2xl border border-white/10 bg-slate-900/90 p-1.5 shadow-2xl backdrop-blur-md z-30">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition"
            title="Zoom arrière"
          >
            -
          </button>
          <span className="w-12 text-center text-xs font-mono font-bold text-white/80">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition"
            title="Zoom avant"
          >
            +
          </button>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="px-2.5 py-1 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            Centrer
          </button>
        </div>

        {/* ── MINI-MAP (EN BAS À GAUCHE) ──────────────────────────────────────── */}
        <div className="canvas-ui absolute bottom-6 left-6 h-28 w-36 rounded-2xl border border-white/15 bg-slate-900/90 p-2 shadow-2xl backdrop-blur-md z-30 overflow-hidden hidden sm:block">
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">Aperçu du Flux</p>
          <div className="relative h-full w-full">
            {workflow.nodes.map((n) => (
              <div
                key={n.id}
                style={{
                  left: `${(n.position.x / 1200) * 100}%`,
                  top: `${(n.position.y / 1000) * 100}%`
                }}
                className={cn(
                  'absolute h-2 w-3 rounded-xs transition',
                  n.type === 'trigger' && 'bg-amber-400',
                  n.type === 'message' && 'bg-emerald-400',
                  n.type === 'buttons' && 'bg-sky-400',
                  n.type === 'condition' && 'bg-rose-400',
                  n.type === 'action' && 'bg-purple-400'
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── TIROIR D'ÉDITION DU BLOC SÉLECTIONNÉ (À DROITE) ─────────────────── */}
      {selectedNode && (
        <div className="absolute top-14 right-0 bottom-0 w-80 sm:w-96 border-l border-white/10 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl z-40 overflow-y-auto space-y-4 animate-slide-left">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-white">⚙️ Propriétés du bloc</h3>
              <p className="text-xs text-white/50">Configurez le comportement et les connexions</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="rounded-lg p-1 text-white/40 hover:text-white hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-white/80 block mb-1">Titre du bloc</label>
              <input
                type="text"
                value={selectedNode.title}
                onChange={(e) => updateSelectedNode({ title: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-lagoon-400"
              />
            </div>

            {selectedNode.type === 'message' && (
              <div>
                <label className="text-xs font-semibold text-white/80 block mb-1">Message envoyé par le bot</label>
                <textarea
                  rows={5}
                  value={selectedNode.data.message || ''}
                  onChange={(e) => updateSelectedData({ message: e.target.value })}
                  placeholder="Rédigez le texte du message..."
                  className="w-full rounded-xl border border-white/15 bg-slate-800 p-3 text-xs text-white outline-none focus:border-lagoon-400 leading-relaxed font-sans"
                />
              </div>
            )}

            {selectedNode.type === 'buttons' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-white/80 block mb-1">Question posée au visiteur</label>
                  <input
                    type="text"
                    value={selectedNode.data.question || ''}
                    onChange={(e) => updateSelectedData({ question: e.target.value })}
                    className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-lagoon-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/80 block mb-1.5">
                    Boutons de choix proposés (Bifurcations)
                  </label>
                  <div className="space-y-2">
                    {(selectedNode.data.options || []).map((opt, idx) => (
                      <div key={opt.id} className="rounded-xl border border-white/10 bg-slate-800/80 p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...(selectedNode.data.options || [])];
                              newOpts[idx] = { ...opt, label: e.target.value };
                              updateSelectedData({ options: newOpts });
                            }}
                            className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-2.5 py-1 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = (selectedNode.data.options || []).filter((_, i) => i !== idx);
                              updateSelectedData({ options: newOpts });
                            }}
                            className="text-white/40 hover:text-rose-400 text-xs px-1"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Sélecteur de bloc cible */}
                        <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                          <span>Branche vers :</span>
                          <select
                            value={opt.targetNodeId || ''}
                            onChange={(e) => {
                              const targetId = e.target.value;
                              const newOpts = [...(selectedNode.data.options || [])];
                              newOpts[idx] = { ...opt, targetNodeId: targetId || null };
                              updateSelectedData({ options: newOpts });

                              // Met à jour ou crée le câble dans workflow.edges
                              setWorkflow((prev) => {
                                const filteredEdges = prev.edges.filter(
                                  (ed) => !(ed.source === selectedNode.id && ed.sourceHandle === opt.id)
                                );
                                if (targetId) {
                                  filteredEdges.push({
                                    id: `edge_${selectedNode.id}_${opt.id}_${Date.now()}`,
                                    source: selectedNode.id,
                                    sourceHandle: opt.id,
                                    target: targetId
                                  });
                                }
                                return { ...prev, edges: filteredEdges };
                              });
                            }}
                            className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-2 py-1 text-[11px] text-sky-300"
                          >
                            <option value="">-- Aucun nœud connecté --</option>
                            {workflow.nodes
                              .filter((n) => n.id !== selectedNode.id)
                              .map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.title}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const newOpts = [
                          ...(selectedNode.data.options || []),
                          { id: `opt_${Date.now()}`, label: `Choix ${(selectedNode.data.options || []).length + 1}` }
                        ];
                        updateSelectedData({ options: newOpts });
                      }}
                      className="w-full rounded-xl border border-dashed border-white/20 py-2 text-xs font-semibold text-white/70 hover:text-white hover:border-white/40 transition"
                    >
                      + Ajouter un bouton de choix
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedNode.type === 'action' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-white/80 block mb-1">Type d&apos;action</label>
                  <select
                    value={selectedNode.data.actionType || 'add_tag'}
                    onChange={(e) => updateSelectedData({ actionType: e.target.value as any })}
                    className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-xs text-white"
                  >
                    <option value="add_tag">🏷️ Appliquer un tag</option>
                    <option value="assign_agent">🧑‍💻 Assigner un conseiller</option>
                    <option value="add_internal_note">🔒 Ajouter une note interne privée</option>
                    <option value="suggest_call">📞 Proposer un appel Quicktalk</option>
                    <option value="send_webhook">🌐 Déclencher un Webhook</option>
                    <option value="resolve_conversation">✅ Clôturer la conversation</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/80 block mb-1">Paramètre / Payload</label>
                  <input
                    type="text"
                    value={selectedNode.data.actionPayload || ''}
                    onChange={(e) => updateSelectedData({ actionPayload: e.target.value })}
                    placeholder="Nom du tag, URL ou texte..."
                    className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODALE / TIROIR DE PALETTE D'AJOUT DE BLOCS ─────────────────────── */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-base font-bold text-white">+ Ajouter un bloc au scénario</h3>
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="rounded-xl p-1.5 text-white/40 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-2.5">
              <button
                type="button"
                onClick={() => addNode('message')}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800/80 p-3 text-left hover:border-emerald-400/50 hover:bg-emerald-500/10 transition"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-lg text-emerald-300">
                  💬
                </div>
                <div>
                  <h4 className="font-display text-xs font-bold text-white">Message Bot</h4>
                  <p className="text-[11px] text-white/60">Envoie une bulle de texte ou des consignes claires au visiteur.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => addNode('buttons')}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800/80 p-3 text-left hover:border-sky-400/50 hover:bg-sky-500/10 transition"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-lg text-sky-300">
                  🔘
                </div>
                <div>
                  <h4 className="font-display text-xs font-bold text-white">Questions & Boutons de Choix</h4>
                  <p className="text-[11px] text-white/60">Affiche des boutons cliquables (Oui/Non, Choix A/B/C) pour aiguiller le client.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => addNode('condition')}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800/80 p-3 text-left hover:border-rose-400/50 hover:bg-rose-500/10 transition"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-lg text-rose-300">
                  🔀
                </div>
                <div>
                  <h4 className="font-display text-xs font-bold text-white">Condition SI / ALORS</h4>
                  <p className="text-[11px] text-white/60">Évalue les horaires d&apos;ouverture, l&apos;appareil ou l&apos;URL visitée.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => addNode('action')}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800/80 p-3 text-left hover:border-purple-400/50 hover:bg-purple-500/10 transition"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-lg text-purple-300">
                  🚀
                </div>
                <div>
                  <h4 className="font-display text-xs font-bold text-white">Action Métier</h4>
                  <p className="text-[11px] text-white/60">Applique un tag, assigne un conseiller ou déclenche un webhook.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIMULATEUR DE WORKFLOW EN DIRECT (« TESTER LE WORKFLOW ») ───────── */}
      {simulatorOpen && (
        <div className="fixed top-16 right-6 z-50 w-84 sm:w-96 rounded-3xl border border-white/20 bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-4 space-y-3 animate-slide-up flex flex-col max-h-[75vh]">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500 text-xs">🧪</span>
              <h3 className="font-display text-xs font-bold text-white">Simulateur Visiteur en Direct</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startSimulator}
                className="text-[11px] text-sky-400 hover:underline"
              >
                Recommencer
              </button>
              <button
                type="button"
                onClick={() => setSimulatorOpen(false)}
                className="rounded-lg p-1 text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 p-1 text-xs">
            {simHistory.map((item, idx) => (
              <div key={idx} className={cn('flex flex-col gap-1', item.sender === 'visitor' ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 max-w-[85%] leading-relaxed',
                    item.sender === 'visitor'
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-slate-800 text-white/90 border border-white/10'
                  )}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>
                </div>

                {/* Boutons d'options interactifs */}
                {item.options && item.options.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-full pt-1">
                    {item.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSimChoice(opt)}
                        className="w-full rounded-xl border border-sky-500/40 bg-sky-500/15 py-2 px-3 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 hover:border-sky-400 transition active:scale-98 text-left"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

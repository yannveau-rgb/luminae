'use client';

/**
 * Studio de Workflows Visuel No-Code Luminae (Flow Canvas).
 * Design épuré, compact et ultra-lisible (Blocs affinés, typographie nette, aération maximale).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ChoiceOption,
  type FlowEdge,
  type FlowNode,
  type FlowNodeType,
  type VisualWorkflow
} from '@/lib/visual-workflow';
import { cn } from '@/lib/utils';
import { BotOrb } from '@/components/widget/parts';

interface FlowCanvasProps {
  workflow: VisualWorkflow;
  onSave: (wf: VisualWorkflow) => void;
  onClose: () => void;
}

export function FlowCanvas({ workflow: initialWf, onSave, onClose }: FlowCanvasProps) {
  const [workflow, setWorkflowState] = useState<VisualWorkflow>(initialWf);

  // ── HISTORIQUE UNDO / REDO ────────────────────────────────────────────────
  const [history, setHistory] = useState<VisualWorkflow[]>([initialWf]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const setWorkflow = useCallback(
    (action: VisualWorkflow | ((prev: VisualWorkflow) => VisualWorkflow), recordHistory = true) => {
      setWorkflowState((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;
        if (recordHistory && JSON.stringify(prev) !== JSON.stringify(next)) {
          setHistory((h) => [...h.slice(0, historyIdx + 1), next]);
          setHistoryIdx((i) => i + 1);
        }
        return next;
      });
    },
    [historyIdx]
  );

  const undo = useCallback(() => {
    if (historyIdx > 0) {
      const prevWf = history[historyIdx - 1];
      setHistoryIdx((i) => i - 1);
      setWorkflowState(prevWf);
    }
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const nextWf = history[historyIdx + 1];
      setHistoryIdx((i) => i + 1);
      setWorkflowState(nextWf);
    }
  }, [history, historyIdx]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // ── ÉTAT PAN & ZOOM ───────────────────────────────────────────────────────
  const [zoom, setZoom] = useState<number>(0.95);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeOffset, setNodeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = workflow.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // ── SURVEILLANCE DU TEST ET CONDITIONS ────────────────────────────────────
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simHistory, setSimHistory] = useState<
    Array<{ sender: 'bot' | 'visitor'; text: string; options?: ChoiceOption[]; isError?: boolean }>
  >([]);
  const [activeTestNodeId, setActiveTestNodeId] = useState<string | null>(null);
  const [visitedNodeIds, setVisitedNodeIds] = useState<string[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string>>({});
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [currentTestError, setCurrentTestError] = useState<{ nodeId: string; message: string } | null>(null);

  const [simHoursMode, setSimHoursMode] = useState<'open' | 'closed'>('open');

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // ── ARCHITECTE IA ─────────────────────────────────────────────────────────
  const [aiArchitectOpen, setAiArchitectOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        'Bonjour ! Décrivez-moi le scénario que vous souhaitez créer et je vais concevoir l’arbre complet pour vous. Si besoin, je vous poserai quelques questions pour affiner les choix !'
    }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGeneratedWf, setAiGeneratedWf] = useState<VisualWorkflow | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── DIAGNOSTICS DE SANTÉ ──────────────────────────────────────────────────
  const diagnostics = useMemo(() => {
    const issues: Array<{
      nodeId: string;
      nodeTitle: string;
      kind: 'dead_end' | 'unconnected' | 'empty';
      message: string;
    }> = [];

    for (const node of workflow.nodes) {
      if (node.type === 'buttons') {
        const options = node.data.options || [];
        if (options.length === 0) {
          issues.push({
            nodeId: node.id,
            nodeTitle: node.title,
            kind: 'empty',
            message: 'Aucun bouton configuré.'
          });
        }
        for (const opt of options) {
          const hasTarget =
            opt.targetNodeId ||
            workflow.edges.some((e) => e.source === node.id && e.sourceHandle === opt.id);
          if (!hasTarget) {
            issues.push({
              nodeId: node.id,
              nodeTitle: node.title,
              kind: 'unconnected',
              message: `Bouton « ${opt.label} » non relié.`
            });
          }
        }
      }

      if (node.type !== 'trigger') {
        const hasIncoming =
          workflow.edges.some((e) => e.target === node.id) ||
          workflow.nodes.some((n) => n.data.options?.some((o) => o.targetNodeId === node.id));
        if (!hasIncoming) {
          issues.push({
            nodeId: node.id,
            nodeTitle: node.title,
            kind: 'unconnected',
            message: 'Bloc orphelin.'
          });
        }
      }

      if (['message', 'condition'].includes(node.type)) {
        const hasOutgoing = workflow.edges.some((e) => e.source === node.id);
        if (!hasOutgoing) {
          issues.push({
            nodeId: node.id,
            nodeTitle: node.title,
            kind: 'dead_end',
            message: 'Impasse : aucune suite.'
          });
        }
      }
    }

    return issues;
  }, [workflow.nodes, workflow.edges]);

  function focusOnNode(nodeId: string) {
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setPan({
      x: rect.width / 2 - (node.position.x + 100) * zoom,
      y: rect.height / 2 - (node.position.y + 40) * zoom
    });
    setSelectedNodeId(nodeId);
  }

  // ── AUTO-LAYOUT ÉPURÉ ET COMPACT ──────────────────────────────────────────
  function autoLayoutTree() {
    const root = workflow.nodes.find((n) => n.type === 'trigger') || workflow.nodes[0];
    if (!root) return;

    const levels: Map<string, number> = new Map();
    levels.set(root.id, 0);

    const queue: string[] = [root.id];
    while (queue.length > 0) {
      const currId = queue.shift()!;
      const currLevel = levels.get(currId)!;

      const currNode = workflow.nodes.find((n) => n.id === currId);
      const childIds: string[] = [];

      workflow.edges.filter((e) => e.source === currId).forEach((e) => childIds.push(e.target));
      currNode?.data.options?.forEach((opt) => {
        if (opt.targetNodeId) childIds.push(opt.targetNodeId);
      });

      for (const cid of childIds) {
        if (!levels.has(cid)) {
          levels.set(cid, currLevel + 1);
          queue.push(cid);
        }
      }
    }

    const levelGroups: Map<number, FlowNode[]> = new Map();
    for (const node of workflow.nodes) {
      const lvl = levels.get(node.id) ?? 0;
      if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
      levelGroups.get(lvl)!.push(node);
    }

    const updatedNodes: FlowNode[] = [];
    const maxLvl = Math.max(...Array.from(levelGroups.keys()), 0);

    for (let l = 0; l <= maxLvl; l++) {
      const nodesAtLvl = levelGroups.get(l) || [];
      const totalWidth = nodesAtLvl.length * 230;
      const startX = 500 - totalWidth / 2;

      nodesAtLvl.forEach((node, idx) => {
        updatedNodes.push({
          ...node,
          position: {
            x: Math.round(startX + idx * 230),
            y: 40 + l * 140
          }
        });
      });
    }

    setWorkflow((prev) => ({ ...prev, nodes: updatedNodes }));
    setZoom(0.95);
    setPan({ x: 80, y: 40 });
  }

  // ── DUPLIQUER UN BLOC ─────────────────────────────────────────────────────
  function duplicateNode(nodeId: string) {
    const src = workflow.nodes.find((n) => n.id === nodeId);
    if (!src) return;

    const newId = `node_${Date.now()}`;
    const clone: FlowNode = {
      ...src,
      id: newId,
      title: `${src.title} (Copie)`,
      position: {
        x: src.position.x + 25,
        y: src.position.y + 30
      },
      data: {
        ...src.data,
        options: src.data.options?.map((opt) => ({
          ...opt,
          id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        }))
      }
    };

    setWorkflow((prev) => ({
      ...prev,
      nodes: [...prev.nodes, clone]
    }));
    setSelectedNodeId(newId);
  }

  // ── ENVOI ARCHITECTE IA ───────────────────────────────────────────────────
  async function handleSendAiPrompt(overrideText?: string) {
    const textToSend = (overrideText || aiInput).trim();
    if (!textToSend || aiLoading) return;

    const nextMessages = [...aiMessages, { role: 'user' as const, content: textToSend }];
    setAiMessages(nextMessages);
    setAiInput('');
    setAiLoading(true);
    setAiGeneratedWf(null);

    try {
      const res = await fetch('/api/admin/workflows/ai-architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages })
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message || 'Voici ma réponse.' }
      ]);

      if (data.status === 'ready' && data.workflow) {
        setAiGeneratedWf(data.workflow);
      }
    } catch {
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Une erreur est survenue. Pouvez-vous reformuler votre demande ?' }
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  function applyGeneratedWorkflow() {
    if (!aiGeneratedWf) return;
    setWorkflow(aiGeneratedWf);
    setAiArchitectOpen(false);
    setSaveFeedback(`✨ « ${aiGeneratedWf.name} » chargé !`);
    setTimeout(() => setSaveFeedback(null), 2500);
    setTimeout(() => {
      autoLayoutTree();
      startSimulator();
    }, 150);
  }

  // ── EXPORT / IMPORT JSON ──────────────────────────────────────────────────
  function exportWorkflowJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(workflow, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `${workflow.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`);
    dlAnchor.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          setWorkflow(parsed);
          setSaveFeedback('✨ Import réussi !');
          setTimeout(() => setSaveFeedback(null), 2500);
        }
      } catch {
        alert('Fichier JSON invalide.');
      }
    };
    reader.readAsText(file);
  }

  // ── PAN & ZOOM ────────────────────────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    if (
      (e.target as HTMLElement).closest('.flow-node') ||
      (e.target as HTMLElement).closest('.canvas-ui')
    ) {
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
      setWorkflowState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === draggingNodeId ? { ...n, position: { x: Math.max(10, newX), y: Math.max(10, newY) } } : n
        )
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
      setZoom((z) => Math.min(1.6, Math.max(0.5, Number((z + delta).toFixed(2)))));
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

  // ── AJOUT NŒUD ────────────────────────────────────────────────────────────
  function addNode(type: FlowNodeType) {
    const id = `node_${Date.now()}`;
    const x = Math.round((-pan.x + 280) / zoom / 10) * 10;
    const y = Math.round((-pan.y + 150) / zoom / 10) * 10;

    let newNode: FlowNode;
    if (type === 'message') {
      newNode = {
        id,
        type: 'message',
        title: '💬 Message Bot',
        position: { x, y },
        data: { message: 'Bonjour ! Comment pouvons-nous vous aider ?' }
      };
    } else if (type === 'buttons') {
      newNode = {
        id,
        type: 'buttons',
        title: '🔘 Choix Visiteur',
        position: { x, y },
        data: {
          question: 'Votre choix :',
          options: [
            { id: `opt_1_${Date.now()}`, label: 'Option 1' },
            { id: `opt_2_${Date.now()}`, label: 'Option 2' }
          ]
        }
      };
    } else if (type === 'condition') {
      newNode = {
        id,
        type: 'condition',
        title: '🔀 Horaires',
        position: { x, y },
        data: { conditionType: 'business_hours' }
      };
    } else {
      newNode = {
        id,
        type: 'action',
        title: '🚀 Action',
        position: { x, y },
        data: { actionType: 'add_tag', actionPayload: 'Tag' }
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
      nodes: prev.nodes.map((n) =>
        n.id === selectedNodeId ? { ...n, data: { ...n.data, ...dataUpdates } } : n
      )
    }));
  }

  // ── SIMULATEUR ────────────────────────────────────────────────────────────
  const startSimulator = useCallback(() => {
    setSimulatorOpen(true);
    setSimHistory([]);
    setVisitedNodeIds([]);
    setSelectedOptionIds({});
    setActiveEdgeId(null);
    setCurrentTestError(null);

    const rootNode = workflow.nodes.find((n) => n.type === 'trigger') || workflow.nodes[0];
    if (!rootNode) return;

    advanceSimulator(rootNode.id);
  }, [workflow.nodes, workflow.edges, simHoursMode]);

  function advanceSimulator(nodeId: string) {
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) {
      setCurrentTestError({
        nodeId,
        message: `Bloc cible introuvable.`
      });
      setSimHistory((prev) => [
        ...prev,
        { sender: 'bot', text: `🚨 ERREUR : Bloc cible introuvable.`, isError: true }
      ]);
      return;
    }

    setActiveTestNodeId(node.id);
    setVisitedNodeIds((prev) => (prev.includes(node.id) ? prev : [...prev, node.id]));
    setCurrentTestError(null);
    focusOnNode(node.id);

    if (node.type === 'trigger') {
      const nextEdge = workflow.edges.find((e) => e.source === node.id);
      if (nextEdge) {
        setActiveEdgeId(nextEdge.id);
        setTimeout(() => advanceSimulator(nextEdge.target), 500);
      } else {
        setCurrentTestError({ nodeId: node.id, message: 'Déclencheur non relié.' });
      }
    } else if (node.type === 'message') {
      setSimHistory((prev) => [...prev, { sender: 'bot', text: node.data.message || 'Message' }]);
      const nextEdge = workflow.edges.find((e) => e.source === node.id);
      if (nextEdge) {
        setActiveEdgeId(nextEdge.id);
        setTimeout(() => advanceSimulator(nextEdge.target), 600);
      }
    } else if (node.type === 'buttons') {
      const options = node.data.options || [];
      setSimHistory((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: node.data.question || 'Faites un choix :',
          options
        }
      ]);
    } else if (node.type === 'condition') {
      const isHoursOpen = simHoursMode === 'open';
      setSimHistory((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `🔀 [${node.title}] ➔ Mode : ${isHoursOpen ? '☀️ Ouvert' : '🌙 Nuit'}`
        }
      ]);

      const matchingEdge =
        workflow.edges.find((e) => e.source === node.id && e.sourceHandle === (isHoursOpen ? 'open' : 'closed')) ||
        workflow.edges.find((e) => e.source === node.id);

      if (matchingEdge) {
        setActiveEdgeId(matchingEdge.id);
        setTimeout(() => advanceSimulator(matchingEdge.target), 650);
      } else {
        setCurrentTestError({ nodeId: node.id, message: 'Condition non reliée.' });
      }
    } else if (node.type === 'action') {
      setSimHistory((prev) => [
        ...prev,
        { sender: 'bot', text: `🚀 [Action] : ${node.title} (${node.data.actionPayload || ''})` }
      ]);
      const nextEdge = workflow.edges.find((e) => e.source === node.id);
      if (nextEdge) {
        setActiveEdgeId(nextEdge.id);
        setTimeout(() => advanceSimulator(nextEdge.target), 600);
      }
    }
  }

  function handleSimChoice(option: ChoiceOption) {
    if (!activeTestNodeId) return;

    setSelectedOptionIds((prev) => ({ ...prev, [activeTestNodeId]: option.id }));
    setSimHistory((prev) => [...prev, { sender: 'visitor', text: option.label }]);

    const directTarget = option.targetNodeId;
    const matchingEdge = workflow.edges.find(
      (e) => e.source === activeTestNodeId && e.sourceHandle === option.id
    );
    const targetId = directTarget || matchingEdge?.target;

    if (matchingEdge) setActiveEdgeId(matchingEdge.id);

    if (targetId) {
      setTimeout(() => advanceSimulator(targetId), 400);
    } else {
      setCurrentTestError({
        nodeId: activeTestNodeId,
        message: `Bouton « ${option.label} » non relié (Impasse).`
      });
      setSimHistory((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `🚨 IMPASSE : Le bouton « ${option.label} » n'est relié à aucun bloc.`,
          isError: true
        }
      ]);
    }
  }

  // Dimensions compactes et nettes des blocs
  const nodeWidth = 200;
  const nodeHeight = 85;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none overflow-hidden animate-fade-in font-sans">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* ── BARRE D'OUTILS SUPÉRIEURE ÉPURÉE ────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/90 px-3.5 backdrop-blur-md z-30">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/10 hover:text-white transition active:scale-95"
          >
            <span>&larr;</span>
            <span>Retour</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={undo}
              disabled={historyIdx === 0}
              className="px-1.5 py-0.5 text-[11px] text-white/70 hover:text-white disabled:opacity-25 rounded hover:bg-white/10"
              title="Annuler (Ctrl+Z)"
            >
              ↩️
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={historyIdx >= history.length - 1}
              className="px-1.5 py-0.5 text-[11px] text-white/70 hover:text-white disabled:opacity-25 rounded hover:bg-white/10"
              title="Rétablir (Ctrl+Y)"
            >
              ↪️
            </button>
          </div>

          <div className="h-3.5 w-px bg-white/10 mx-0.5" />

          <div className="flex items-center gap-1.5">
            <BotOrb size={18} glow />
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              className="bg-transparent font-display text-xs font-bold text-white outline-none border-b border-transparent hover:border-white/30 focus:border-lagoon-400 px-1 py-0.5 max-w-[160px] sm:max-w-xs truncate"
            />
          </div>

          {/* Statut */}
          <button
            type="button"
            onClick={() => setWorkflow({ ...workflow, enabled: !workflow.enabled })}
            className={cn(
              'flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-medium border transition active:scale-95',
              workflow.enabled
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
            )}
          >
            <span>{workflow.enabled ? '● En ligne' : '○ Brouillon'}</span>
          </button>

          {/* Diagnostic Santé */}
          <button
            type="button"
            onClick={() => setDiagnosticsOpen((o) => !o)}
            className={cn(
              'hidden md:flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-medium border transition',
              diagnostics.length === 0
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/50 bg-rose-500/20 text-rose-300 animate-pulse'
            )}
          >
            <span>{diagnostics.length === 0 ? '✓' : '⚠️'}</span>
            <span>{diagnostics.length === 0 ? 'Valide' : `${diagnostics.length} issue(s)`}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Architecte IA */}
          <button
            type="button"
            onClick={() => setAiArchitectOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-purple-600 px-2.5 py-1 text-[11px] font-bold text-white shadow hover:opacity-90 transition active:scale-95"
          >
            <span>✨</span>
            <span>Architecte IA</span>
          </button>

          {/* Aligner */}
          <button
            type="button"
            onClick={autoLayoutTree}
            className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition active:scale-95"
          >
            <span>✨ Aligner</span>
          </button>

          {/* Export / Import */}
          <button
            type="button"
            onClick={exportWorkflowJson}
            className="hidden lg:inline-flex rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10.5px] text-white/70 hover:bg-white/10 hover:text-white"
            title="Exporter JSON"
          >
            📤
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="hidden lg:inline-flex rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10.5px] text-white/70 hover:bg-white/10 hover:text-white"
            title="Importer JSON"
          >
            📥
          </button>

          {/* Ajouter Bloc */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition active:scale-95"
          >
            <span>+ Bloc</span>
          </button>

          {/* Tester */}
          <button
            type="button"
            onClick={startSimulator}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-[11px] font-semibold text-white shadow hover:from-blue-500 hover:to-indigo-500 transition active:scale-95"
          >
            <span>🧪 Tester</span>
          </button>

          {/* Enregistrer */}
          <button
            type="button"
            onClick={() => {
              onSave(workflow);
              setSaveFeedback('💾 Enregistré !');
              setTimeout(() => setSaveFeedback(null), 2000);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-lagoon-600 px-3 py-1 text-[11px] font-bold text-white shadow hover:bg-lagoon-500 transition active:scale-95"
          >
            <span>💾</span>
            <span>{workflow.enabled ? 'Publier' : 'Sauver'}</span>
          </button>
        </div>
      </header>

      {/* Toast confirmation */}
      {saveFeedback && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-emerald-500/50 bg-emerald-950/90 px-3 py-1.5 text-xs font-bold text-emerald-200 shadow-xl backdrop-blur-md animate-slide-up">
          {saveFeedback}
        </div>
      )}

      {/* ── ZONE DE CANVAS PRINCIPALE ────────────────────────────────────────── */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className={cn(
          'relative flex-1 cursor-grab overflow-hidden active:cursor-grabbing',
          'bg-[radial-gradient(#ffffff12_1px,transparent_1px)] [background-size:20px_20px]'
        )}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {/* Câbles SVG fins et élégants */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
            <defs>
              <marker
                id="flow-arrow-default"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
              </marker>

              <marker
                id="flow-arrow-active"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#10b981" />
              </marker>

              <linearGradient id="cable-gradient-default" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.75" />
              </linearGradient>

              <linearGradient id="cable-gradient-active" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
              </linearGradient>
            </defs>

            {workflow.edges.map((edge) => {
              const src = workflow.nodes.find((n) => n.id === edge.source);
              const tgt = workflow.nodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;

              const isEdgeActive = activeEdgeId === edge.id;

              const x1 = src.position.x + nodeWidth / 2;
              const y1 = src.position.y + nodeHeight;
              const x2 = tgt.position.x + nodeWidth / 2;
              const y2 = tgt.position.y;

              const deltaY = Math.max(30, (y2 - y1) / 2);
              const pathD = `M ${x1} ${y1} C ${x1} ${y1 + deltaY}, ${x2} ${y2 - deltaY}, ${x2} ${y2}`;

              return (
                <g key={edge.id} className="pointer-events-auto group">
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isEdgeActive ? 'url(#cable-gradient-active)' : 'url(#cable-gradient-default)'}
                    strokeWidth={isEdgeActive ? '3.5' : '1.8'}
                    markerEnd={isEdgeActive ? 'url(#flow-arrow-active)' : 'url(#flow-arrow-default)'}
                    className={cn(
                      'transition-all duration-200 cursor-pointer',
                      isEdgeActive && 'filter drop-shadow-[0_0_8px_#10b981]',
                      !isEdgeActive && 'hover:stroke-sun-500 hover:stroke-[2.5px]'
                    )}
                  />
                  <circle
                    cx={(x1 + x2) / 2}
                    cy={(y1 + y2) / 2}
                    r={isEdgeActive ? '4' : '2'}
                    fill={isEdgeActive ? '#10b981' : '#38bdf8'}
                    className={isEdgeActive ? 'animate-ping' : 'animate-pulse'}
                  />
                </g>
              );
            })}
          </svg>

          {/* Rendu des Nœuds COMPACTS & ÉPURÉS */}
          <div className="absolute inset-0 pointer-events-auto">
            {workflow.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isTestActive = activeTestNodeId === node.id;
              const isVisited = visitedNodeIds.includes(node.id);
              const nodeIssues = diagnostics.filter((d) => d.nodeId === node.id);
              const hasIssues = nodeIssues.length > 0;
              const isError = currentTestError?.nodeId === node.id;

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
                    'flow-node absolute rounded-xl border transition-all duration-100 shadow-lg backdrop-blur-md cursor-pointer select-none',
                    isTestActive && 'ring-3 ring-sky-400 border-sky-400 bg-slate-900 scale-102 z-30 shadow-[0_0_20px_#38bdf855]',
                    isError && 'ring-3 ring-rose-500 border-rose-500 bg-rose-950/40 z-30 animate-pulse',
                    isVisited && !isTestActive && !isError && 'border-emerald-500/70 bg-slate-900/90',
                    isSelected && !isTestActive && !isError && 'border-lagoon-400 ring-2 ring-lagoon-400/40 bg-slate-900 scale-101 z-20',
                    !isSelected && !isTestActive && !isVisited && !isError && 'border-white/10 bg-slate-900/80 hover:border-white/25 z-10'
                  )}
                >
                  {/* En-tête fin */}
                  <div
                    className={cn(
                      'flex items-center justify-between rounded-t-xl px-2.5 py-1.5 text-[11px] font-bold border-b border-white/10',
                      node.type === 'trigger' && 'bg-amber-500/15 text-amber-300',
                      node.type === 'message' && 'bg-emerald-500/15 text-emerald-300',
                      node.type === 'buttons' && 'bg-sky-500/15 text-sky-300',
                      node.type === 'condition' && 'bg-rose-500/15 text-rose-300',
                      node.type === 'action' && 'bg-purple-500/15 text-purple-300'
                    )}
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span>
                        {node.type === 'trigger' && '⚡'}
                        {node.type === 'message' && '💬'}
                        {node.type === 'buttons' && '🔘'}
                        {node.type === 'condition' && '🔀'}
                        {node.type === 'action' && '🚀'}
                      </span>
                      <span className="truncate">{node.title}</span>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateNode(node.id);
                        }}
                        className="text-white/30 hover:text-sky-300 px-0.5 text-[9px]"
                        title="Dupliquer"
                      >
                        📋
                      </button>

                      {hasIssues && (
                        <span className="rounded-full bg-rose-500/30 text-rose-300 text-[9px] px-1 border border-rose-500/50">
                          ⚠️
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNode(node.id);
                        }}
                        className="text-white/30 hover:text-rose-400 px-0.5 text-[10px]"
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Corps épuré */}
                  <div className="p-2 text-[10.5px] space-y-1.5 text-white/80">
                    {node.type === 'trigger' && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-mono text-amber-300 block truncate">
                        {node.data.triggerValue || 'Intention IA'}
                      </span>
                    )}

                    {node.type === 'message' && (
                      <p className="text-[10.5px] leading-snug text-white/85 line-clamp-2 italic">
                        « {node.data.message || 'Message…'} »
                      </p>
                    )}

                    {node.type === 'buttons' && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-white/60 line-clamp-1">{node.data.question}</p>
                        <div className="space-y-0.5">
                          {(node.data.options || []).map((opt) => {
                            const isOptionChosen = selectedOptionIds[node.id] === opt.id;
                            const isOptConnected =
                              opt.targetNodeId ||
                              workflow.edges.some((e) => e.source === node.id && e.sourceHandle === opt.id);

                            return (
                              <div
                                key={opt.id}
                                className={cn(
                                  'flex items-center justify-between rounded px-1.5 py-0.5 text-[9.5px] border transition-all',
                                  isOptionChosen
                                    ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-300'
                                    : isOptConnected
                                      ? 'bg-sky-500/10 text-sky-200 border-sky-500/20'
                                      : 'bg-rose-500/15 text-rose-200 border-rose-500/30 border-dashed'
                                )}
                              >
                                <span className="truncate">{opt.label}</span>
                                <span className="text-[8px]">{isOptConnected ? '➔' : '⚠️'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {node.type === 'condition' && (
                      <div className="rounded bg-rose-500/10 p-1 text-[10px] text-rose-200 border border-rose-500/20">
                        <span>Horaires : Ouvert / Fermé</span>
                      </div>
                    )}

                    {node.type === 'action' && (
                      <div className="rounded bg-purple-500/10 p-1 text-[10px] text-purple-200 border border-purple-500/20 truncate">
                        <span>{node.data.actionPayload || 'Action'}</span>
                      </div>
                    )}
                  </div>

                  {/* Connecteur bas */}
                  <div
                    className={cn(
                      'absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center justify-center h-3 w-3 rounded-full border border-slate-900 shadow-sm',
                      isVisited ? 'bg-emerald-500' : 'bg-sky-500'
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CONTRÔLES ZOOM DISCRETS ─────────────────────────────────────────── */}
        <div className="canvas-ui absolute bottom-4 right-4 flex items-center gap-0.5 rounded-xl border border-white/10 bg-slate-900/90 p-1 shadow-xl backdrop-blur-md z-30 text-[11px]">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
            className="flex h-6 w-6 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
          >
            -
          </button>
          <span className="w-10 text-center font-mono font-semibold text-white/80">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
            className="flex h-6 w-6 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
          >
            +
          </button>
          <div className="h-3 w-px bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={() => {
              setZoom(0.95);
              setPan({ x: 40, y: 30 });
            }}
            className="px-2 py-0.5 text-[10.5px] font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded"
          >
            Centrer
          </button>
        </div>

        {/* ── MINI-MAP DISCRÈTE ───────────────────────────────────────────────── */}
        <div className="canvas-ui absolute bottom-4 left-4 h-24 w-32 rounded-xl border border-white/10 bg-slate-900/90 p-1.5 shadow-xl backdrop-blur-md z-30 overflow-hidden hidden sm:block">
          <p className="text-[8px] font-bold uppercase tracking-wider text-white/30 mb-0.5">Aperçu</p>
          <div className="relative h-full w-full">
            {workflow.nodes.map((n) => (
              <div
                key={n.id}
                style={{
                  left: `${Math.min(95, Math.max(5, (n.position.x / 1200) * 100))}%`,
                  top: `${Math.min(95, Math.max(5, (n.position.y / 900) * 100))}%`
                }}
                className={cn(
                  'absolute h-1.5 w-2.5 rounded-xs transition',
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

      {/* ── MODALE ARCHITECTE IA (PROMPT-TO-FLOW) ───────────────────────────── */}
      {aiArchitectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-slate-900 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-purple-600 text-xs">
                  ✨
                </span>
                <h3 className="font-display text-xs font-bold text-white">Architecte IA Mistral</h3>
              </div>
              <button
                type="button"
                onClick={() => setAiArchitectOpen(false)}
                className="rounded p-1 text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>

            {aiMessages.length <= 1 && (
              <div className="bg-slate-950/40 p-2.5 border-b border-white/10 space-y-1">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  💡 Suggestions rapides :
                </p>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleSendAiPrompt(
                        'Je veux un scénario de qualification de devis : demander si Particulier ou Entreprise, le budget, puis taguer et alerter les commerciaux.'
                      )
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10.5px] text-white/80 hover:bg-white/15 transition text-left"
                  >
                    🏢 Qualification Devis
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendAiPrompt(
                        'Je veux un scénario e-commerce pour les retours produits 14 jours : vérifier l’état du colis, demander le numéro de commande et orienter.'
                      )
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10.5px] text-white/80 hover:bg-white/15 transition text-left"
                  >
                    📦 Retours 14 Jours
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 text-xs">
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}
                >
                  <div
                    className={cn(
                      'rounded-xl px-3 py-2 max-w-[85%] leading-relaxed text-[11.5px]',
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white font-medium'
                        : 'bg-slate-800 text-white/90 border border-white/10'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {aiLoading && (
                <div className="flex items-center gap-2 text-[11px] text-white/60 p-1">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  <span>Conception de l'arbre décisionnel en cours...</span>
                </div>
              )}

              {aiGeneratedWf && !aiLoading && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/25 p-3 space-y-2 animate-slide-up">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-xs font-bold text-white">{aiGeneratedWf.name}</h4>
                    <span className="text-[10px] text-emerald-300">
                      {aiGeneratedWf.nodes.length} blocs · {aiGeneratedWf.edges.length} liens
                    </span>
                  </div>
                  <p className="text-[11px] text-white/70 line-clamp-2">{aiGeneratedWf.description}</p>
                  <button
                    type="button"
                    onClick={applyGeneratedWorkflow}
                    className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-lagoon-500 py-2 text-xs font-bold text-slate-950 transition hover:opacity-90 active:scale-98"
                  >
                    🚀 Déployer sur le Canvas & Tester en Direct &rarr;
                  </button>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAiPrompt();
              }}
              className="border-t border-white/10 bg-slate-900/95 p-2.5 flex items-center gap-1.5"
            >
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Décrivez votre scénario..."
                disabled={aiLoading}
                className="flex-1 rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-lagoon-400"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiInput.trim()}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-purple-600 px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Envoyer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── TIROIR PROPRIÉTÉS DU BLOC SÉLECTIONNÉ ────────────────────────────── */}
      {selectedNode && (
        <div className="absolute top-12 right-0 bottom-0 w-72 sm:w-80 border-l border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl z-40 overflow-y-auto space-y-3 animate-slide-left text-xs">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="font-display text-xs font-bold text-white">⚙️ Propriétés du bloc</h3>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="rounded p-1 text-white/40 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-semibold text-white/80 block mb-1">Titre</label>
              <input
                type="text"
                value={selectedNode.title}
                onChange={(e) => updateSelectedNode({ title: e.target.value })}
                className="w-full rounded-lg border border-white/15 bg-slate-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-lagoon-400"
              />
            </div>

            {selectedNode.type === 'message' && (
              <div>
                <label className="text-[11px] font-semibold text-white/80 block mb-1">Message</label>
                <textarea
                  rows={4}
                  value={selectedNode.data.message || ''}
                  onChange={(e) => updateSelectedData({ message: e.target.value })}
                  placeholder="Texte..."
                  className="w-full rounded-lg border border-white/15 bg-slate-800 p-2.5 text-xs text-white outline-none focus:border-lagoon-400 leading-relaxed font-sans"
                />
              </div>
            )}

            {selectedNode.type === 'buttons' && (
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-white/80 block mb-1">Question</label>
                  <input
                    type="text"
                    value={selectedNode.data.question || ''}
                    onChange={(e) => updateSelectedData({ question: e.target.value })}
                    className="w-full rounded-lg border border-white/15 bg-slate-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-lagoon-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-white/80 block mb-1">
                    Boutons de choix
                  </label>
                  <div className="space-y-1.5">
                    {(selectedNode.data.options || []).map((opt, idx) => (
                      <div key={opt.id} className="rounded-lg border border-white/10 bg-slate-800/80 p-2 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...(selectedNode.data.options || [])];
                              newOpts[idx] = { ...opt, label: e.target.value };
                              updateSelectedData({ options: newOpts });
                            }}
                            className="flex-1 rounded border border-white/15 bg-slate-900 px-2 py-0.5 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = (selectedNode.data.options || []).filter((_, i) => i !== idx);
                              updateSelectedData({ options: newOpts });
                            }}
                            className="text-white/40 hover:text-rose-400 text-xs px-0.5"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="flex items-center gap-1 text-[10.5px] text-white/60">
                          <span>Vers :</span>
                          <select
                            value={opt.targetNodeId || ''}
                            onChange={(e) => {
                              const targetId = e.target.value;
                              const newOpts = [...(selectedNode.data.options || [])];
                              newOpts[idx] = { ...opt, targetNodeId: targetId || null };
                              updateSelectedData({ options: newOpts });

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
                            className="flex-1 rounded border border-white/15 bg-slate-900 px-1.5 py-0.5 text-[10px] text-sky-300 truncate"
                          >
                            <option value="">-- Non connecté --</option>
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
                      className="w-full rounded-lg border border-dashed border-white/20 py-1 text-[11px] font-semibold text-white/70 hover:text-white transition"
                    >
                      + Ajouter un choix
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedNode.type === 'action' && (
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-semibold text-white/80 block mb-1">Action</label>
                  <select
                    value={selectedNode.data.actionType || 'add_tag'}
                    onChange={(e) => updateSelectedData({ actionType: e.target.value as any })}
                    className="w-full rounded-lg border border-white/15 bg-slate-800 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="add_tag">🏷️ Taguer</option>
                    <option value="assign_agent">🧑‍💻 Assigner conseiller</option>
                    <option value="add_internal_note">🔒 Note interne</option>
                    <option value="suggest_call">📞 Proposer appel</option>
                    <option value="send_webhook">🌐 Webhook</option>
                    <option value="resolve_conversation">✅ Clôturer</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-white/80 block mb-1">Valeur</label>
                  <input
                    type="text"
                    value={selectedNode.data.actionPayload || ''}
                    onChange={(e) => updateSelectedData({ actionPayload: e.target.value })}
                    placeholder="Nom du tag, texte..."
                    className="w-full rounded-lg border border-white/15 bg-slate-800 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODALE PALETTE BLOCS ────────────────────────────────────────────── */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display text-xs font-bold text-white">+ Ajouter un bloc</h3>
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="rounded p-1 text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-1.5">
              <button
                type="button"
                onClick={() => addNode('message')}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-800/80 p-2.5 text-left hover:border-emerald-400/50 hover:bg-emerald-500/10 transition"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-sm">
                  💬
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Message Bot</h4>
                  <p className="text-[10px] text-white/50">Envoie une réponse textuelle.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => addNode('buttons')}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-800/80 p-2.5 text-left hover:border-sky-400/50 hover:bg-sky-500/10 transition"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sm">
                  🔘
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Question & Choix</h4>
                  <p className="text-[10px] text-white/50">Boutons cliquables pour aiguiller.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => addNode('condition')}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-800/80 p-2.5 text-left hover:border-rose-400/50 hover:bg-rose-500/10 transition"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-sm">
                  🔀
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Condition Horaires</h4>
                  <p className="text-[10px] text-white/50">Ouvert vs Nuit / Week-end.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => addNode('action')}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-800/80 p-2.5 text-left hover:border-purple-400/50 hover:bg-purple-500/10 transition"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-sm">
                  🚀
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Action Métier</h4>
                  <p className="text-[10px] text-white/50">Taguer, assigner, note interne.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIMULATEUR TEST COMPACT ─────────────────────────────────────────── */}
      {simulatorOpen && (
        <div className="fixed top-14 right-4 z-50 w-80 rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl backdrop-blur-xl p-3 space-y-2 animate-slide-up flex flex-col max-h-[78vh] text-xs">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-500 text-[10px]">🧪</span>
              <h3 className="font-display text-xs font-bold text-white">Test en Direct</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={startSimulator}
                className="text-[10px] text-sky-400 hover:underline"
              >
                Relancer
              </button>
              <button
                type="button"
                onClick={() => {
                  setSimulatorOpen(false);
                  setActiveTestNodeId(null);
                  setActiveEdgeId(null);
                  setCurrentTestError(null);
                }}
                className="rounded p-0.5 text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-800/70 p-1.5 text-[10px] flex items-center justify-between">
            <span className="text-white/60 font-semibold">🎭 Mode :</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setSimHoursMode('open');
                  setTimeout(startSimulator, 50);
                }}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[9.5px] font-bold transition',
                  simHoursMode === 'open'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-700 text-white/60 hover:text-white'
                )}
              >
                ☀️ Jour
              </button>
              <button
                type="button"
                onClick={() => {
                  setSimHoursMode('closed');
                  setTimeout(startSimulator, 50);
                }}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[9.5px] font-bold transition',
                  simHoursMode === 'closed'
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-700 text-white/60 hover:text-white'
                )}
              >
                🌙 Nuit
              </button>
            </div>
          </div>

          {currentTestError && (
            <div className="rounded-lg border border-rose-500/50 bg-rose-500/20 p-2 text-[10.5px] text-rose-200 flex items-start gap-1.5">
              <span>🚨</span>
              <span>{currentTestError.message}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 p-0.5 text-[11px]">
            {simHistory.map((item, idx) => (
              <div key={idx} className={cn('flex flex-col gap-0.5', item.sender === 'visitor' ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'rounded-xl px-2.5 py-1.5 max-w-[90%] leading-relaxed',
                    item.sender === 'visitor'
                      ? 'bg-blue-600 text-white font-medium'
                      : item.isError
                        ? 'bg-rose-950 border border-rose-500 text-rose-200'
                        : 'bg-slate-800 text-white/90 border border-white/10'
                  )}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>
                </div>

                {item.options && item.options.length > 0 && (
                  <div className="flex flex-col gap-1 w-full pt-0.5">
                    {item.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSimChoice(opt)}
                        className="w-full rounded-lg border border-sky-500/30 bg-sky-500/10 py-1.5 px-2.5 text-[10.5px] font-medium text-sky-200 hover:bg-sky-500/25 transition active:scale-98 text-left flex items-center justify-between"
                      >
                        <span>{opt.label}</span>
                        <span className="text-[9px] text-sky-400">➔</span>
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

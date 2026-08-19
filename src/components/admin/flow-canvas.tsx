'use client';

/**
 * Studio de Workflows Visuel No-Code Luminae (Flow Canvas).
 * Canvas interactif par nœuds et câbles courbes SVG avec :
 * 1. Architecte IA Conversationnel (Prompt-to-Flow avec clarification)
 * 2. Mode Brouillon vs Publier en direct
 * 3. Auto-Layout (« ✨ Aligner l'arbre »)
 * 4. Simulateur de Persona (Heures ouvrées vs Hors horaires / Mobile vs PC)
 * 5. Duplication / Cloner 1-clic de bloc
 * 6. Historique Annuler / Rétablir (Ctrl+Z / Ctrl+Y)
 * 7. Exportation & Importation JSON
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

  // Raccourcis clavier Ctrl+Z / Ctrl+Y
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

  // ── ÉTAT DE VUE ET DE PAN / ZOOM ──────────────────────────────────────────
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

  // ── SURVEILLANCE DU TEST ET SIMULATEUR DE CONDITIONS ──────────────────────
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simHistory, setSimHistory] = useState<
    Array<{ sender: 'bot' | 'visitor'; text: string; options?: ChoiceOption[]; isError?: boolean }>
  >([]);
  const [activeTestNodeId, setActiveTestNodeId] = useState<string | null>(null);
  const [visitedNodeIds, setVisitedNodeIds] = useState<string[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string>>({});
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [currentTestError, setCurrentTestError] = useState<{ nodeId: string; message: string } | null>(null);

  // Variables de simulation de Persona
  const [simHoursMode, setSimHoursMode] = useState<'open' | 'closed'>('open');

  // Palette & Diagnostics
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // ── ARCHITECTE IA CONVERSATIONNEL (PROMPT-TO-WORKFLOW) ────────────────────
  const [aiArchitectOpen, setAiArchitectOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        'Bonjour ! Je suis votre Architecte IA. Décrivez-moi le scénario que vous souhaitez créer (ex: qualification de leads devis, gestion des retours 14j, dépannage technique, accueil nuit...) et je vais le dessiner pour vous. Si besoin, je vous poserai des questions pour affiner les choix !'
    }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGeneratedWf, setAiGeneratedWf] = useState<VisualWorkflow | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── DIAGNOSTIC AUTOMATIQUE DE SANTÉ DU WORKFLOW ───────────────────────────
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
            message: 'Aucun bouton de choix configuré.'
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
              message: `Le bouton « ${opt.label} » n'est relié à aucun bloc cible.`
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
            message: 'Bloc orphelin : non relié au déclencheur du workflow.'
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
            message: 'Impasse : ce bloc ne poursuit vers aucune action ou question.'
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
      x: rect.width / 2 - (node.position.x + 120) * zoom,
      y: rect.height / 2 - (node.position.y + 60) * zoom
    });
    setSelectedNodeId(nodeId);
  }

  // ── AUTO-LAYOUT : RANGER ET ALIGNER L'ARBRE ──────────────────────────────
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
      const totalWidth = nodesAtLvl.length * 280;
      const startX = 600 - totalWidth / 2;

      nodesAtLvl.forEach((node, idx) => {
        updatedNodes.push({
          ...node,
          position: {
            x: Math.round(startX + idx * 280),
            y: 40 + l * 180
          }
        });
      });
    }

    setWorkflow((prev) => ({ ...prev, nodes: updatedNodes }));
    setZoom(0.85);
    setPan({ x: 100, y: 50 });
  }

  // ── DUPLIQUER / CLONER UN BLOC ───────────────────────────────────────────
  function duplicateNode(nodeId: string) {
    const src = workflow.nodes.find((n) => n.id === nodeId);
    if (!src) return;

    const newId = `node_${Date.now()}`;
    const clone: FlowNode = {
      ...src,
      id: newId,
      title: `${src.title} (Copie)`,
      position: {
        x: src.position.x + 30,
        y: src.position.y + 40
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

  // ── ENVOI À L'ARCHITECTE IA (PROMPT-TO-FLOW) ──────────────────────────────
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
        {
          role: 'assistant',
          content: 'Désolé, une erreur est survenue lors de l’analyse. Pouvez-vous reformuler votre demande ?'
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  function applyGeneratedWorkflow() {
    if (!aiGeneratedWf) return;
    setWorkflow(aiGeneratedWf);
    setAiArchitectOpen(false);
    setSaveFeedback(`✨ Workflow « ${aiGeneratedWf.name} » appliqué avec succès !`);
    setTimeout(() => setSaveFeedback(null), 3000);
    setTimeout(() => {
      autoLayoutTree();
      startSimulator();
    }, 200);
  }

  // ── EXPORTATION & IMPORTATION JSON ────────────────────────────────────────
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
          setSaveFeedback('✨ Workflow importé avec succès !');
          setTimeout(() => setSaveFeedback(null), 3000);
        }
      } catch {
        alert('Fichier JSON invalide.');
      }
    };
    reader.readAsText(file);
  }

  // ── DÉPLACEMENT PAN & ZOOM DU CANVAS ──────────────────────────────────────
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
          n.id === draggingNodeId ? { ...n, position: { x: Math.max(20, newX), y: Math.max(20, newY) } } : n
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
      nodes: prev.nodes.map((n) =>
        n.id === selectedNodeId ? { ...n, data: { ...n.data, ...dataUpdates } } : n
      )
    }));
  }

  // ── SIMULATEUR DE WORKFLOW AVEC CONDITIONS PERSONA ────────────────────────
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
        message: `Erreur : Le bloc cible (ID: ${nodeId}) n'existe pas.`
      });
      setSimHistory((prev) => [
        ...prev,
        { sender: 'bot', text: `🚨 ERREUR : Le bloc cible n'a pas été trouvé.`, isError: true }
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
        setTimeout(() => advanceSimulator(nextEdge.target), 600);
      } else {
        setCurrentTestError({ nodeId: node.id, message: 'Le déclencheur n’est relié à aucun bloc suivant.' });
      }
    } else if (node.type === 'message') {
      setSimHistory((prev) => [...prev, { sender: 'bot', text: node.data.message || 'Message' }]);
      const nextEdge = workflow.edges.find((e) => e.source === node.id);
      if (nextEdge) {
        setActiveEdgeId(nextEdge.id);
        setTimeout(() => advanceSimulator(nextEdge.target), 700);
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
      const isHoursOpen = simHoursMode === 'open';
      setSimHistory((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `🔀 [Évaluation Condition : ${node.title}]\nSimulé en mode : ${isHoursOpen ? '☀️ Heures Ouvrées (Ouvert)' : '🌙 Nuit / Hors Horaires (Fermé)'}`
        }
      ]);

      const matchingEdge =
        workflow.edges.find((e) => e.source === node.id && e.sourceHandle === (isHoursOpen ? 'open' : 'closed')) ||
        workflow.edges.find((e) => e.source === node.id);

      if (matchingEdge) {
        setActiveEdgeId(matchingEdge.id);
        setTimeout(() => advanceSimulator(matchingEdge.target), 750);
      } else {
        setCurrentTestError({ nodeId: node.id, message: 'La condition n’a aucune branche de sortie connectée.' });
      }
    } else if (node.type === 'action') {
      setSimHistory((prev) => [
        ...prev,
        { sender: 'bot', text: `🚀 [Action exécutée] : ${node.title} (${node.data.actionPayload || ''})` }
      ]);
      const nextEdge = workflow.edges.find((e) => e.source === node.id);
      if (nextEdge) {
        setActiveEdgeId(nextEdge.id);
        setTimeout(() => advanceSimulator(nextEdge.target), 700);
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
      setTimeout(() => advanceSimulator(targetId), 450);
    } else {
      setCurrentTestError({
        nodeId: activeTestNodeId,
        message: `Le bouton « ${option.label} » n'est relié à aucun bloc cible (Impasse).`
      });
      setSimHistory((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `🚨 IMPASSE DÉTECTÉE : Le bouton « ${option.label} » n'a pas de bloc cible relié.\nCliquez sur le bloc pour relier ce bouton.`,
          isError: true
        }
      ]);
    }
  }

  const nodeWidth = 240;
  const nodeHeight = 130;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none overflow-hidden animate-fade-in font-sans">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* ── BARRE D'OUTILS SUPÉRIEURE ───────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/90 px-4 backdrop-blur-md z-30">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10 hover:text-white transition active:scale-95"
          >
            <span>&larr;</span>
            <span>Retour</span>
          </button>

          {/* Boutons Undo / Redo */}
          <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={undo}
              disabled={historyIdx === 0}
              className="px-2 py-1 text-xs text-white/70 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10"
              title="Annuler (Ctrl+Z)"
            >
              ↩️
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={historyIdx >= history.length - 1}
              className="px-2 py-1 text-xs text-white/70 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10"
              title="Rétablir (Ctrl+Y)"
            >
              ↪️
            </button>
          </div>

          <div className="h-4 w-px bg-white/10 mx-0.5" />

          <div className="flex items-center gap-2">
            <BotOrb size={20} glow />
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              className="bg-transparent font-display text-sm font-bold text-white outline-none border-b border-transparent hover:border-white/30 focus:border-lagoon-400 px-1 py-0.5"
            />
          </div>

          {/* Mode Brouillon vs Publié */}
          <button
            type="button"
            onClick={() => setWorkflow({ ...workflow, enabled: !workflow.enabled })}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold border transition active:scale-95',
              workflow.enabled
                ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/20 text-amber-300'
            )}
            title="Basculer le statut de publication"
          >
            <span>{workflow.enabled ? '🟢 Publié en direct' : '🛡️ Mode Brouillon'}</span>
          </button>

          {/* Diagnostic Santé */}
          <button
            type="button"
            onClick={() => setDiagnosticsOpen((o) => !o)}
            className={cn(
              'hidden md:flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold border transition',
              diagnostics.length === 0
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/50 bg-rose-500/20 text-rose-300 animate-pulse'
            )}
          >
            <span>{diagnostics.length === 0 ? '✅' : '⚠️'}</span>
            <span>{diagnostics.length === 0 ? '0 anomalie' : `${diagnostics.length} anomalie(s)`}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* BOUTON ARCHITECTE IA CONVERSATIONNEL */}
          <button
            type="button"
            onClick={() => setAiArchitectOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg hover:opacity-90 transition active:scale-95"
          >
            <span>✨</span>
            <span>Architecte IA</span>
          </button>

          {/* Bouton Aligner l'arbre */}
          <button
            type="button"
            onClick={autoLayoutTree}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-white/20 transition active:scale-95"
            title="Ranger automatiquement tous les blocs"
          >
            <span>✨</span>
            <span>Aligner</span>
          </button>

          {/* Menu Export / Import */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              type="button"
              onClick={exportWorkflowJson}
              className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
            >
              📤 Export
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
            >
              📥 Import
            </button>
          </div>

          {/* Bouton Ajouter Bloc */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-white/20 transition active:scale-95"
          >
            <span>+</span>
            <span>Bloc</span>
          </button>

          {/* Bouton Tester le Workflow */}
          <button
            type="button"
            onClick={startSimulator}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 transition active:scale-95"
          >
            <span>🧪</span>
            <span>Tester</span>
          </button>

          {/* Bouton Enregistrer */}
          <button
            type="button"
            onClick={() => {
              onSave(workflow);
              setSaveFeedback('💾 Sauvegardé avec succès !');
              setTimeout(() => setSaveFeedback(null), 2500);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-lagoon-600 px-4 py-1.5 text-xs font-bold text-white shadow-glow-sm hover:bg-lagoon-500 transition active:scale-95"
          >
            <span>💾</span>
            <span>{workflow.enabled ? 'Publier' : 'Enregistrer'}</span>
          </button>
        </div>
      </header>

      {/* Toast de confirmation */}
      {saveFeedback && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-emerald-500/50 bg-emerald-950/90 px-4 py-2 text-xs font-bold text-emerald-200 shadow-2xl backdrop-blur-md animate-slide-up">
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
          'bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px]'
        )}
      >
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
                id="flow-arrow-default"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
              </marker>

              <marker
                id="flow-arrow-active"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#10b981" />
              </marker>

              <linearGradient id="cable-gradient-default" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
              </linearGradient>

              <linearGradient id="cable-gradient-active" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
              </linearGradient>
            </defs>

            {/* Rendu des flèches */}
            {workflow.edges.map((edge) => {
              const src = workflow.nodes.find((n) => n.id === edge.source);
              const tgt = workflow.nodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;

              const isEdgeActive = activeEdgeId === edge.id;

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
                    stroke={isEdgeActive ? 'url(#cable-gradient-active)' : 'url(#cable-gradient-default)'}
                    strokeWidth={isEdgeActive ? '4.5' : '2.5'}
                    markerEnd={isEdgeActive ? 'url(#flow-arrow-active)' : 'url(#flow-arrow-default)'}
                    className={cn(
                      'transition-all duration-300 cursor-pointer',
                      isEdgeActive && 'filter drop-shadow-[0_0_10px_#10b981]',
                      !isEdgeActive && 'hover:stroke-sun-500 hover:stroke-[3.5px]'
                    )}
                  />
                  <circle
                    cx={(x1 + x2) / 2}
                    cy={(y1 + y2) / 2}
                    r={isEdgeActive ? '5' : '3'}
                    fill={isEdgeActive ? '#10b981' : '#38bdf8'}
                    className={isEdgeActive ? 'animate-ping' : 'animate-pulse'}
                  />
                </g>
              );
            })}
          </svg>

          {/* Rendu des Nœuds */}
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
                    'flow-node absolute rounded-2xl border transition-all duration-150 shadow-2xl backdrop-blur-md cursor-pointer select-none',
                    isTestActive && 'ring-4 ring-sky-400 border-sky-400 bg-slate-900 scale-103 z-30 shadow-[0_0_25px_#38bdf866]',
                    isError && 'ring-4 ring-rose-500 border-rose-500 bg-rose-950/40 z-30 animate-pulse',
                    isVisited && !isTestActive && !isError && 'border-emerald-500/80 bg-slate-900/95 ring-1 ring-emerald-500/40',
                    isSelected && !isTestActive && !isError && 'border-lagoon-400 ring-2 ring-lagoon-400/50 bg-slate-900/95 scale-102 z-20',
                    !isSelected && !isTestActive && !isVisited && !isError && 'border-white/10 bg-slate-900/85 hover:border-white/30 z-10'
                  )}
                >
                  {isTestActive && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-500 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-950 shadow-lg flex items-center gap-1 animate-pulse">
                      <span>🟢</span>
                      <span>En cours d'exécution</span>
                    </div>
                  )}

                  {/* En-tête */}
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

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateNode(node.id);
                        }}
                        className="text-white/40 hover:text-sky-300 rounded px-1 transition text-[10px]"
                        title="Dupliquer ce bloc"
                      >
                        📋
                      </button>

                      {hasIssues && (
                        <span
                          title={nodeIssues.map((i) => i.message).join('\n')}
                          className="rounded-full bg-rose-500/30 text-rose-300 text-[10px] px-1 py-0.2 border border-rose-500/50"
                        >
                          ⚠️
                        </span>
                      )}

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
                  </div>

                  {/* Corps */}
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
                          {(node.data.options || []).map((opt) => {
                            const isOptionChosen = selectedOptionIds[node.id] === opt.id;
                            const isOptConnected =
                              opt.targetNodeId ||
                              workflow.edges.some((e) => e.source === node.id && e.sourceHandle === opt.id);

                            return (
                              <div
                                key={opt.id}
                                className={cn(
                                  'flex items-center justify-between rounded-lg px-2 py-1 text-[10.5px] font-medium border transition-all',
                                  isOptionChosen
                                    ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-300 shadow-[0_0_12px_#10b981]'
                                    : isOptConnected
                                      ? 'bg-sky-500/15 text-sky-200 border-sky-500/30'
                                      : 'bg-rose-500/20 text-rose-200 border-rose-500/40 border-dashed'
                                )}
                              >
                                <span className="truncate flex items-center gap-1">
                                  {isOptionChosen && <span>✓</span>}
                                  <span>{opt.label}</span>
                                </span>
                                <span className="text-[9px]">{isOptConnected ? '➔' : '⚠️ Non relié'}</span>
                              </div>
                            );
                          })}
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

                  {/* Connecteur */}
                  <div
                    className={cn(
                      'absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center h-4 w-4 rounded-full border-2 border-slate-900 shadow-md',
                      isVisited ? 'bg-emerald-500' : 'bg-sky-500'
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CONTRÔLES ZOOM ──────────────────────────────────────────────────── */}
        <div className="canvas-ui absolute bottom-6 right-6 flex items-center gap-1 rounded-2xl border border-white/10 bg-slate-900/90 p-1.5 shadow-2xl backdrop-blur-md z-30">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition"
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

        {/* ── MINI-MAP ───────────────────────────────────────────────────────── */}
        <div className="canvas-ui absolute bottom-6 left-6 h-28 w-36 rounded-2xl border border-white/15 bg-slate-900/90 p-2 shadow-2xl backdrop-blur-md z-30 overflow-hidden hidden sm:block">
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">Aperçu du Flux</p>
          <div className="relative h-full w-full">
            {workflow.nodes.map((n) => (
              <div
                key={n.id}
                style={{
                  left: `${Math.min(95, Math.max(5, (n.position.x / 1400) * 100))}%`,
                  top: `${Math.min(95, Math.max(5, (n.position.y / 1000) * 100))}%`
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

      {/* ── MODALE ARCHITECTE IA CONVERSATIONNEL (PROMPT-TO-WORKFLOW) ───────── */}
      {aiArchitectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-slate-900 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 text-sm shadow-md">
                  ✨
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-white">
                    Architecte IA Mistral — Prompt-to-Workflow
                  </h3>
                  <p className="text-[11px] text-white/50">
                    Décrivez votre idée en français, l'IA vous conseille et génère tout l'arbre décisionnel.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiArchitectOpen(false)}
                className="rounded-xl p-1.5 text-white/40 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Suggestions rapides si début */}
            {aiMessages.length <= 1 && (
              <div className="bg-slate-950/50 p-3 border-b border-white/10 space-y-1.5">
                <p className="text-[10.5px] font-bold text-white/50 uppercase tracking-wider">
                  💡 Idées de départ rapides (1-clic) :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleSendAiPrompt(
                        'Je veux un scénario de qualification de devis : demander si Particulier ou Entreprise, le budget, puis taguer et alerter les commerciaux.'
                      )
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/15 hover:text-white transition text-left"
                  >
                    🏢 Qualification Devis Commercial
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendAiPrompt(
                        'Je veux un scénario e-commerce pour les retours produits 14 jours : vérifier l’état du colis, demander le numéro de commande et orienter.'
                      )
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/15 hover:text-white transition text-left"
                  >
                    📦 Retours & SAV 14 Jours
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendAiPrompt(
                        'Je veux un scénario d’accueil hors horaires le soir et week-end : informer de l’absence et collecter email/téléphone pour rappel à 9h.'
                      )
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/15 hover:text-white transition text-left"
                  >
                    🌙 Accueil Hors Horaires & Nuit
                  </button>
                </div>
              </div>
            )}

            {/* Fil de discussion */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col gap-1',
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 max-w-[85%] leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
                        : 'bg-slate-800/90 text-white/90 border border-white/10 shadow-sm'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {/* État de chargement */}
              {aiLoading && (
                <div className="flex items-center gap-2 text-xs text-white/60 p-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  <span>L'Architecte IA analyse et conçoit votre arbre décisionnel...</span>
                </div>
              )}

              {/* Carte de déploiement si prêt */}
              {aiGeneratedWf && !aiLoading && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 space-y-3 animate-slide-up shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎉</span>
                      <div>
                        <h4 className="font-display text-sm font-bold text-white">
                          {aiGeneratedWf.name}
                        </h4>
                        <p className="text-[11px] text-emerald-300">
                          {aiGeneratedWf.nodes.length} nœuds générés · {aiGeneratedWf.edges.length} connexions automatiques
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-white/70 leading-relaxed">{aiGeneratedWf.description}</p>

                  <button
                    type="button"
                    onClick={applyGeneratedWorkflow}
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-lagoon-500 py-2.5 text-xs font-bold text-slate-950 shadow-glow transition hover:opacity-90 active:scale-98 flex items-center justify-center gap-2"
                  >
                    <span>🚀 Déployer sur le Canvas & Tester en Direct</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              )}
            </div>

            {/* Zone de saisie */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAiPrompt();
              }}
              className="border-t border-white/10 bg-slate-900/95 p-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Décrivez votre scénario ou répondez aux questions de l'IA..."
                disabled={aiLoading}
                className="flex-1 rounded-xl border border-white/15 bg-slate-800 px-3.5 py-2.5 text-xs text-white outline-none focus:border-lagoon-400 placeholder:text-white/40"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiInput.trim()}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40 active:scale-95 shadow-md shrink-0"
              >
                Envoyer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── TIROIR D'AFFICHAGE DES DIAGNOSTICS & ANOMALIES ─────────────────── */}
      {diagnosticsOpen && (
        <div className="absolute top-16 left-6 z-50 w-84 sm:w-96 rounded-3xl border border-rose-500/30 bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-4 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔍</span>
              <h3 className="font-display text-xs font-bold text-white">Diagnostics & Impasses</h3>
            </div>
            <button
              type="button"
              onClick={() => setDiagnosticsOpen(false)}
              className="rounded-lg p-1 text-white/40 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 text-xs">
            {diagnostics.length === 0 ? (
              <p className="text-emerald-300 py-3 text-center">
                ✨ Aucune anomalie détectée ! Tous vos blocs et boutons sont correctement reliés.
              </p>
            ) : (
              diagnostics.map((d, i) => (
                <div
                  key={i}
                  onClick={() => focusOnNode(d.nodeId)}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 cursor-pointer hover:bg-rose-500/20 transition space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300">{d.nodeTitle}</span>
                    <span className="text-[10px] text-sky-300 underline">Voir le bloc &rarr;</span>
                  </div>
                  <p className="text-[11px] text-white/70">{d.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TIROIR D'ÉDITION DU BLOC SÉLECTIONNÉ ───────────────────────────── */}
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

                        <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                          <span>Branche vers :</span>
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
                            className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-2 py-1 text-[11px] text-sky-300"
                          >
                            <option value="">-- Aucun nœud connecté (Impasse) --</option>
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

      {/* ── MODALE DE PALETTE D'AJOUT DE BLOCS ───────────────────────────────── */}
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

      {/* ── SIMULATEUR AVEC SÉLECTEUR DE PERSONA ────────────────────────────── */}
      {simulatorOpen && (
        <div className="fixed top-16 right-6 z-50 w-84 sm:w-96 rounded-3xl border border-white/20 bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-4 space-y-3 animate-slide-up flex flex-col max-h-[82vh]">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500 text-xs">🧪</span>
              <div>
                <h3 className="font-display text-xs font-bold text-white">Surveillance & Test en Direct</h3>
                <p className="text-[10px] text-sky-400">Le nœud actif brille en direct sur le canvas</p>
              </div>
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
                onClick={() => {
                  setSimulatorOpen(false);
                  setActiveTestNodeId(null);
                  setActiveEdgeId(null);
                  setCurrentTestError(null);
                }}
                className="rounded-lg p-1 text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Sélecteur de Persona */}
          <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-2 text-xs flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-bold text-white/60">🎭 Contexte :</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSimHoursMode('open');
                  setTimeout(startSimulator, 100);
                }}
                className={cn(
                  'rounded-lg px-2 py-1 text-[10.5px] font-bold transition',
                  simHoursMode === 'open'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-slate-700 text-white/70 hover:text-white'
                )}
                title="Tester comme s'il était 14h (Support ouvert)"
              >
                ☀️ Ouvert
              </button>
              <button
                type="button"
                onClick={() => {
                  setSimHoursMode('closed');
                  setTimeout(startSimulator, 100);
                }}
                className={cn(
                  'rounded-lg px-2 py-1 text-[10.5px] font-bold transition',
                  simHoursMode === 'closed'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-slate-700 text-white/70 hover:text-white'
                )}
                title="Tester comme s'il était 22h ou le week-end (Support fermé)"
              >
                🌙 Nuit
              </button>
            </div>
          </div>

          {/* Bandeau d'alerte */}
          {currentTestError && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-500/20 p-2.5 text-xs text-rose-200 flex items-start gap-2 animate-shake">
              <span>🚨</span>
              <div className="flex-1">
                <span className="font-bold block">Anomalie détectée :</span>
                <span className="text-[11px] leading-tight block">{currentTestError.message}</span>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2.5 p-1 text-xs">
            {simHistory.map((item, idx) => (
              <div key={idx} className={cn('flex flex-col gap-1', item.sender === 'visitor' ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 max-w-[88%] leading-relaxed',
                    item.sender === 'visitor'
                      ? 'bg-blue-600 text-white font-medium shadow-sm'
                      : item.isError
                        ? 'bg-rose-950 border border-rose-500 text-rose-200'
                        : 'bg-slate-800 text-white/90 border border-white/10'
                  )}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>
                </div>

                {/* Boutons d'options */}
                {item.options && item.options.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-full pt-1">
                    {item.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSimChoice(opt)}
                        className="w-full rounded-xl border border-sky-500/40 bg-sky-500/15 py-2 px-3 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 hover:border-sky-400 transition active:scale-98 text-left flex items-center justify-between"
                      >
                        <span>{opt.label}</span>
                        <span className="text-[10px] text-sky-400">Choisir ➔</span>
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

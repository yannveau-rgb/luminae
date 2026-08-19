import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { chatCompletion } from '@/lib/mistral';
import type { VisualWorkflow, FlowNode, FlowEdge } from '@/lib/visual-workflow';

export const dynamic = 'force-dynamic';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * POST /api/admin/workflows/ai-architect
 * Copilot conversationnel pour concevoir des workflows visuels par nœuds et branches.
 * Si la demande est vague, pose des questions de clarification ciblées.
 * Si la demande est claire, génère le VisualWorkflow complet avec coordonnées (x, y).
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    return NextResponse.json({ error: error.message ?? 'Accès refusé' }, { status: error.status ?? 403 });
  }

  const body = await request.json().catch(() => null);
  const messages: ChatMsg[] = Array.isArray(body?.messages) ? body.messages : [];

  if (messages.length === 0) {
    return NextResponse.json({ error: 'Historique de messages requis' }, { status: 400 });
  }

  const systemPrompt = `Tu es l'Architecte IA Expert de Workflows & Automatisations pour la plateforme Luminae.
Ton rôle est d'aider le créateur à concevoir un arbre décisionnel visuel parfait (Flow Canvas avec nœuds et branches).

RÈGLES IMPORTANTES :
1. Si la demande de l'utilisateur est incomplète, trop vague ou manque d'éléments cruciaux (ex: quelles sont les options de choix ? Que faire si le client clique sur Non ? Que faire hors horaires ?), NE GÉNÈRE PAS encore le workflow. Pose 1 à 3 questions de clarification précises, conviviales et concises pour cadrer le besoin.
2. Si la demande est suffisamment claire et détaillée (ou après que l'utilisateur a répondu à tes questions), génère le flux complet au format JSON strict.

FORMAT DE RÉPONSE ATTENDU (UNIQUEMENT DU JSON VALIDE SANS MARKDOWN NI BACKTICKS) :

Si tu as besoin de clarifications :
{
  "status": "needs_clarification",
  "message": "Texte convivial avec tes 1 à 3 questions précises..."
}

Si le workflow est prêt à être généré :
{
  "status": "ready",
  "message": "Explication courte du scénario conçu...",
  "workflow": {
    "name": "Titre du workflow (avec émoji)",
    "description": "Description concise de l'objectif",
    "enabled": true,
    "nodes": [
      {
        "id": "node_trigger",
        "type": "trigger",
        "title": "⚡ Déclencheur",
        "data": {
          "triggerType": "intent_detected",
          "triggerValue": "valeur_intention",
          "keywords": ["mot1", "mot2"]
        }
      },
      {
        "id": "node_buttons_1",
        "type": "buttons",
        "title": "🔘 Question & Choix",
        "data": {
          "question": "Question posée au visiteur ?",
          "options": [
            { "id": "opt_1", "label": "Choix A", "targetNodeId": "node_target_a" },
            { "id": "opt_2", "label": "Choix B", "targetNodeId": "node_target_b" }
          ]
        }
      },
      {
        "id": "node_target_a",
        "type": "message",
        "title": "💬 Réponse A",
        "data": {
          "message": "Texte du message pour le choix A..."
        }
      },
      {
        "id": "node_target_b",
        "type": "action",
        "title": "🚀 Action B",
        "data": {
          "actionType": "add_tag",
          "actionPayload": "Tag Métier"
        }
      }
    ],
    "edges": [
      { "id": "e1", "source": "node_trigger", "target": "node_buttons_1" },
      { "id": "e2", "source": "node_buttons_1", "sourceHandle": "opt_1", "target": "node_target_a" },
      { "id": "e3", "source": "node_buttons_1", "sourceHandle": "opt_2", "target": "node_target_b" }
    ]
  }
}

TYPES DE NŒUDS AUTORISÉS :
- 'trigger' : data.triggerType ('intent_detected' | 'message_received' | 'page_visited' | 'after_hours'), data.triggerValue, data.keywords
- 'message' : data.message
- 'buttons' : data.question, data.options [{ id, label, targetNodeId }]
- 'condition' : data.conditionType ('business_hours' | 'device' | 'cart_amount')
- 'action' : data.actionType ('add_tag' | 'assign_agent' | 'add_internal_note' | 'suggest_call' | 'send_webhook' | 'resolve_conversation'), data.actionPayload

Veille à ce que chaque option de bouton et chaque nœud soit correctement relié dans edges. Réponds toujours en français.`;

  try {
    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ];

    const rawResponse = await chatCompletion(aiMessages, {
      temperature: 0.3,
      maxTokens: 1800
    });

    const cleanJson = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.status === 'ready' && parsed.workflow) {
      // Calculer les positions (x, y) en arbre propre
      const wf = parsed.workflow as VisualWorkflow;
      wf.id = `vwf_${Date.now()}`;
      wf.execution_count = 0;
      wf.last_executed_at = null;

      // Disposition automatique en arbre
      const nodes = wf.nodes || [];
      const edges = wf.edges || [];

      const root = nodes.find((n) => n.type === 'trigger') || nodes[0];
      if (root) {
        const levels: Map<string, number> = new Map();
        levels.set(root.id, 0);

        const queue: string[] = [root.id];
        while (queue.length > 0) {
          const currId = queue.shift()!;
          const currLvl = levels.get(currId)!;
          const currNode = nodes.find((n) => n.id === currId);

          const childIds: string[] = [];
          edges.filter((e) => e.source === currId).forEach((e) => childIds.push(e.target));
          currNode?.data.options?.forEach((opt) => {
            if (opt.targetNodeId) childIds.push(opt.targetNodeId);
          });

          for (const cid of childIds) {
            if (!levels.has(cid)) {
              levels.set(cid, currLvl + 1);
              queue.push(cid);
            }
          }
        }

        const groups: Map<number, FlowNode[]> = new Map();
        for (const n of nodes) {
          const lvl = levels.get(n.id) ?? 0;
          if (!groups.has(lvl)) groups.set(lvl, []);
          groups.get(lvl)!.push(n);
        }

        const positionedNodes: FlowNode[] = [];
        const maxLvl = Math.max(...Array.from(groups.keys()), 0);

        for (let l = 0; l <= maxLvl; l++) {
          const atLvl = groups.get(l) || [];
          const totalW = atLvl.length * 280;
          const startX = 600 - totalW / 2;

          atLvl.forEach((node, idx) => {
            positionedNodes.push({
              ...node,
              position: {
                x: Math.round(startX + idx * 280),
                y: 40 + l * 180
              }
            });
          });
        }

        wf.nodes = positionedNodes;
      }

      return NextResponse.json({
        status: 'ready',
        message: parsed.message || 'Votre workflow a été généré avec succès !',
        workflow: wf
      });
    }

    return NextResponse.json({
      status: 'needs_clarification',
      message: parsed.message || 'Pouvez-vous préciser votre besoin ?'
    });
  } catch (err: unknown) {
    console.error('[ai-architect] Erreur:', err);
    return NextResponse.json(
      {
        status: 'needs_clarification',
        message: 'Pouvez-vous décrire plus précisément les étapes et les choix souhaités pour ce scénario ?'
      },
      { status: 200 }
    );
  }
}

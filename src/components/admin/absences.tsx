'use client';

/** Déclaration et suivi des absences d'agents. */

import { useCallback, useEffect, useState } from 'react';
import type { Agent, AgentAbsence } from '@/lib/types';
import { Card, Field, FormNotice, SectionHeader, inputCls } from './parts';

type AbsenceRow = AgentAbsence & { agent_name: string | null };

function fmtRange(starts: string, ends: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${fmt(starts)} → ${fmt(ends)}`;
}

export function AbsencesPanel() {
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const [agentId, setAgentId] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, g] = await Promise.all([
      fetch('/api/admin/absences', { cache: 'no-store' }),
      fetch('/api/admin/agents', { cache: 'no-store' })
    ]);
    if (a.ok) setAbsences((await a.json()).absences ?? []);
    if (g.ok) setAgents((await g.json()).agents ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!agentId && agents.length > 0) setAgentId(agents[0].id);
  }, [agents, agentId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId || !starts || !ends) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/admin/absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        starts_at: new Date(starts).toISOString(),
        ends_at: new Date(ends).toISOString(),
        reason
      })
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setStarts('');
      setEnds('');
      setReason('');
      setNotice({ kind: 'ok', text: 'Absence enregistrée.' });
      load();
    } else {
      setNotice({ kind: 'error', text: j.error ?? 'L’enregistrement a échoué.' });
    }
    setBusy(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/absences/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAbsences((list) => list.filter((a) => a.id !== id));
    } else {
      setNotice({ kind: 'error', text: 'La suppression a échoué.' });
    }
  }

  const now = Date.now();

  return (
    <div>
      <SectionHeader title="Absences" description="Un agent absent n'est pas compté comme disponible pour l'escalade." />
      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

      <Card className="mt-3">
        <h2 className="mb-4 text-sm font-semibold">Déclarer une absence</h2>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
          <Field label="Agent">
            <select className={inputCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name ?? a.email}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Motif (optionnel)">
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Congés, formation…" />
          </Field>
          <Field label="Du">
            <input type="datetime-local" className={inputCls} value={starts} onChange={(e) => setStarts(e.target.value)} required />
          </Field>
          <Field label="Au">
            <input type="datetime-local" className={inputCls} value={ends} onChange={(e) => setEnds(e.target.value)} required />
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy || !agentId || !starts || !ends}
              className="rounded-xl bg-lagoon-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-lagoon-700 disabled:opacity-50"
            >
              {busy ? 'Enregistrement…' : 'Enregistrer l’absence'}
            </button>
          </div>
        </form>
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Absences déclarées</h2>
      {loading ? (
        <p className="text-sm text-ink-400">Chargement…</p>
      ) : absences.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-ink-400 shadow-panel">Aucune absence déclarée.</p>
      ) : (
        <ul className="space-y-2">
          {absences.map((a) => {
            const active = new Date(a.starts_at).getTime() <= now && now < new Date(a.ends_at).getTime();
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-panel">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.agent_name ?? 'Agent'}
                    {active && (
                      <span className="ml-2 rounded-full bg-sun-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sun-600">
                        En cours
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-500">
                    {fmtRange(a.starts_at, a.ends_at)}
                    {a.reason ? ` — ${a.reason}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => remove(a.id)}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-ink-500 transition hover:bg-coral-50 hover:text-coral-600"
                >
                  Supprimer
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
// Lightweight run comparison (charter "RUN COMPARISON" / Phase 13). Every
// number here is the deterministic SessionMetrics already computed purely
// from the event log by shared/metrics.ts — nothing is invented or
// paraphrased by an LLM.
import { useEffect, useState } from "react";
import { fetchSessionMetrics, fetchSessions, type SessionSummary } from "../api/client.js";
import type { SessionMetrics } from "../../../core/shared/metrics.js";

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)} sec`;
}

interface Row {
  label: string;
  a: string | number;
  b: string | number;
}

function buildRows(a: SessionMetrics, b: SessionMetrics): Row[] {
  return [
    { label: "Duration", a: formatDuration(a.durationMs), b: formatDuration(b.durationMs) },
    { label: "Tool calls", a: a.toolCallCount, b: b.toolCallCount },
    { label: "Files read", a: a.filesRead.length, b: b.filesRead.length },
    { label: "Files written", a: a.filesWritten.length, b: b.filesWritten.length },
    { label: "Subagents", a: a.subagentsSpawned, b: b.subagentsSpawned },
    { label: "Agent handoffs", a: a.handoffCount, b: b.handoffCount },
    { label: "Skills accessed", a: a.skillsAccessed.length, b: b.skillsAccessed.length },
    { label: "Skills inferred", a: a.skillsInferred.length, b: b.skillsInferred.length },
    { label: "Validation failures", a: a.validationFailures, b: b.validationFailures },
    { label: "Validation passes", a: a.validationPasses, b: b.validationPasses },
    { label: "Repair loops", a: a.repairLoops, b: b.repairLoops },
    { label: "Final status", a: a.finalStatus, b: b.finalStatus },
  ];
}

export function ComparePanel() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionA, setSessionA] = useState<string | null>(null);
  const [sessionB, setSessionB] = useState<string | null>(null);
  const [metricsA, setMetricsA] = useState<SessionMetrics | null>(null);
  const [metricsB, setMetricsB] = useState<SessionMetrics | null>(null);

  useEffect(() => {
    fetchSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    if (sessionA) fetchSessionMetrics(sessionA).then(setMetricsA).catch(() => setMetricsA(null));
    else setMetricsA(null);
  }, [sessionA]);

  useEffect(() => {
    if (sessionB) fetchSessionMetrics(sessionB).then(setMetricsB).catch(() => setMetricsB(null));
    else setMetricsB(null);
  }, [sessionB]);

  return (
    <div style={{ padding: "1rem 1.5rem", overflowY: "auto" }}>
      <p className="panel-title">Run comparison</p>
      {sessions.length < 2 && (
        <p className="microcopy">At least two recorded sessions are needed to compare. Nothing recorded yet.</p>
      )}
      <div style={{ display: "flex", gap: "2rem", marginBottom: "1rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
        <label>
          Run A:{" "}
          <select value={sessionA ?? ""} onChange={(e) => setSessionA(e.target.value || null)}>
            <option value="">—</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.saved ? "★ " : ""}
                {s.label ?? s.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Run B:{" "}
          <select value={sessionB ?? ""} onChange={(e) => setSessionB(e.target.value || null)}>
            <option value="">—</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.saved ? "★ " : ""}
                {s.label ?? s.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      {metricsA && metricsB && (
        <table style={{ borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.3rem 1rem" }}></th>
              <th style={{ textAlign: "left", padding: "0.3rem 1rem" }}>RUN A · {sessionA}</th>
              <th style={{ textAlign: "left", padding: "0.3rem 1rem" }}>RUN B · {sessionB}</th>
            </tr>
          </thead>
          <tbody>
            {buildRows(metricsA, metricsB).map((row) => (
              <tr key={row.label} style={{ borderTop: "1px dotted var(--border)" }}>
                <td style={{ padding: "0.3rem 1rem", color: "var(--text-secondary)" }}>{row.label}</td>
                <td style={{ padding: "0.3rem 1rem" }}>{row.a}</td>
                <td style={{ padding: "0.3rem 1rem" }}>{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

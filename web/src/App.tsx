import { useEffect, useState } from "react";
import type { AuditEvent, BatchResult, EvaluationReport, Metrics, RazorpayIntegrationStatus, RecoveryCase } from "@recover-ai/shared";

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const label = (value: string) => value.replaceAll("_", " ");
const eventLabels: Record<AuditEvent["type"], string> = { failure_received: "Failure received", decision_made: "Decision made", action_executed: "Action executed", outcome_recorded: "Outcome recorded" };

export default function App() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [razorpay, setRazorpay] = useState<RazorpayIntegrationStatus | null>(null);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);
  const [caseFilter, setCaseFilter] = useState("all");
  const [caseSearch, setCaseSearch] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(12);

  const refresh = async () => {
    const [caseResponse, metricResponse, razorpayResponse, evaluationResponse] = await Promise.all([fetch("/api/cases"), fetch("/api/metrics"), fetch("/api/integrations/razorpay"), fetch("/api/evaluation")]);
    const nextCases: RecoveryCase[] = await caseResponse.json();
    setCases(nextCases); setMetrics(await metricResponse.json()); setRazorpay(await razorpayResponse.json()); setEvaluation(await evaluationResponse.json());
    setSelectedId((current) => current ?? nextCases[0]?.id ?? null);
  };
  const refreshAudit = async (id: string) => { const response = await fetch(`/api/cases/${id}/audit`); setAudit(await response.json()); };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (selectedId) void refreshAudit(selectedId); }, [selectedId]);

  const processCase = async (id: string) => {
    setBusy(id); await fetch(`/api/cases/${id}/process`, { method: "POST" });
    await Promise.all([refresh(), refreshAudit(id)]); setBusy(null);
  };
  const processBatch = async () => {
    setBatchBusy(true); setBatchResult(null);
    const response = await fetch("/api/cases/process-batch", { method: "POST" });
    setBatchResult(await response.json()); await refresh(); setBatchBusy(false);
  };
  const resetBatch = async () => {
    setBatchBusy(true); await fetch("/api/cases/reset", { method: "POST" });
    setBatchResult(null); setAudit([]); await refresh(); setBatchBusy(false);
  };
  const sendTestWebhook = async () => {
    setWebhookBusy(true); setWebhookMessage(null);
    const response = await fetch("/api/demo/razorpay-failure", { method: "POST" });
    const result: { caseId?: string; error?: string } = await response.json();
    if (response.ok && result.caseId) {
      await refresh(); setSelectedId(result.caseId); setWebhookMessage("Signed test event accepted · recovery case created");
    } else setWebhookMessage(result.error ?? "Test event could not be accepted");
    setWebhookBusy(false);
  };
  const selected = cases.find((item) => item.id === selectedId) ?? null;
  const filteredCases = cases.filter((item) => {
    const matchesStatus = caseFilter === "all" || item.status === caseFilter;
    const query = caseSearch.trim().toLowerCase();
    const matchesSearch = !query || `${item.customerName} ${item.subscriptionId} ${item.failureCode}`.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });
  const visibleCases = filteredCases.slice(0, visibleLimit);

  return <main>
    <header><div><span className="eyebrow">AI REVENUE RECOVERY</span><h1>RecoverAI</h1><p>Bounded, explainable recovery for failed subscription renewals.</p></div><span className="demo">SIMULATION MODE</span></header>
    <section className="metrics">
      <article><span>Revenue at risk</span><strong>{money(metrics?.totalAtRisk ?? 0)}</strong></article><article><span>Recovered</span><strong>{money(metrics?.recoveredRevenue ?? 0)}</strong></article><article><span>Recovery rate</span><strong>{((metrics?.recoveryRate ?? 0) * 100).toFixed(1)}%</strong></article><article><span>Cases processed</span><strong>{metrics?.casesProcessed ?? 0}/{cases.length}</strong></article>
    </section>
    <section className="integration-strip"><div><span className="integration-mark">R</span><div><strong>Razorpay webhook intake</strong><p>Test-mode adapter · raw-body signatures · persistent duplicate protection</p>{webhookMessage && <em>{webhookMessage}</em>}</div></div><div className="integration-checks"><span>Signature verified</span><span>Idempotency active</span><b>{razorpay?.acceptedEvents ?? 0} events accepted</b><button disabled={webhookBusy} onClick={() => void sendTestWebhook()}>{webhookBusy ? "Sending…" : "Send test failure"}</button></div></section>
    <section className="evaluation-panel"><div className="evaluation-copy"><span className="eyebrow">HELD-OUT EVALUATION</span><h2>Decision quality, measured</h2><p>{evaluation?.dataset ?? "Loading evaluation…"}. Labels are separate from the live 50-case recovery batch.</p></div><div className="evaluation-stats"><article><span>Exact-action accuracy</span><strong>{((evaluation?.decisionAccuracy ?? 0) * 100).toFixed(0)}%</strong><small>{evaluation?.correctDecisions ?? 0}/{evaluation?.totalScenarios ?? 0} decisions</small></article><article><span>Unsafe automations</span><strong>{evaluation?.unsafeAutomationCount ?? 0}</strong><small>lost, stolen or ambiguous cases</small></article><article><span>Exceptions</span><strong>{evaluation?.exceptions.length ?? 0}</strong><small>honestly reported mismatches</small></article></div><div className="action-breakdown">{evaluation && Object.entries(evaluation.actionBreakdown).map(([action, count]) => <span key={action}><b>{count}</b> {label(action)}</span>)}</div></section>
    <section><div className="section-title"><div><h2>Failed renewals</h2><p>50-case synthetic evaluation batch · select a case to inspect its evidence.</p></div><div className="batch-actions"><button className="reset-button" disabled={batchBusy || cases.every((item) => item.status === "pending")} onClick={() => void resetBatch()}>Reset batch</button><button className="batch-button" disabled={batchBusy || cases.every((item) => item.status !== "pending")} onClick={() => void processBatch()}>{batchBusy ? "Working…" : "Run pending batch"}</button></div></div>
      {batchResult && <div className="batch-result"><strong>Batch complete</strong><span>{batchResult.processed} processed</span><span>{batchResult.recovered} recovered</span><span>{money(batchResult.recoveredRevenue)} restored</span><span>{batchResult.escalated} escalated</span><span>{batchResult.stopped} stopped</span></div>}
      <div className="queue-tools"><div className="filter-tabs">{["all", "pending", "recovered", "actioned", "review", "stopped"].map((status) => <button className={caseFilter === status ? "active" : ""} key={status} onClick={() => { setCaseFilter(status); setVisibleLimit(12); }}>{label(status)} <span>{status === "all" ? cases.length : cases.filter((item) => item.status === status).length}</span></button>)}</div><input aria-label="Search recovery cases" placeholder="Search customer, subscription or failure" value={caseSearch} onChange={(event) => { setCaseSearch(event.target.value); setVisibleLimit(12); }} /></div>
      <div className="queue-count">Showing {Math.min(visibleLimit, filteredCases.length)} of {filteredCases.length} matching cases</div>
      <div className="case-list">{visibleCases.map((item) => <article className={`case ${selectedId === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)}>
        <div><span className={`status ${item.status}`}>{item.status}</span><h3>{item.customerName} · {money(item.amount)}</h3><p>{item.subscriptionId} · {label(item.failureCode)}</p></div>
        <div className="decision">{item.decision ? <><b>{label(item.decision.action)}</b><span>{Math.round(item.decision.confidence * 100)}% confidence</span><small>{item.decision.reason}</small></> : <span>Awaiting diagnosis</span>}</div>
        <button disabled={item.status !== "pending" || busy === item.id} onClick={(event) => { event.stopPropagation(); void processCase(item.id); }}>{busy === item.id ? "Processing…" : item.status === "pending" ? "Run recovery" : "Processed"}</button>
      </article>)}</div>
      {visibleCases.length < filteredCases.length && <button className="load-more" onClick={() => setVisibleLimit((limit) => limit + 12)}>Show 12 more</button>}
    </section>
    {selected && <section className="case-detail" aria-live="polite">
      <div className="detail-heading"><div><span className="eyebrow">CASE EXPLANATION</span><h2>{selected.customerName} · {selected.id}</h2><p>{label(selected.failureCode)} on {new Date(selected.failedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></div><span className={`status ${selected.status}`}>{selected.status}</span></div>
      <div className="explanation-grid">
        <article className="explanation-main"><span className="detail-label">Diagnosis</span><h3>{selected.decision?.diagnosis ?? "Diagnosis pending"}</h3><p>{selected.decision?.reason ?? "Run recovery to classify this failure and generate a policy-checked recommendation."}</p>{selected.decision && <div className="recommendation"><span>Recommended action</span><strong>{label(selected.decision.action)}</strong><em>{Math.round(selected.decision.confidence * 100)}% confidence</em></div>}</article>
        <article className="policy-card"><span className="detail-label">Policy checks</span><div><span>Automation threshold</span><strong>70%</strong></div><div><span>Previous attempts</span><strong>{selected.previousAttempts} / 2</strong></div><div><span>Retry cooldown</span><strong>{selected.decision?.retryAfterHours ? `${selected.decision.retryAfterHours}h` : "Not applicable"}</strong></div><div><span>Recovered value</span><strong>{money(selected.recoveredAmount)}</strong></div></article>
      </div>
      <div className="audit-panel"><div className="audit-heading"><div><span className="detail-label">Audit timeline</span><h3>Complete decision trail</h3></div><span>{audit.length} events</span></div>
        <ol className="timeline">{audit.map((event, index) => <li key={event.id}><div className={`timeline-dot ${event.type}`}><span>{index + 1}</span></div><div className="timeline-copy"><div><strong>{eventLabels[event.type]}</strong><time>{new Date(event.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></div><p>{label(event.message)}</p></div></li>)}</ol>
      </div>
    </section>}
  </main>;
}

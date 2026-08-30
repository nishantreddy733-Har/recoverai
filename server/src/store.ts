import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AuditEvent, FailureCode, RecoveryCase } from "@recover-ai/shared";

type PersistedStore = { cases: RecoveryCase[]; auditEvents: AuditEvent[]; processedEventIds: string[] };
const storePath = join(process.cwd(), "data", "recovery-store.json");
const names = ["Aarav", "Meera", "Kabir", "Diya", "Ishaan", "Ananya", "Rohan", "Saanvi", "Vivaan", "Navya"];
const failureMix: FailureCode[] = ["insufficient_funds", "expired_card", "temporary_bank_error", "insufficient_funds", "unknown", "lost_or_stolen_card"];
const amounts = [499, 799, 999, 1499, 2499, 2999, 4999];

function seedStore(): PersistedStore {
  const now = Date.now();
  const cases: RecoveryCase[] = Array.from({ length: 50 }, (_, index) => ({
    id: `fail_${String(index + 101).padStart(3, "0")}`,
    subscriptionId: `sub_${["basic", "pro", "team"][index % 3]}_${String(index + 1).padStart(2, "0")}`,
    customerName: `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`,
    amount: amounts[index % amounts.length], currency: "INR", failureCode: failureMix[index % failureMix.length],
    failedAt: new Date(now - (24 + index * 3) * 3_600_000).toISOString(),
    previousAttempts: index % 11 === 0 ? 2 : index % 4 === 0 ? 1 : 0,
    status: "pending", recoveredAmount: 0,
  }));
  const auditEvents: AuditEvent[] = cases.map((item, index) => ({
    id: `audit_seed_${index + 1}`, caseId: item.id, at: item.failedAt,
    type: "failure_received", message: `Renewal failed: ${item.failureCode}`,
  }));
  return { cases, auditEvents, processedEventIds: [] };
}

function loadStore(): PersistedStore {
  if (!existsSync(storePath)) {
    const seeded = seedStore();
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  const stored = JSON.parse(readFileSync(storePath, "utf8")) as Partial<PersistedStore>;
  return { cases: stored.cases ?? [], auditEvents: stored.auditEvents ?? [], processedEventIds: stored.processedEventIds ?? [] };
}

const state = loadStore();
export const cases = state.cases;
export const auditEvents = state.auditEvents;
export const processedEventIds = state.processedEventIds;

export function persistStore() {
  writeFileSync(storePath, JSON.stringify({ cases, auditEvents, processedEventIds }, null, 2));
}

export function resetStore() {
  const seeded = seedStore();
  cases.splice(0, cases.length, ...seeded.cases);
  auditEvents.splice(0, auditEvents.length, ...seeded.auditEvents);
  processedEventIds.splice(0, processedEventIds.length);
  persistStore();
}

export function hasProcessedEvent(eventId: string) {
  return processedEventIds.includes(eventId);
}

export function recordProcessedEvent(eventId: string) {
  processedEventIds.push(eventId);
  persistStore();
}

export function addAudit(caseId: string, type: AuditEvent["type"], message: string) {
  auditEvents.push({ id: crypto.randomUUID(), caseId, at: new Date().toISOString(), type, message });
  persistStore();
}

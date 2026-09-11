/** Durable non-secret intent, written synchronously BEFORE any network await. */
import { kv } from "../lib/kv";
import type { StartOperation } from "../api/jobs";

export interface StartIntent {
  operation_id: string;
  printer_id: string;
  filename: string;
  ams_mapping?: number[];
  operation?: StartOperation;
}

function key(scope: string, printer: string) {
  return `start-intent.v1.${JSON.stringify([scope, printer])}`;
}

export function readIntent(scope: string, printer: string): StartIntent | null {
  const raw = kv.getString(key(scope, printer));
  if (!raw) return null;
  // Corrupt storage fails closed: do not silently forget an uncertain command.
  const value = JSON.parse(raw);
  if (typeof value?.operation_id !== "string" || value.printer_id !== printer ||
      typeof value.filename !== "string") throw new Error("Stored print request needs recovery");
  return value;
}

export function beginIntent(scope: string, printer: string, filename: string, slots?: number[]) {
  const current = readIntent(scope, printer);
  if (current && current.operation?.holds_printer !== 0) {
    throw new Error("A previous print request still needs confirmation");
  }
  // Identity is not an authorization credential. Timestamp plus two random
  // components avoid reusing a request key across app restarts/devices.
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  const intent: StartIntent = { operation_id: id, printer_id: printer, filename,
    ams_mapping: slots ? [...slots] : undefined };
  kv.set(key(scope, printer), JSON.stringify(intent));
  return intent;
}

export function recordOperation(scope: string, operation: StartOperation) {
  const current = readIntent(scope, operation.printer_id);
  if (!current || current.operation_id !== operation.id ||
      (current.operation?.revision ?? -1) > operation.revision) return;
  kv.set(key(scope, operation.printer_id), JSON.stringify({ ...current, operation }));
}

export function startMessage(operation?: StartOperation | null): string {
  if (!operation) return "Start not confirmed. Checking this same request is safe; do not start another copy.";
  const labels: Record<string, string> = {
    accepted: "Request accepted — preparing file…",
    validating: "Checking file and filament settings…",
    staging: "Preparing printer file…",
    dispatching: "Sending start — not yet confirmed…",
    awaiting_observation: "Waiting for the printer to confirm it started…",
    observed_started: "Printer start observed.",
    outcome_unknown: "Start outcome unknown. Check the printer; another start is blocked.",
    rejected_before_dispatch: "File rejected before start. No start command was sent.",
    canceled_before_dispatch: "Request canceled before start.",
    completed: "Print completed.",
    canceled: "Print stopped.",
    resolved_unknown: "Tracking resolved by the owner; physical outcome was unknown.",
  };
  return labels[operation.state] ?? "Checking print request…";
}

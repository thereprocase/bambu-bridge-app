import { request } from "./client";
import { Job, QueueItem, Spool } from "./types";

export function listJobs(params?: { printer_id?: string; limit?: number }) {
  return request<Job[]>("/jobs", { query: params });
}

export interface StartOperation {
  id: string;
  printer_id: string;
  job_id: string;
  state: string;
  holds_printer: number;
  revision: number;
  reason: string | null;
}

export function getStartOperation(id: string) {
  return request<StartOperation>(`/start-operations/${encodeURIComponent(id)}`);
}

export function getActiveStart(printerId: string) {
  return request<StartOperation | null>(`/printers/${encodeURIComponent(printerId)}/start-operation`);
}

/** One durable intent; an accepted request is not yet a physical print. */
export async function submitPrint(body: {
  operation_id: string;
  printer_id: string;
  filename: string;
  ams_mapping?: number[]; // Physical slots 1–4; the bridge converts to protocol indices.
}) {
  return request<StartOperation>(`/printers/${encodeURIComponent(body.printer_id)}/start-operations`, {
    method: "POST",
    body: { operation_id: body.operation_id, file_name: body.filename, ams_mapping: body.ams_mapping },
  });
}

export function canStartStoredPrint(snapshot: Record<string, unknown> | null, live: boolean): boolean {
  const session = snapshot?.session;
  const timestamp = session && typeof session === "object"
    ? (session as Record<string, unknown>).last_telemetry_at : undefined;
  const age = typeof timestamp === "string" ? Date.now() - Date.parse(timestamp) : Infinity;
  return live && !!session && typeof session === "object" && !Array.isArray(session) &&
    age >= 0 && age <= 15_000 &&
    (session as Record<string, unknown>).connected === true &&
    (snapshot?.phase === "idle" || snapshot?.phase === "completed");
}

export function cancelJob(id: string) {
  return request<{ id: string; state: Job["state"] }>(`/jobs/${id}/cancel`, {
    method: "POST",
  });
}

// Queue (PR 0984f2d) ----------------------------------------------------------

export function listQueue(printerId: string) {
  return request<QueueItem[]>(`/printers/${printerId}/queue`);
}

export function enqueue(
  printerId: string,
  body: { filename: string; physical_slot?: number },
) {
  return request<QueueItem>(`/printers/${printerId}/queue`, {
    method: "POST",
    body: { file_path: `/${body.filename}`, file_name: body.filename,
      ams_mapping: body.physical_slot == null ? undefined : [body.physical_slot] },
  });
}

export function dequeue(_printerId: string, queueItemId: string) {
  return request<void>(`/queue/${encodeURIComponent(queueItemId)}`, {
    method: "DELETE",
  });
}

// Spools ----------------------------------------------------------------------

export function listSpools() {
  return request<Spool[]>("/spools");
}

export function createSpool(body: Omit<Spool, "id">) {
  return request<Spool>("/spools", { method: "POST", body });
}

export function deleteSpool(id: string) {
  return request<void>(`/spools/${id}`, { method: "DELETE" });
}

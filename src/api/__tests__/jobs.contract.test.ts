import { canStartStoredPrint, dequeue, enqueue, submitPrint } from "../jobs";
import { request } from "../client";

jest.mock("../client", () => ({ request: jest.fn() }));
beforeEach(() => jest.mocked(request).mockReset());

it("starts a stored file with one durable identity and physical AMS slots", async () => {
  jest.mocked(request).mockResolvedValueOnce({ id: "intent-synthetic", job_id: "job-1", state: "accepted" });
  await expect(submitPrint({ operation_id: "intent-synthetic", printer_id: "synthetic", filename: "part.gcode.3mf", ams_mapping: [4] }))
    .resolves.toMatchObject({ job_id: "job-1", state: "accepted" });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("/printers/synthetic/start-operations", { method: "POST",
    body: { operation_id: "intent-synthetic", file_name: "part.gcode.3mf", ams_mapping: [4] } });
});

it("does not automatically retry or delete after a lost start response", async () => {
  jest.mocked(request).mockRejectedValueOnce(new Error("response lost"));
  await expect(submitPrint({ operation_id: "intent-synthetic", printer_id: "synthetic", filename: "part.gcode.3mf" })).rejects.toThrow("response lost");
  expect(request).toHaveBeenCalledTimes(1);
});

it("uses the current queue add and delete endpoints", async () => {
  jest.mocked(request).mockResolvedValue({ id: "queue-2" });
  await enqueue("synthetic", { filename: "part.gcode.3mf", physical_slot: 1 });
  expect(request).toHaveBeenCalledWith("/printers/synthetic/queue", { method: "POST",
    body: { file_path: "/part.gcode.3mf", file_name: "part.gcode.3mf", ams_mapping: [1] } });
  await dequeue("synthetic", "queue-2");
  expect(request).toHaveBeenLastCalledWith("/queue/queue-2", { method: "DELETE" });
});

it.each(["printing", "preparing", "paused", "failed", "unknown"])("does not start another print in %s", (phase) => {
  expect(canStartStoredPrint({ phase, session: { connected: true } }, true)).toBe(false);
});
it("requires both a fresh socket snapshot and a connected printer", () => {
  const idle = { phase: "idle", session: { connected: true, last_telemetry_at: new Date().toISOString() } };
  expect(canStartStoredPrint(idle, true)).toBe(true);
  expect(canStartStoredPrint(idle, false)).toBe(false);
  expect(canStartStoredPrint({ phase: "idle", session: { connected: false } }, true)).toBe(false);
  expect(canStartStoredPrint(null, true)).toBe(false);
  expect(canStartStoredPrint({ ...idle, session: { connected: true } }, true)).toBe(false);
});

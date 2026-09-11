import { beginIntent, readIntent, recordOperation } from "../startIntent";
import { kv } from "../../lib/kv";

jest.mock("../../lib/kv", () => {
  const values = new Map<string, string>();
  return { kv: { getString: (k: string) => values.get(k),
    set: (k: string, v: string) => values.set(k, v), clearAll: () => values.clear() } };
});
beforeEach(() => kv.clearAll());

it("persists before send, blocks another tap, and survives reading again", () => {
  const intent = beginIntent("bridge", "printer", "part.3mf", [2]);
  expect(readIntent("bridge", "printer")).toEqual(intent);
  expect(() => beginIntent("bridge", "printer", "other.3mf")).toThrow();
  expect(beginIntent("other-bridge", "printer", "part.3mf").operation_id).not.toBe(intent.operation_id);
});

it("ignores old responses and permits a new identity only after release", () => {
  const intent = beginIntent("bridge", "printer", "part.3mf");
  const operation = { id: intent.operation_id, printer_id: "printer", job_id: "job",
    revision: 3, holds_printer: 1, state: "outcome_unknown", reason: null };
  recordOperation("bridge", operation);
  recordOperation("bridge", { ...operation, revision: 2, holds_printer: 0 });
  expect(readIntent("bridge", "printer")?.operation?.holds_printer).toBe(1);
  expect(() => beginIntent("bridge", "printer", "part.3mf")).toThrow();
  recordOperation("bridge", { ...operation, revision: 4, holds_printer: 0, state: "completed" });
  const next = beginIntent("bridge", "printer", "part.3mf");
  recordOperation("bridge", { ...operation, revision: 5 });
  expect(next.operation_id).not.toBe(intent.operation_id);
  expect(readIntent("bridge", "printer")).toEqual(next);
});

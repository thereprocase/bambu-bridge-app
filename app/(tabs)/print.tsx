/**
 * Print — browse remote files on the printer's FTPS share and submit a
 * print. Real endpoints only (operator no-stubs directive):
 *   - GET /printers/{id}/files?dir= — listing (root; .gcode and .3mf live here)
 *   - POST /jobs — submit
 *
 * AMS slot picker is shown only when the printer has loaded slots; pick
 * one or "auto" (no `ams_mapping` → printer uses currently-loaded).
 */

import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";

import { BridgeError } from "../../src/api/errors";
import { listFiles, type RemoteFile } from "../../src/api/files";
import { qaLog } from "../../src/lib/qalog";
import { canStartStoredPrint, getStartOperation, getActiveStart, submitPrint, type StartOperation } from "../../src/api/jobs";
import { beginIntent, readIntent, recordOperation, startMessage } from "../../src/store/startIntent";
import { useBridgeStore } from "../../src/store/bridge";
import { Button } from "../../src/components/Button";
import { Surface } from "../../src/components/Surface";
import { useToastStore } from "../../src/components/Toast";
import { viewOf } from "../../src/lib/snapshot";
import { useLiveStore } from "../../src/store/live";
import { usePrintersStore } from "../../src/store/printers";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function PrintScreen() {
  const { c, space, type } = useTheme();
  const showToast = useToastStore((s) => s.show);
  const selectedId = usePrintersStore((s) => s.selectedId);
  const live = useLiveStore((s) => (selectedId ? s.printers[selectedId] : undefined));
  const view = viewOf((live?.snapshot as any) ?? null);

  // Currently-printing job name from live store (§6 job.subtask_name).
  const activeJobName: string | null = (live?.snapshot as any)?.job?.subtask_name ?? null;

  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const submissionActive = useRef(false);
  const focused = useIsFocused();
  const scope = useBridgeStore((s) => s.pairing?.spki ?? s.baseUrl);
  const [operation, setOperation] = useState<StartOperation | null>(null);
  const [startBlocked, setStartBlocked] = useState(true);
  const [startNotice, setStartNotice] = useState<string | null>(null);
  const [recheck, setRecheck] = useState(0);
  const canPrint = !startBlocked && canStartStoredPrint(live?.snapshot ?? null, live?.status === "open");
  const [pickedSlot, setPickedSlot] = useState<number | null>(null);

  async function refresh() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      const arr = await listFiles(selectedId);
      // Server returns files newest-first; preserve that order — no re-sort.
      // Filter to .gcode and .3mf only (P1S can't print other formats).
      const filtered = arr.filter((f) => /\.3mf$/i.test(f.name));
      setFiles(filtered);
      qaLog("files.order", {
        dir: "",
        count: filtered.length,
        dated_count: filtered.filter((f) => f.modified_at || f.sliced_at).length,
      });
    } catch (e) {
      const message = e instanceof BridgeError ? e.envelope.message : String(e);
      setError(message);
      qaLog("files.error", { code: e instanceof BridgeError ? e.code : "network_error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (focused && AppState.currentState === "active") refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, focused]);

  useEffect(() => {
    setStartBlocked(true);
    setOperation(null);
    setStartNotice(null);
    if (!focused || !selectedId) return;
    let disposed = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      if (disposed || busy || AppState.currentState !== "active") return;
      busy = true;
      let again = false;
      try {
        const intent = readIntent(scope, selectedId!);
        const local = intent ? await getStartOperation(intent.operation_id) : null;
        if (disposed || AppState.currentState !== "active") return;
        if (local) recordOperation(scope, local);
        const active = await getActiveStart(selectedId!);
        if (disposed) return;
        if (readIntent(scope, selectedId!)?.operation_id !== intent?.operation_id) {
          throw new Error("Request changed while checking");
        }
        const latest = active ?? local;
        setOperation(latest);
        setStartNotice(latest ? startMessage(latest) : null);
        setStartBlocked(!!active || (!!intent && local?.holds_printer !== 0));
        again = !!latest?.holds_printer && latest.state !== "outcome_unknown";
      } catch {
        if (!disposed) {
          setStartBlocked(true);
          setStartNotice(startMessage());
        }
      } finally {
        busy = false;
        // Never overlap reads or leave a timer running on a hidden screen.
        if (!disposed && again && AppState.currentState === "active") {
          timer = setTimeout(check, 2000);
        }
      }
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (timer) clearTimeout(timer);
      if (state === "active") void check();
    });
    void check();
    return () => { disposed = true; if (timer) clearTimeout(timer); subscription.remove(); };
  }, [scope, selectedId, focused, recheck]);

  async function submit(f: RemoteFile) {
    if (!selectedId || !canPrint || submissionActive.current) return;
    submissionActive.current = true;
    setSubmitting(f.name);
    setStartBlocked(true);
    try {
      const intent = beginIntent(scope, selectedId, f.name,
        pickedSlot != null ? [pickedSlot] : undefined);
      const res = await submitPrint(intent);
      recordOperation(scope, res);
      setOperation(res);
      setStartNotice(startMessage(res));
      showToast("Request accepted; waiting for printer confirmation", { severity: "success" });
    } catch (e) {
      showToast(
        e instanceof BridgeError ? e.envelope.message : String(e),
        { severity: "danger" }
      );
    } finally {
      submissionActive.current = false;
      setSubmitting(null);
      setRecheck((n) => n + 1);
    }
  }

  async function retrySameRequest() {
    if (!selectedId || submissionActive.current ||
        !canStartStoredPrint(live?.snapshot ?? null, live?.status === "open")) return;
    submissionActive.current = true;
    try {
      const intent = readIntent(scope, selectedId);
      if (!intent) return;
      const result = await submitPrint(intent);
      recordOperation(scope, result);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not confirm request", { severity: "danger" });
    } finally {
      submissionActive.current = false;
      setRecheck((n) => n + 1);
    }
  }

  if (!selectedId) {
    return (
      <View style={{ flex: 1, padding: space.lg }}>
        <Text style={[type.body, { color: c.muted }]}>Add a printer in Settings.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg }}
      refreshControl={<RefreshControl refreshing={loading} tintColor={c.accent} onRefresh={refresh} />}
    >
      {startNotice && (
        <Surface padded style={{ gap: space.sm }}>
          <Text style={[type.body, { color: c.text }]}>{startNotice}</Text>
          {operation?.reason && <Text style={[type.small, { color: c.muted }]}>{operation.reason}</Text>}
          <Button label="Check request status" onPress={() => setRecheck((n) => n + 1)} />
          {!operation && <Button label="Resend same request" onPress={retrySameRequest}
            disabled={!canStartStoredPrint(live?.snapshot ?? null, live?.status === "open")} />}
        </Surface>
      )}
      {/* AMS slot picker --------------------------------------------------- */}
      {view.ams.length > 0 && (
        <Surface padded style={{ gap: space.sm }}>
          <Text style={[type.h2, { color: c.text }]}>AMS slot</Text>
          <Text style={[type.small, { color: c.muted }]}>
            &quot;Auto&quot; means the printer uses whatever filament is currently
            loaded. Pick a slot to force load before printing.
          </Text>
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <SlotPill label="Auto" picked={pickedSlot == null} onPress={() => setPickedSlot(null)} />
            {view.ams.map((slot) => (
              <SlotPill
                key={slot.physicalSlot}
                label={`Slot ${slot.physicalSlot}`}
                color={slot.color ?? undefined}
                disabled={slot.empty}
                picked={pickedSlot === slot.physicalSlot}
                onPress={() => setPickedSlot(slot.physicalSlot)}
              />
            ))}
          </View>
        </Surface>
      )}

      {/* File list --------------------------------------------------------- */}
      <Surface padded style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[type.h2, { color: c.text, flex: 1 }]}>Files on printer</Text>
          <Pressable onPress={refresh}>
            <Text style={[type.small, { color: c.accent }]}>Refresh</Text>
          </Pressable>
        </View>
        {!canPrint && <Text style={[type.small, { color: c.muted }]}>
          The printer must be connected and ready before starting another print.
        </Text>}
        {error && <Text style={[type.small, { color: c.danger }]}>{error}</Text>}
        {!loading && !error && files.length === 0 && (
          <Text style={[type.small, { color: c.muted }]}>No .3mf files yet.</Text>
        )}
        {sortedFiles(files, activeJobName).map((f, idx) => {
          const fileBase = basename(f.name);
          const activeBase = activeJobName != null ? basename(activeJobName) : "";
          const isPrinting = ["preparing", "printing", "paused"].includes(String(live?.snapshot?.phase)) && activeJobName != null && (
            fileBase === activeBase ||
            (stem(activeBase).length > 0 && stem(fileBase) === stem(activeBase))
          );
          return (
            <View
              key={f.name}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                borderTopWidth: idx > 0 ? 1 : 0,
                borderTopColor: c.borderSoft,
                paddingTop: idx > 0 ? space.md : 0,
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
                  <Text style={[type.body, { color: c.text }]}>{f.name}</Text>
                  {isPrinting && (
                    <View style={{
                      backgroundColor: c.accent,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 999,
                    }}>
                      <Text style={{ color: "#0a0b0d", fontSize: 11, fontWeight: "600" }}>
                        printing now
                      </Text>
                    </View>
                  )}
                </View>
                {f.size != null && (
                  <Text style={[type.caption, { color: c.muted }]}>{formatSize(f.size)}</Text>
                )}
                {fileDateLine(f) != null && (
                  <Text style={[type.caption, { color: c.muted }]}>{fileDateLine(f)}</Text>
                )}
              </View>
              <Button
                label={submitting === f.name ? "Sending request…" : "Print"}
                onPress={() => submit(f)}
                loading={submitting === f.name}
                disabled={!canPrint || submitting !== null}
              />
            </View>
          );
        })}
      </Surface>
    </ScrollView>
  );
}

/** Extract the bare filename (no directory) from a path like "/sdcard/foo.3mf". */
function basename(p: string): string {
  return p.replace(/.*[/\\]/, "");
}

/**
 * Strip a trailing print-file extension (.gcode.3mf, .gcode, .3mf — case-insensitive)
 * from a bare filename. Returns the input unchanged when no extension matches.
 * Guard: returns empty string only when the input itself is empty.
 */
function stem(name: string): string {
  return name.replace(/\.(gcode\.3mf|gcode|3mf)$/i, "");
}

/**
 * Returns files with the currently-printing file pinned at position 0.
 * Matching strategy:
 *   1. Exact basename match (cheap, no false positives).
 *   2. Stem match — Bambu's job.subtask_name omits the file extension, so
 *      "weather_station_reflector" must match "weather_station_reflector.gcode.3mf".
 *      Only applied when the stem is non-empty.
 * Server order is preserved for all other entries (no re-sort).
 */
function sortedFiles(files: RemoteFile[], activeJobName: string | null): RemoteFile[] {
  if (!activeJobName) return files;
  const active = basename(activeJobName);
  // 1. Exact basename match.
  let idx = files.findIndex((f) => basename(f.name) === active);
  // 2. Stem fallback — only when no exact match and the stem is non-empty.
  if (idx === -1) {
    const activeStem = stem(active);
    if (activeStem) {
      idx = files.findIndex((f) => stem(basename(f.name)) === activeStem);
    }
  }
  if (idx <= 0) return files; // already first or not found
  const out = [...files];
  const [pinned] = out.splice(idx, 1);
  out.unshift(pinned);
  return out;
}

function SlotPill({ label, color, picked, disabled, onPress }: {
  label: string; color?: string; picked: boolean; disabled?: boolean; onPress: () => void;
}) {
  const { c, space, radius } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        backgroundColor: picked ? c.accent : c.surface2,
        borderRadius: radius.pill,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {color && (
        <View style={{ width: 12, height: 12, backgroundColor: color, borderRadius: 6 }} />
      )}
      <Text style={{ color: picked ? "#0a0b0d" : c.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Returns a short secondary label for a file based on its sort_basis and
 * the corresponding timestamp, e.g. "sliced 5/19" or "modified 6/1".
 * Returns null when sort_basis is "none", absent, or no timestamp is available.
 */
function fileDateLine(f: RemoteFile): string | null {
  const basis = f.sort_basis;
  if (!basis || basis === "none") return null;
  let ts: string | null | undefined;
  if (basis === "sliced") ts = f.sliced_at;
  else if (basis === "modified") ts = f.modified_at;
  else if (basis === "created") ts = f.created_at;
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${basis} ${month}/${day}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

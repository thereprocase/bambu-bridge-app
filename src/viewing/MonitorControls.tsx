import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { AppState, Text } from "react-native";
import { Button } from "../components/Button";
import { Surface } from "../components/Surface";
import { useTheme } from "../theme/ThemeProvider";
import { startMonitoring, viewingNative } from "./native";

export function MonitorControls({ printer }: { printer: string }) {
  const { c, type, space } = useTheme();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [status, setStatus] = useState<Awaited<ReturnType<typeof viewingNative.monitorStatus>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!focused || !foreground) return;
    let cancelled = false;
    const refresh = () => { void viewingNative.monitorStatus().then(value => { if (!cancelled) setStatus(value); }).catch(() => {}); };
    refresh(); const timer = setInterval(refresh, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [focused, foreground]);
  async function toggle() {
    setBusy(true); setError("");
    try {
      if (status?.running) await viewingNative.stopMonitor();
      else await startMonitoring(printer);
      setStatus(await viewingNative.monitorStatus());
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't change monitoring. Try again."); }
    finally { setBusy(false); }
  }
  async function delivery(homeAssistant: boolean) {
    setBusy(true); setError("");
    try {
      await viewingNative.setHomeAssistantAlerts(homeAssistant);
      setStatus(await viewingNative.monitorStatus());
    } catch { setError("Couldn't change alert delivery. Try again."); }
    finally { setBusy(false); }
  }
  const state = !status?.running ? "Off" : status.printer !== printer ? "Monitoring another printer"
    : status.state === "connected" ? "On · connected" : status.state === "printer_offline" ? "On · printer offline"
    : "On · reconnecting; alerts may be delayed";
  return <Surface padded style={{ gap: space.sm }}>
    <Text style={[type.h2, { color: c.text }]}>Print alerts · {status?.homeAssistant ? "Home Assistant" : state}</Text>
    {status?.homeAssistant ? <>
      <Text style={[type.small, { color: c.muted }]}>Beluga stops monitoring when you leave the app. Set up and test your printer alerts in Home Assistant; this switch does not configure them. Notifications arrive through the Home Assistant app.</Text>
      <Button label="Use app monitoring instead" disabled={busy} variant="secondary" onPress={() => { void delivery(false); }} />
    </> : <>
      <Text style={[type.small, { color: c.muted }]}>App monitoring keeps a background connection for print alerts. If Home Assistant delivers your alerts, turn it off here so Beluga can sleep.</Text>
      <Button label={busy ? "Updating…" : status?.running ? "Stop monitoring" : "Enable app monitoring"} disabled={busy || !status} onPress={() => { void toggle(); }} />
      <Button label="Use Home Assistant alerts" disabled={busy || !status} variant="secondary" onPress={() => { void delivery(true); }} />
    </>}
    {!status?.homeAssistant && status?.running && status.batteryRestricted && <>
      <Text style={[type.small, { color: c.muted }]}>Android may delay alerts during deep sleep. Allow the background connection for more reliable alerts while locked.</Text>
      <Button label="Allow background connection" variant="secondary" onPress={() => viewingNative.batterySettings()} />
    </>}
    {error ? <Text style={[type.small, { color: c.danger }]}>{error}</Text> : null}
  </Surface>;
}

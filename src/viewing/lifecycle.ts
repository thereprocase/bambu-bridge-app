import * as Network from "expo-network";
import { useEffect } from "react";
import { AppState } from "react-native";
import { resetEndpointCache } from "../api/endpoint";
import { cancelSnapshotCache, flushSnapshotCache, useLiveStore } from "../store/live";
import { useBridgeStore } from "../store/bridge";
import { useViewingStore } from "./state";
import { viewingNative } from "./native";

export const BACKGROUND_GRACE_MS = 60_000;

/** Network/foreground changes restart reads only. Never replay a printer command. */
export function useConnectionLifecycle() {
  useEffect(() => {
    let previous = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sleepTimer: ReturnType<typeof setTimeout> | undefined;
    let hiddenAt: number | undefined;
    let networkChanged = false;
    const stopConnections = () => {
      for (const conn of Object.values(useLiveStore.getState().conns)) conn.stop();
    };
    const refresh = () => {
      if (timer) clearTimeout(timer);
      if (AppState.currentState !== "active") return;
      timer = setTimeout(() => {
        timer = undefined;
        if (AppState.currentState !== "active") return;
        if (networkChanged) {
          resetEndpointCache();
          useViewingStore.getState().invalidateNetwork();
          stopConnections();
          networkChanged = false;
        }
        // start() is idempotent: a short trip away reuses the existing socket.
        for (const conn of Object.values(useLiveStore.getState().conns)) conn.start();
      }, 300);
    };
    const net = Network.addNetworkStateListener(state => {
      const key = JSON.stringify([state.type, state.isConnected, state.isInternetReachable]);
      if (key !== previous) {
        networkChanged = previous !== "" || networkChanged;
        previous = key;
        if (networkChanged && AppState.currentState !== "active") stopConnections();
        refresh();
      }
    });
    const foreground = AppState.addEventListener("change", state => {
      if (state === "active") {
        if (sleepTimer) clearTimeout(sleepTimer);
        sleepTimer = undefined;
        // Android may suspend JS timers. Expire the old socket on resume too.
        if (hiddenAt !== undefined && Date.now() - hiddenAt >= BACKGROUND_GRACE_MS) stopConnections();
        hiddenAt = undefined;
        refresh();
      }
      else {
        if (timer) clearTimeout(timer);
        flushSnapshotCache();
        if (hiddenAt === undefined) {
          hiddenAt = Date.now();
          sleepTimer = setTimeout(() => { sleepTimer = undefined; stopConnections(); }, BACKGROUND_GRACE_MS);
        }
      }
    });
    // A background service must not keep an old credential after changing/disconnecting bridges.
    const config = useBridgeStore.subscribe((next, old) => {
      if (old.bootstrapped && (next.bearer !== old.bearer || next.pairing?.spki !== old.pairing?.spki ||
          next.baseUrl !== old.baseUrl || next.baseUrlLan !== old.baseUrlLan)) {
        void viewingNative?.stopMonitor().catch(() => {});
        for (const conn of Object.values(useLiveStore.getState().conns)) conn.stop();
        cancelSnapshotCache();
        networkChanged = true;
        refresh();
      }
    });
    return () => {
      net.remove(); foreground.remove(); config();
      if (timer) clearTimeout(timer);
      if (sleepTimer) clearTimeout(sleepTimer);
      stopConnections(); flushSnapshotCache();
    };
  }, []);
}

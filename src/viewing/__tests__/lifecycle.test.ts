import { useConnectionLifecycle } from "../lifecycle";
import { cancelSnapshotCache, flushSnapshotCache } from "../../store/live";

const mockConn = { stop: jest.fn(), start: jest.fn() };
const mockReset = jest.fn();
const mockRevision = jest.fn();
const mockStopMonitor = jest.fn().mockResolvedValue(undefined);
let mockAppListener: (state: string) => void;
let mockNetworkListener: (state: Record<string, unknown>) => void;
let mockConfigListener: (next: Record<string, unknown>, old: Record<string, unknown>) => void;
const mockAppState = { currentState: "active", addEventListener: jest.fn((_name, cb) => {
  mockAppListener = cb; return { remove: jest.fn() };
}) };
let mockCleanup: (() => void) | undefined;
jest.mock("react", () => ({ useEffect: (fn: () => () => void) => { mockCleanup = fn(); } }));
jest.mock("react-native", () => ({ get AppState() { return mockAppState; } }));
jest.mock("expo-network", () => ({ addNetworkStateListener: jest.fn(cb => { mockNetworkListener = cb; return { remove: jest.fn() }; }) }));
jest.mock("../../api/endpoint", () => ({ resetEndpointCache: () => mockReset() }));
jest.mock("../../store/live", () => ({ useLiveStore: { getState: () => ({ conns: { fixture: mockConn } }) }, flushSnapshotCache: jest.fn(), cancelSnapshotCache: jest.fn() }));
jest.mock("../../store/bridge", () => ({ useBridgeStore: { subscribe: (fn: typeof mockConfigListener) => {
  mockConfigListener = fn; return jest.fn();
} } }));
jest.mock("../state", () => ({ useViewingStore: { getState: () => ({ invalidateNetwork: () => mockRevision() }) } }));
jest.mock("../native", () => ({ viewingNative: { stopMonitor: () => mockStopMonitor() } }));

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockAppState.currentState = "active"; useConnectionLifecycle(); });
afterEach(() => { mockCleanup?.(); jest.useRealTimers(); });

test("a short app switch reuses the socket without invalidating the route or viewer", () => {
  mockAppState.currentState = "background"; mockAppListener("background");
  jest.advanceTimersByTime(30_000);
  expect(mockConn.stop).not.toHaveBeenCalled();
  expect(mockConn.start).not.toHaveBeenCalled();
  mockAppState.currentState = "active"; mockAppListener("active"); jest.advanceTimersByTime(300);
  expect(mockConn.start).toHaveBeenCalledTimes(1);
  expect(mockReset).not.toHaveBeenCalled();
  expect(mockRevision).not.toHaveBeenCalled();
  expect(flushSnapshotCache).toHaveBeenCalledTimes(1);
});

test("a minute in the background closes telemetry and cancels its pending work", () => {
  mockAppState.currentState = "background"; mockAppListener("background");
  jest.advanceTimersByTime(59_999); expect(mockConn.stop).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1); expect(mockConn.stop).toHaveBeenCalledTimes(1);
  expect(mockConn.start).not.toHaveBeenCalled();
});

test("network changes while hidden close the old socket without starting background reconnects", () => {
  mockNetworkListener({ type: "wifi", isConnected: true }); jest.advanceTimersByTime(300);
  mockConn.start.mockClear();
  mockAppState.currentState = "background"; mockAppListener("background");
  mockNetworkListener({ type: "cellular", isConnected: true });
  expect(mockConn.stop).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1000); expect(mockConn.start).not.toHaveBeenCalled();
  mockAppState.currentState = "active"; mockAppListener("active");
  mockAppListener("active"); jest.advanceTimersByTime(300);
  expect(mockConn.start).toHaveBeenCalledTimes(1);
  expect(mockReset).toHaveBeenCalledTimes(1);
  expect(mockRevision).toHaveBeenCalledTimes(1);
});

test("resume expires a grace timer Android suspended without running", () => {
  mockAppState.currentState = "background"; mockAppListener("background");
  jest.setSystemTime(Date.now() + 120_000);
  mockAppState.currentState = "active"; mockAppListener("active");
  expect(mockConn.stop).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(300); expect(mockConn.start).toHaveBeenCalledTimes(1);
});

test("initial credential bootstrap preserves an existing native monitor", () => {
  mockConfigListener({ bearer: "fixture" }, { bootstrapped: false, bearer: null });
  expect(mockStopMonitor).not.toHaveBeenCalled();
  mockConfigListener({ bearer: null }, { bootstrapped: true, bearer: "fixture" });
  expect(mockStopMonitor).toHaveBeenCalledTimes(1);
  expect(mockConn.stop).toHaveBeenCalledTimes(1);
  expect(cancelSnapshotCache).toHaveBeenCalledTimes(1);
});

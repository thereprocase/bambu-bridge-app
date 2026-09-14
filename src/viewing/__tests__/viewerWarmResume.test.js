import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import ViewerScreen from "../../../app/viewer";

let mockListener;
const mockAppState = { currentState: "active", addEventListener: (_event, cb) => {
  mockListener = cb; return { remove: jest.fn() };
} };
const mockBuild = jest.fn(async () => "https://bridge.invalid/viewer");
const mockInject = jest.fn();
jest.mock("react-native", () => ({ get AppState() { return mockAppState; }, View: "View", Text: "Text",
  ActivityIndicator: "Spinner", BackHandler: { addEventListener: () => ({ remove: jest.fn() }) } }));
jest.mock("react-native-webview", () => {
  const React = require("react");
  return React.forwardRef(function MockWebView(props, ref) {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }));
    return React.createElement("WebView", props);
  });
});
jest.mock("expo-router", () => ({ Stack: { Screen: "StackScreen" }, useFocusEffect: () => {},
  useLocalSearchParams: () => ({ printer: "fixture" }), useRouter: () => ({ back: jest.fn() }) }));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("../../pairing/PairedViewer", () => ({ PairedViewer: "PairedViewer" }));
jest.mock("../../api/endpoint", () => ({ notifyRequestFailed: jest.fn() }));
jest.mock("../../api/viewer", () => ({ buildViewerUrl: () => mockBuild(), isViewerNavigationAllowed: () => true, safeVizTimings: () => ({}) }));
jest.mock("../../store/bridge", () => ({ useBridgeStore: fn => fn({ baseUrl: "https://bridge.invalid", bearer: "fixture", pairing: null }) }));
jest.mock("../../components/Button", () => ({ Button: "Button" }));
jest.mock("../../lib/qalog", () => ({ qaLog: jest.fn() }));
jest.mock("../../theme/ThemeProvider", () => ({ useTheme: () => ({ c: {}, space: {}, type: {} }) }));
jest.mock("../screen", () => ({ useViewingScreen: () => {} }));
jest.mock("../state", () => ({ useViewingStore: fn => fn({ networkRevision: 0 }) }));
jest.mock("../lifecycle", () => ({ BACKGROUND_GRACE_MS: 60_000 }));

let tree;
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockAppState.currentState = "active"; });
afterEach(async () => { if (tree) await act(async () => { tree.unmount(); }); tree = null; jest.useRealTimers(); });
async function open(lifecycle) {
  await act(async () => { tree = create(<ViewerScreen />); });
  await act(async () => { tree.root.findByType("WebView").props.onMessage({ nativeEvent: {
    data: JSON.stringify({ type: "viz.state", state: "ready", lifecycle }),
  } }); });
}
async function state(value) {
  await act(async () => { mockAppState.currentState = value; mockListener(value); });
}
test("a supported viewer pauses in place and returns without resolving or loading again", async () => {
  await open(1);
  await state("background");
  expect(tree.root.findAllByType("WebView")).toHaveLength(1);
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining("setActive(false)"));
  await act(async () => { jest.advanceTimersByTime(30_000); });
  await state("active");
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining("setActive(true)"));
  expect(mockBuild).toHaveBeenCalledTimes(1);
});
test("a warm viewer is released after a minute and loads normally on return", async () => {
  await open(1); await state("background");
  await act(async () => { jest.advanceTimersByTime(60_000); });
  expect(tree.root.findAllByType("WebView")).toHaveLength(0);
  await state("active");
  expect(mockBuild).toHaveBeenCalledTimes(2);
});
test("an older viewer unloads immediately rather than retaining unpausable work", async () => {
  await open(undefined); await state("background");
  expect(tree.root.findAllByType("WebView")).toHaveLength(0);
  await state("active");
  expect(mockBuild).toHaveBeenCalledTimes(2);
});

import React from "react";
import { expect, jest, test } from "@jest/globals";
import { act, create } from "react-test-renderer";
import { MonitorControls } from "../MonitorControls";

let mockFocused = true;
let mockListener;
const mockRemove = jest.fn();
const mockStatus = jest.fn(async () => ({ running: true, printer: "fixture", state: "connected" }));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => mockFocused }));
jest.mock("react-native", () => ({ Text: "Text", AppState: {
  currentState: "active", addEventListener: (_event, listener) => {
    mockListener = listener; return { remove: mockRemove };
  },
} }));
jest.mock("../../components/Button", () => ({ Button: "Button" }));
jest.mock("../../components/Surface", () => ({ Surface: "Surface" }));
jest.mock("../../theme/ThemeProvider", () => ({ useTheme: () => ({ c: {}, type: {}, space: {} }) }));
jest.mock("../native", () => ({ viewingNative: { monitorStatus: () => mockStatus() } }));

test("a focused screen stops monitor-status polling while backgrounded and resumes on return", async () => {
  jest.useFakeTimers(); mockFocused = true;
  let tree;
  try {
    await act(async () => { tree = create(<MonitorControls printer="fixture" />); });
    expect(mockStatus).toHaveBeenCalledTimes(1);
    await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
    expect(mockStatus).toHaveBeenCalledTimes(2);
    await act(async () => { mockListener("background"); });
    mockStatus.mockClear();
    await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
    expect(mockStatus).not.toHaveBeenCalled();
    await act(async () => { mockListener("active"); });
    expect(mockStatus).toHaveBeenCalledTimes(1);
    mockFocused = false;
    await act(async () => { tree.update(<MonitorControls printer="fixture" />); });
    mockStatus.mockClear();
    await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
    expect(mockStatus).not.toHaveBeenCalled();
  } finally {
    if (tree) await act(async () => { tree.unmount(); });
    jest.useRealTimers();
  }
  expect(mockRemove).toHaveBeenCalledTimes(1);
});

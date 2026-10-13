import { act, renderHook } from "@testing-library/react-native";
import { usePerformance } from "../usePerformance";
const mockNav = { deviceFresh: true, fix: { sogKnots: 5 }, session: null };
const mockState = {
  isConnected: true,
  lastMessageTime: 0,
  sailingData: {
    recordingInstruments: { tws: 8 as number | null, twa: 60 as number | null },
  },
};
jest.mock("expo-router", () => ({ useFocusEffect: () => {} }));
jest.mock("../../navigation/NavigationContext", () => ({
  useNavigation: () => mockNav,
}));
jest.mock("../../context/BLEContext", () => ({
  useBLE: () => ({ state: mockState }),
}));
jest.mock("../../boats/privateBoats", () => ({ activePrivateBoat: jest.fn() }));
jest.mock("../repository", () => ({ polarRepository: { read: jest.fn() } }));
const polar = {
  id: "p",
  name: "Boat polar",
  source: "upload" as const,
  version: "1",
  createdAt: "2026-10-13T00:00:00Z",
  points: [{ tws: 8, twa: 60, speed: 5 }],
};
beforeEach(() => {
  jest.useFakeTimers();
  mockState.isConnected = true;
  mockNav.deviceFresh = true;
  mockState.lastMessageTime = Date.now();
  mockState.sailingData.recordingInstruments = { tws: 8, twa: 60 };
});
afterEach(() => jest.useRealTimers());
test("performance requires a boat, polar, connected sensor, valid wind and fresh readings", () => {
  const screen = renderHook<ReturnType<typeof usePerformance>, {boatId:string;polar:typeof polar|undefined}>(
    ({ boatId, polar: chart }) => usePerformance({ boatId, polar: chart }),
    { initialProps: { boatId: "a", polar: polar as typeof polar | undefined } },
  );
  expect(screen.result.current.result?.performancePercent).toBe(100);
  mockState.isConnected = false;
  screen.rerender({ boatId: "a", polar });
  expect(screen.result.current.result).toBeNull();
  mockState.isConnected = true;
  mockState.sailingData.recordingInstruments.tws = null;
  screen.rerender({ boatId: "a", polar });
  expect(screen.result.current.result).toBeNull();
  mockState.sailingData.recordingInstruments.tws = 8;
  screen.rerender({ boatId: "", polar });
  expect(screen.result.current.result).toBeNull();
  screen.rerender({ boatId: "a", polar: undefined });
  expect(screen.result.current.result).toBeNull();
  screen.rerender({ boatId: "a", polar });
  expect(screen.result.current.result?.performancePercent).toBe(100);
  act(() => jest.advanceTimersByTime(16000));
  expect(screen.result.current.result).toBeNull();
});

jest.mock("../../tracking/database",()=>({trackingStore:jest.fn()}));

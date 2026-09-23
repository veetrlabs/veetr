import { renderHook, waitFor } from "@testing-library/react-native";
import { useJoinedFleet } from "../useJoinedFleet";
import { racePhoneRpc } from "../../tracking/racePhone";
jest.mock("expo-router", () => ({
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, [fn]),
}));
jest.mock("../../tracking/racePhone", () => ({ racePhoneRpc: jest.fn() }));
jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove: jest.fn() }),
  },
}));
const position = {
  boatId: "competitor",
  boatName: "JOY",
  recordedAt: new Date().toISOString(),
  latitude: 50,
  longitude: 14,
  accuracyM: 5,
  sogMps: 1,
  cogDeg: 90,
  source: "phone",
  trail: [],
};
test("loads fleet with the joined phone credential and clears old race on switch", async () => {
  const now = Date.now(),
    start = now - 3600000;
  const points = [
    ...Array.from({ length: 80 }, (_, i) => ({
      ...position,
      boatId: "mine",
      sessionId: "own",
      recordedAt: new Date(start + i * 40000).toISOString(),
    })),
    {
      ...position,
      sessionId: "other",
      recordedAt: new Date(start).toISOString(),
    },
  ];
  (racePhoneRpc as jest.Mock).mockImplementation(async (_id, _name, args) => ({
    start: new Date(start).toISOString(),
    end: new Date(now).toISOString(),
    heats: [],
    chunks: [{ start, count: points.length, version: "one" }],
    points: args?.p_from ? points : [],
    more: false,
    append: false,
  }));
  const ui = renderHook<ReturnType<typeof useJoinedFleet>, { id: string }>(
    ({ id }) => useJoinedFleet(id),
    { initialProps: { id: "joined-link" } },
  );
  await waitFor(() => expect(ui.result.current.positions).toHaveLength(2));
  expect(racePhoneRpc).toHaveBeenCalledWith("joined-link", "race_phone_tracks");
  expect(
    ui.result.current.positions.find((p) => p.boatId === "mine")?.trail,
  ).toHaveLength(80);
  expect(
    ui.result.current.positions.find((p) => p.boatId === "competitor")
      ?.recordedAt,
  ).toBe(new Date(start).toISOString());
  (racePhoneRpc as jest.Mock).mockRejectedValue(new Error("revoked"));
  ui.rerender({ id: "different-link" });
  await waitFor(() => expect(ui.result.current.error).toContain("unavailable"));
  expect(ui.result.current.positions).toEqual([]);
  ui.unmount();
});
test("without a joined invitation no fleet request is made", () => {
  (racePhoneRpc as jest.Mock).mockClear();
  const ui = renderHook(() => useJoinedFleet());
  expect(racePhoneRpc).not.toHaveBeenCalled();
  ui.unmount();
});

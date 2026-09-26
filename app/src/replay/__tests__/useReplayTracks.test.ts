import { act, renderHook } from "@testing-library/react-native";
import { useReplayTracks } from "../useReplayTracks";
import { trackingRpc } from "../../tracking/client";
jest.mock("../../tracking/client", () => ({ trackingRpc: jest.fn() }));
const rpc = trackingRpc as jest.Mock;
const start = Date.parse("2026-09-24T10:00:00Z");
const point = (seconds: number) => ({
  boatId: "boat",
  boatName: "Boat",
  sessionId: "session",
  recordedAt: new Date(start + seconds * 1000).toISOString(),
  latitude: 49,
  longitude: 14,
  accuracyM: 5,
  sogMps: 1,
  cogDeg: 0,
  source: "phone",
});
const meta = {
  start: new Date(start).toISOString(),
  end: new Date(start + 10000).toISOString(),
  heats: [],
  chunks: [{ start, count: 2, version: "v1" }],
  points: [],
  more: false,
  append: false,
};
jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove: jest.fn() }),
  },
}));
async function settle() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(250);
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  rpc.mockReset();
});
afterEach(() => jest.useRealTimers());
test("own-only replay makes no network requests; enabling competitors loads all pages and hiding clears them", async () => {
  rpc.mockImplementation(async (_name, args) =>
    !args.p_from
      ? meta
      : args.p_offset === 0
        ? { ...meta, points: [point(0)], more: true }
        : { ...meta, points: [point(10)] },
  );
  const { result, rerender, unmount } = renderHook<
    ReturnType<typeof useReplayTracks>,
    { enabled: boolean }
  >(
    ({ enabled }) =>
      useReplayTracks("series", "event", undefined, start + 10000, enabled),
    { initialProps: { enabled: false } },
  );
  await settle();
  expect(rpc).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await settle();
  expect(result.current.error).toBe("");
  expect(result.current.positions[0].trail).toHaveLength(2);
  expect(rpc).toHaveBeenLastCalledWith(
    "public_replay_tracks",
    expect.objectContaining({
      p_series: "series",
      p_event: "event",
      p_offset: 1,
    }),
  );
  rerender({ enabled: false });
  await settle();
  expect(result.current.positions).toEqual([]);
  unmount();
});
test("failed fetch clears remote data and retry recovers", async () => {
  rpc.mockRejectedValue(new Error("offline"));
  const { result, unmount } = renderHook(() =>
    useReplayTracks("series", "event", undefined, start, true),
  );
  await settle();
  expect(result.current.error).toContain("unavailable");
  expect(result.current.positions).toEqual([]);
  rpc.mockImplementation(async (_name, args) =>
    args.p_from ? { ...meta, points: [point(0), point(10)] } : meta,
  );
  act(() => result.current.retry());
  await settle();
  expect(result.current.error).toBe("");
  expect(result.current.positions).toHaveLength(1);
  unmount();
});
test("revoked access clears cached competitor history on refresh", async () => {
  rpc.mockImplementation(async (_name, args) =>
    args.p_from ? { ...meta, points: [point(0)] } : meta,
  );
  const { result, unmount } = renderHook(() =>
    useReplayTracks("series", "event", undefined, start, true),
  );
  await settle();
  expect(result.current.positions).toHaveLength(1);
  rpc.mockRejectedValue(new Error("revoked"));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30000);
  });
  expect(result.current.positions).toEqual([]);
  expect(result.current.error).toContain("unavailable");
  unmount();
});

test('a late chunk cannot restore boats after a newer access failure', async () => {
  let complete!: (value: unknown) => void;
  const pending = new Promise(resolve => { complete = resolve; });
  rpc.mockImplementation(async (_name,args) => args.p_from ? pending : meta);
  const { result, unmount } = renderHook(() => useReplayTracks('series','event',undefined,start,true));
  await settle();
  rpc.mockRejectedValue(new Error('revoked'));
  await act(async () => { await jest.advanceTimersByTimeAsync(30000); });
  await act(async () => { complete({...meta,points:[point(0)]}); });
  expect(result.current.positions).toEqual([]);
  expect(result.current.error).toContain('unavailable');
  unmount();
});

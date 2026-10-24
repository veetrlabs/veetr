import { act, renderHook } from '@testing-library/react-native';
import { useTripSelection } from '../useTripSelection';
import type { TrackingPoint } from '../model';

const points = [0, 1, 2, 3].map(second => ({
  recordedAt: new Date(second * 1000).toISOString(), latitude: 49, longitude: 14,
  accuracyM: 5, sogMps: 1, cogDeg: 90, source: 'phone',
} as TrackingPoint));

test('follows latest samples from initial load and resumes after selecting the latest point', () => {
  const { result, rerender } = renderHook(({ data }: { data: TrackingPoint[] }) => useTripSelection('one', data), {
    initialProps: { data: [] as TrackingPoint[] },
  });
  rerender({ data: points.slice(0, 2) });
  expect(result.current.index).toBe(1);
  rerender({ data: points.slice(0, 3) });
  expect(result.current.index).toBe(2);
  act(() => result.current.select(0));
  rerender({ data: points });
  expect(result.current.index).toBe(0);
  act(() => result.current.select(3));
  rerender({ data: [...points, { ...points[3], recordedAt: new Date(4000).toISOString() }] });
  expect(result.current.index).toBe(4);
});

test('keeps the selected timestamp across refreshes and resets for another trip', () => {
  const { result, rerender } = renderHook(({ id, data }: { id: string; data: TrackingPoint[] }) => useTripSelection(id, data), {
    initialProps: { id: 'one', data: points },
  });
  act(() => result.current.select(1));
  rerender({ id: 'one', data: points.slice(1) });
  expect(result.current.index).toBe(0);
  rerender({ id: 'two', data: points });
  expect(result.current.index).toBe(3);
});

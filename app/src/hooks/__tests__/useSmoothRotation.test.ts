import { act, renderHook } from '@testing-library/react-native'
import { useSmoothRotation } from '../useSmoothRotation'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
test('keeps moving through frequent target updates and cleans up its clock', () => {
  const { result, rerender, unmount } = renderHook<number, { angle: number }>(({ angle }) => useSmoothRotation(angle, { duration: 500 }), { initialProps: { angle: 0 } })
  for (let i = 0; i < 20; i++) {
    rerender({ angle: i % 2 ? 91 : 89 })
    act(() => jest.advanceTimersByTime(50))
  }
  expect(result.current).toBeGreaterThan(85)
  expect(result.current).toBeLessThan(95)
  unmount()
  expect(jest.getTimerCount()).toBe(0)
})
test('crosses north by the short route and reaches the final target', () => {
  const { result, rerender, unmount } = renderHook<number, { angle: number }>(({ angle }) => useSmoothRotation(angle, { duration: 500 }), { initialProps: { angle: 359 } })
  rerender({ angle: 1 })
  act(() => jest.advanceTimersByTime(100))
  expect(result.current > 358 || result.current < 2).toBe(true)
  act(() => jest.advanceTimersByTime(2000))
  expect(result.current).toBe(1)
  unmount()
})

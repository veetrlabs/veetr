import { validSpeedMps } from '../speed';
import { metricValue } from '../trip';
import { parseTrackingPositions } from '../../regattas/positions';

test.each([0, 100, 231.120357, 1200])('preserves speed %s through upload validation, charts and live positions', speed => {
  expect(validSpeedMps(speed)).toBe(speed);
  expect(metricValue({ sogMps: speed } as any, 'sog')).toBeCloseTo(speed * 1.94384449);
  expect(parseTrackingPositions([{ boatId: 'boat', boatName: 'Boat', recordedAt: new Date().toISOString(),
    latitude: 0, longitude: 0, accuracyM: 5, sogMps: speed, cogDeg: 90, source: 'phone', trail: [] }])[0].sogMps).toBe(speed);
});
test.each([undefined, null, -1, NaN, Infinity, -Infinity])('invalid speed %s remains unknown', speed => {
  expect(validSpeedMps(speed)).toBeNull();
});

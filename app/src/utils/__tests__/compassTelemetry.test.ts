import { compassTelemetry } from '../compassTelemetry';
it('retains quality diagnostics without inventing a valid heading', () => {
  expect(compassTelemetry({ hdgQuality: 0, hdgRaw: 220, hdgAccuracyRad: .3, hdgRejected: 42 }, 100)).toEqual({ quality: 0, rawHeading: 220, accuracyRad: .3, rejected: 42, receivedAt: 100 });
});
it('supports older firmware and rejects malformed telemetry', () => {
  expect(compassTelemetry({})).toBeUndefined();
  expect(compassTelemetry({ hdgQuality: 1.5 })).toBeUndefined();
  expect(compassTelemetry({ hdgQuality: 3, hdgRaw: NaN, hdgAccuracyRad: -1, hdgRejected: -2 }, 100)).toEqual({ quality: 3, rawHeading: null, accuracyRad: null, rejected: null, receivedAt: 100 });
});

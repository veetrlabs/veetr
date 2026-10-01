import { compassTelemetry, visibleVaneHeading } from '../compassTelemetry';
it('retains quality diagnostics without inventing a valid heading', () => {
  expect(compassTelemetry({ hdgQuality: 0, hdgRaw: 220, hdgAccuracyRad: .3, hdgRejected: 42 }, 100)).toEqual({ quality: 0, rawHeading: 220, accuracyRad: .3, rejected: 42, receivedAt: 100 });
});
it('supports older firmware and rejects malformed telemetry', () => {
  expect(compassTelemetry({})).toBeUndefined();
  expect(compassTelemetry({ hdgQuality: 1.5 })).toBeUndefined();
  expect(compassTelemetry({ hdgQuality: 3, hdgRaw: NaN, hdgAccuracyRad: -1, hdgRejected: -2 }, 100)).toEqual({ quality: 3, rawHeading: null, accuracyRad: null, rejected: null, receivedAt: 100 });
});

it('preserves compact uncertain readings separately from accepted navigation heading', () => {
  const sample = compassTelemetry({ hQ: 1, hR: 219.5 }, 100)!;
  expect(sample).toMatchObject({ quality: 1, rawHeading: 219.5, status: 'uncertain' });
  expect(visibleVaneHeading(null, sample)).toEqual({ heading: 219.5, uncertain: true });
  expect(compassTelemetry({ hQ: 2, hR: 0, HDM: 0 })?.status).toBe('good');
  expect(compassTelemetry({ hQ: 2 })?.status).toBe('unavailable');
  expect(visibleVaneHeading(null, compassTelemetry({ hdgQuality: 1, hdgRaw: 219 }))).toEqual({ heading: null, uncertain: false });
});

import { sectionStatistics } from '../sectionStatistics';
import type { TrackingPoint } from '../model';
const stamp = (n: number) => new Date(n * 1000).toISOString();
const point = (at: number, sogMps: number | null, aws: number | null, tws: number | null) =>
  ({ recordedAt: stamp(at), sogMps, instruments: { aws, tws } } as TrackingPoint);
const sections = [0, 10].map(at => ({ startedAt: stamp(at), propulsion: 'unknown' as const }));
test('uses whole section, assigns boundary to the right and includes the final sample', () => {
  const points = [point(0, 0, 2, 4), point(5, 2, 6, 8), point(10, 10, 20, 30), point(20, 20, 40, 50)];
  const first = sectionStatistics(points, sections, 0);
  expect(first[0].min).toBe(0);
  expect(first[0].max).toBeCloseTo(2 * 1.94384449);
  expect(first[0].average).toBeCloseTo(1.94384449);
  expect(first[1]).toEqual({ metric: 'aws', min: 2, max: 6, average: 4 });
  expect(first[2]).toEqual({ metric: 'tws', min: 4, max: 8, average: 6 });
  expect(sectionStatistics(points, sections, 1)[1]).toEqual({ metric: 'aws', min: 20, max: 40, average: 30 });
  expect(sectionStatistics(points, sections.slice(0, 1), 0)[1].average).toBe(17);
});
test('ignores missing and invalid values independently and preserves real zeroes', () => {
  const points = [point(0, null, 0, null), point(1, -1, 4, NaN), point(2, Infinity, null, -5), point(3, NaN, Infinity, null)];
  expect(sectionStatistics(points, sections, 0)).toEqual([
    {metric:'sog',min:null,max:null,average:null},
    {metric:'aws',min:0,max:4,average:2},
    {metric:'tws',min:null,max:null,average:null},
  ]);
  expect(sectionStatistics([], sections, 0).every(row => row.average === null)).toBe(true);
});

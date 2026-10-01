import { boatBearings, boatSymbol } from '../boatSymbol';
test('signed wind angles rotate with heading and wrap north', () => {
  expect(boatBearings({cogDeg: 200, instruments: { heading: 350, awa: 30, twa: -90 }})).toEqual({ direction: 350, courseOnly: false, apparentFrom: 20, trueFrom: 260 });
  expect(boatBearings({instruments: {heading: 0, awa: 0, twa: 180}}).apparentFrom).toBe(0);
});
test('course fallback does not invent a heading for wind angles', () => {
  const p = {cogDeg: 90, instruments: {awa: 20, twa: -30}};
  expect(boatBearings(p)).toEqual({direction: 90, courseOnly: true, apparentFrom: null, trueFrom: null});
  expect(boatSymbol(p)).toContain('stroke-dasharray');
  expect(boatBearings({cogDeg: NaN, instruments: {heading: Infinity}}).direction).toBeNull();
});
test('symbol draws wind wedges and black heading line, rejecting unsafe inputs', () => {
  const svg = boatSymbol({instruments: {heading: 90, awa: -40, twa: 50}}, '<script>');
  expect(svg).toContain('rotate(50 56 56)');
  expect(svg).toContain('rotate(140 56 56)');
  expect(svg).toContain('stroke="black"');
  expect(svg).not.toContain('<script>');
  expect(boatBearings({instruments: {heading: 90, awa: 999}}).apparentFrom).toBeNull();
});

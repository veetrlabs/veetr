import { usablePhoneHeading } from '../phoneHeading'
const sample = { magHeading: 359.9, accuracy: 3, receivedAt: 100000 }
test('accepts magnetic heading without requiring GPS speed or position', () => {
  expect(usablePhoneHeading(sample, 100000)).toBe(359.9)
  expect(usablePhoneHeading({ ...sample, magHeading: 0 }, 100000)).toBe(0)
})
test.each([{ magHeading: -1 }, { magHeading: NaN }, { magHeading: 360 }, { accuracy: 0 }, { accuracy: 1 }, { accuracy: NaN }, { receivedAt: 1 }, { receivedAt: 100001 }])('hides unusable compass sample %s', patch => {
  expect(usablePhoneHeading({ ...sample, ...patch }, 100000)).toBeNull()
})
test('missing compass does not produce a false north reading', () => {
  expect(usablePhoneHeading(null, 100000)).toBeNull()
})

import { compassBearings } from '../phoneHeading'
test('compass aligns true heading and GPS course on a true north dial', () => {
  expect(compassBearings(80, { ...sample, magHeading: 70, trueHeading: 75 }, 100000)).toEqual({ reference: 'true', heading: 75, course: 80 })
})
test('magnetic-only dial does not mix GPS course with magnetic heading', () => {
  expect(compassBearings(80, { ...sample, magHeading: 70, trueHeading: -1 }, 100000)).toEqual({ reference: 'magnetic', heading: 70, course: null })
})
test('GPS course still works when compass is absent or stale', () => {
  expect(compassBearings(0, null, 100000)).toEqual({ reference: 'true', heading: null, course: 0 })
  expect(compassBearings(80, sample, 120000).heading).toBeNull()
  expect(compassBearings(NaN, null, 100000).course).toBeNull()
})

import { createCompassFilter } from '../phoneHeading'
const circularError = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
test('filters north-crossing noise without producing a south heading', () => {
  const filter = createCompassFilter()
  const outputs = Array.from({ length: 40 }, (_, i) => filter({ ...sample, magHeading: i % 2 ? 3 : 357, receivedAt: 100000 + i * 100 }).magHeading)
  expect(outputs.every(value => circularError(value, 0) < 4)).toBe(true)
  expect(outputs.slice(20).every(value => circularError(value, 0) < 1)).toBe(true)
})
test('follows a sustained turn and preserves magnetic declination', () => {
  const filter = createCompassFilter()
  filter({ ...sample, magHeading: 0, trueHeading: 5 })
  let output = sample as import('../phoneHeading').CompassSample
  for (let i = 1; i <= 20; i++) output = filter({ ...sample, magHeading: 90, trueHeading: 95, receivedAt: 100000 + i * 100 })
  expect(circularError(output.magHeading, 90)).toBeLessThan(2)
  expect(circularError(output.trueHeading!, output.magHeading + 5)).toBeLessThan(0.001)
})
test('discards filter history after bad accuracy or a stale interval', () => {
  const filter = createCompassFilter()
  filter(sample)
  expect(filter({ ...sample, accuracy: 0, magHeading: 120, receivedAt: 100100 }).accuracy).toBe(0)
  expect(filter({ ...sample, magHeading: 90, receivedAt: 100200 }).magHeading).toBe(90)
  expect(filter({ ...sample, magHeading: 180, receivedAt: 120000 }).magHeading).toBe(180)
})

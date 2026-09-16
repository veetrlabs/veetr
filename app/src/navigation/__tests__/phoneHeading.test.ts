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

import { boatRelativeBearing } from '../boatCompass'
test('north is left of an east-facing boat and right of a west-facing boat', () => {
  expect(boatRelativeBearing(0, 90)).toBe(270)
  expect(boatRelativeBearing(0, 270)).toBe(90)
})
test('course is relative to the bow across north', () => {
  expect(boatRelativeBearing(10, 350)).toBe(20)
  expect(boatRelativeBearing(350, 10)).toBe(340)
  expect(boatRelativeBearing(90, 90)).toBe(0)
})
test('missing compass or GPS does not create a false bearing', () => {
  expect(boatRelativeBearing(90, null)).toBeNull()
  expect(boatRelativeBearing(null, 90)).toBeNull()
  expect(boatRelativeBearing(0, NaN)).toBeNull()
})

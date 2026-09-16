import { regattaState, replayStep, type Regatta } from "../model";
const row: Regatta = {
  id: "one",
  name: "Regatta",
  description: "",
  year: 2026,
  status: "active",
  raceCount: 1,
  boatCount: 2,
};
test("dates classify only published events and live overrides schedule", () => {
  expect(regattaState({ ...row, firstDate: "2026-09-20" }, "2026-09-15")).toBe(
    "Upcoming",
  );
  expect(regattaState({ ...row, lastDate: "2026-09-14" }, "2026-09-15")).toBe(
    "Past",
  );
  expect(
    regattaState(
      { ...row, liveBoats: 1, lastDate: "2026-09-14" },
      "2026-09-15",
    ),
  ).toBe("Live");
  expect(regattaState(row, "2026-09-15")).toBe("Scheduled");
});
test("replay stepping never requests outside published bounds", () => {
  expect(replayStep(100, 20, 100, 110)).toBe(110);
  expect(replayStep(100, -20, 100, 110)).toBe(100);
});

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

test("completion overrides missing dates and historical series tracking", () => {
  expect(regattaState({...row, completed:true, liveBoats:2})).toBe("Past");
  expect(regattaState({...row, firstDate:"2026-09-16",lastDate:"2026-09-16"}, "2026-09-16")).toBe("Live");
});

test("directory groups heats into races, excludes drafts and keeps event dates and entrants separate", () => {
  const { publishedRaceRegattas } = require("../model");
  const series = {
    id:"season",name:"Season",year:2026,boats:[],categories:[],
    events:[{id:"a",name:"Spring race",order:1,completed:true},{id:"b",name:"Autumn race",order:2,completed:false},{id:"draft",name:"Private",order:3}],
    races:[
      {id:"a1",eventId:"a",status:"published",date:"",entries:["one"]},
      {id:"a2",eventId:"a",status:"locked",date:"",entries:["one","two"]},
      {id:"b1",eventId:"b",status:"published",date:"2026-10-01",entries:["three"]},
      {id:"draft",eventId:"draft",status:"draft",date:"2026-11-01",entries:["secret"]},
    ],
  };
  const races = publishedRaceRegattas({...row,liveBoats:4,replayStart:"2026-01-01"},series);
  expect(races.map((r: {name:string}) => r.name)).toEqual(["Spring race","Autumn race"]);
  expect(races[0].boatCount).toBe(2);
  expect(races[0].raceCount).toBe(2);
  expect(races[1].boatIds).toEqual(["three"]);
  expect(regattaState(races[0],"2026-09-16")).toBe("Past");
  expect(regattaState(races[1],"2026-09-16")).toBe("Upcoming");
  expect(races[0].liveBoats).toBeUndefined();
  expect(races[1].replayStart).toBeUndefined();
});

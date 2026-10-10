import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup as render } from "react-dom/server";
import { CourseDetails } from "./CourseDetails";
import { LiveTrackingMap } from "./LiveTrackingMap";
import { CourseEditor } from "./CourseEditor";
import { id, newSeries } from "./domain";
import { setCourse } from "./course";
test("public course detail shows sailing order, rounding sides and start line without editing controls", () => {
  const s = newSeries(),
    eventId = id();
  s.events = [
    {
      id: eventId,
      name: "Club race",
      order: 1,
      weight: 1,
      completed: false,
      discards: [],
    },
  ];
  setCourse(s, eventId, {
    marks: [
      {
        id: id(),
        name: "<script>test</script>",
        latitude: 49,
        longitude: 14,
        rounding: "port",
      },
      {
        id: id(),
        name: "Leeward",
        latitude: 49.01,
        longitude: 14.01,
        rounding: "starboard",
      },
    ],
    startLine: [
      { latitude: 49, longitude: 14 },
      { latitude: 49, longitude: 14.001 },
    ],
  });
  const html = render(<CourseDetails series={s} eventId={eventId} />);
  assert.match(html, /Race course map/);
  assert.match(html, /Leave to port \(left\)/);
  assert.match(html, /Leave to starboard \(right\)/);
  assert.match(html, /Start line/);
  assert.doesNotMatch(html, /<script>|Edit course|Set course/);
  assert.doesNotMatch(html, /&lt;script&gt;|Leeward/);
  assert.match(html, /Mark 1/);
  assert.match(html, /Mark 2/);
  assert.equal(render(<CourseDetails series={s} eventId="missing" />), "");
});
test("the course editor opens a local draft and has explicit save and back controls", () => {
  const s = newSeries(),
    eventId = id();
  s.events = [
    {
      id: eventId,
      name: "Club race",
      order: 1,
      weight: 1,
      completed: false,
      discards: [],
    },
  ];
  const before = structuredClone(s);
  let saves = 0;
  const html = render(
    <CourseEditor
      series={s}
      eventId={eventId}
      save={async () => {
        saves++;
      }}
      onBack={() => {}}
    />,
  );
  assert.equal(saves, 0);
  assert.deepEqual(s, before);
  assert.match(html, /Save course/);
  assert.match(html, /Back to race/);
  assert.match(html, /Place start A/);
  assert.match(html, /Place start B/);
  assert.match(html, /Add mark/);
});
test('bearing-only details label an unknown buoy distance and an expired live fix', () => {
  const s = newSeries(), eventId = id();
  s.events = [{id:eventId,name:'Start test',order:1,weight:1,completed:false,discards:[]}];
  setCourse(s,eventId,{marks:[],startBearing:{origin:{latitude:49,longitude:14},degrees:90},startLive:{updatedAt:'2020-01-01T00:00:00.000Z',accuracyMetres:4}});
  const html=render(<CourseDetails series={s} eventId={eventId}/>);
  assert.match(html,/Buoy distance unknown/);
  assert.match(html,/Referee position is stale/);
  assert.doesNotMatch(html,/A — B|Live referee position/);
});

test("combined race map keeps course actions and coordinates without a second map", () => {
  const s = newSeries(), eventId = id();
  s.events = [{id:eventId,name:'Shared course',order:1,weight:1,completed:false,discards:[]}];
  setCourse(s,eventId,{marks:[{id:id(),name:'Mark',latitude:49,longitude:14,rounding:'port'}],startLine:[{latitude:49,longitude:14},{latitude:49,longitude:14.001}]});
  const view = () => render(<CourseDetails series={s} eventId={eventId} onEdit={()=>{}} renderMap={course=><LiveTrackingMap seriesId={s.id} eventId={eventId} boatIds={[]} course={course}/>}/>);
  const html=view();
  assert.equal((html.match(/class="tracking-map"/g)||[]).length,1);
  assert.doesNotMatch(html,/class="course-map"/);
  assert.match(html,/Edit course/);
  assert.match(html,/Export GPX/);
  assert.match(html,/49.000000/);
  assert.match(html,/Show whole course/);
  assert.match(html,/Fit fleet/);
  delete s.courses;
  const empty=view();
  assert.match(empty,/class="tracking-map"/);
  assert.match(empty,/Set course/);
});

test("bearing editor defaults missing length to 250 m and preserves saved lengths", () => {
  const s = newSeries(), eventId = id();
  s.events = [{id:eventId,name:"Length test",order:1,weight:1,completed:false,discards:[]}];
  for (const distance of [undefined, 420]) {
    setCourse(s,eventId,{marks:[],startBearing:{origin:{latitude:49,longitude:14},degrees:90,...(distance ? {distanceMetres:distance} : {})}});
    const html = render(<CourseEditor series={s} eventId={eventId} save={async () => {}} onBack={() => {}} />);
    assert.match(html,new RegExp(`value="${distance ?? 250}"`));
    assert.doesNotMatch(html,/type="range"|Start with an estimated/);
  }
});

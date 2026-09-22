import React, { useState } from "react";
import { Editor, type Location } from "./SeriesBrowser";
import { id, materializeEvents, type Series, type ControlRace } from "./domain";
import { t } from "./i18n";

export function HeatCreation({
  series,
  eventId,
  save,
  navigate,
}: {
  series: Series;
  eventId: string;
  save: (change: (series: Series) => void) => Promise<void>;
  navigate: (location: Location) => void;
}) {
  const [draft] = useState<ControlRace>(() => ({
    id: id(),
    eventId,
    name: "",
    date: "",
    order: 1,
    weight: 1,
    status: "draft",
    entries: [],
    results: [],
  }));
  return (
    <section className="race-creation-page">
      <h1>{t("New heat")}</h1>
      <Editor
        creating
        series={series}
        heat={draft}
        onCancel={() => navigate({ seriesId: series.id, eventId })}
        save={async (change) => {
          let destination = eventId;
          await save((next) => {
            materializeEvents(next);
            const heat = {
              ...draft,
              entries: [],
              results: [],
              order: Math.max(0, ...next.races.map((race) => race.order)) + 1,
            };
            next.races.push(heat);
            change(next);
            destination = heat.eventId!;
          });
          navigate({
            seriesId: series.id,
            eventId: destination,
            heatId: draft.id,
          });
        }}
      />
    </section>
  );
}

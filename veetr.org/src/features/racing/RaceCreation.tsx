import React, { useState } from "react";
import { Editor } from "./SeriesBrowser";
import {
  eventsFor,
  id,
  materializeEvents,
  type Series,
  type RaceEvent,
} from "./domain";
import { t } from "./i18n";

export function RaceCreation({
  series,
  save,
  navigate,
}: {
  series: Series;
  save: (change: (series: Series) => void) => Promise<void>;
  navigate: (location: { seriesId: string; eventId?: string }) => void;
}) {
  // This draft belongs only to the form. It is never persisted until Save succeeds.
  const [draft] = useState<RaceEvent>(() => ({
    id: id(),
    name: "",
    order: 1,
    weight: 1,
    completed: false,
    discards: [],
  }));
  return (
    <section className="race-creation-page">
      <h1>{t("New race")}</h1>
      <Editor
        creating
        series={series}
        event={draft}
        onCancel={() => navigate({ seriesId: series.id })}
        save={async (change) => {
          await save((next) => {
            materializeEvents(next);
            next.events!.push({
              ...draft,
              order:
                Math.max(0, ...eventsFor(next).map((event) => event.order)) + 1,
              entries: next.boats.map((boat) => boat.id),
            });
            change(next);
          });
          navigate({ seriesId: series.id, eventId: draft.id });
        }}
      />
    </section>
  );
}

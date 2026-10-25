import React, { useId, useRef, useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Minimize2 } from "lucide-react";
import { t } from "./i18n";

export function MapChartPanel({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  return <div className="map-chart-panel">
    <div className="map-chart-header">
      <button type="button" className="map-chart-toggle" aria-expanded={expanded} aria-controls={id}
        onClick={() => setExpanded(value => !value)}>
        <span>{t("Speed chart")}</span>
        {expanded ? <ChevronDown size={20} aria-hidden="true" /> : <ChevronUp size={20} aria-hidden="true" />}
        <span className="map-chart-sr">{t(expanded ? "Minimize chart" : "Expand chart")}</span>
      </button>
      {expanded && header}
    </div>
    <div id={id} className="map-chart-content" hidden={!expanded}>{children}</div>
  </div>;
}

/** Keep the map mounted while entering full screen, including on mobile Safari. */
export function TripMapFrame({ children }: { children: React.ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false);
  const shell = useRef<HTMLDialogElement>(null);
  const expand = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = shell.current;
    if (!dialog) return;
    dialog.close();
    if (fullscreen) dialog.showModal();
    else dialog.open = true;
    const previous = document.body.style.overflow;
    if (fullscreen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [fullscreen]);
  function close() {
    setFullscreen(false);
    requestAnimationFrame(() => expand.current?.focus());
  }
  return <>
    <button ref={expand} onClick={() => setFullscreen(true)}>{t("Full screen")}</button>
    <dialog ref={shell} className={`trip-map-frame${fullscreen ? " is-fullscreen" : ""}`}
      aria-label={t("Trip route map")} onCancel={e => { e.preventDefault(); close(); }}>
      {fullscreen && <button className="trip-map-exit" onClick={close} aria-label={t("Exit full screen")}><Minimize2 size={22} /></button>}
      {children}
    </dialog>
  </>;
}

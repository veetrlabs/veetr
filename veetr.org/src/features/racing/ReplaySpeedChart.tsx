import {formatDateTime} from "./timezone";
import React, { useMemo } from 'react';
import type { TrackPoint } from './trackCache';
import { t } from './i18n';
import { visibleMapSegments, type MapViewport } from './mapChartWindow';
import { filterSpeedOutliers } from './speedOutliers';

export function trackingColor(id: string, colors: Record<string, string>) {
  return colors[id] || `hsl(${Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 360} 65% 40%)`;
}
export function speedSeries(points: TrackPoint[]) {
  const boats = new Map<string, { id: string; name: string; readings: { at: number; knots: number | null }[]; segments: { at: number; knots: number; latitude: number; longitude: number }[][] }>();
  const previous = new Map<string, TrackPoint>();
  for (const p of filterSpeedOutliers(points)) {
    const boat = boats.get(p.boatId) ?? { id: p.boatId, name: p.boatName, readings: [], segments: [] };
    boats.set(p.boatId, boat);
    boat.readings.push({ at: Date.parse(p.recordedAt), knots: p.sogMps === null ? null : p.sogMps * 1.94384449 });
    const last = previous.get(p.boatId);
    if (p.sogMps !== null) {
      if (!last || last.sogMps === null || last.sessionId !== p.sessionId || Date.parse(p.recordedAt) - Date.parse(last.recordedAt) > 60000) boat.segments.push([]);
      boat.segments.at(-1)!.push({ latitude: p.latitude, longitude: p.longitude, at: Date.parse(p.recordedAt), knots: p.sogMps * 1.94384449 });
    }
    previous.set(p.boatId, p);
  }
  return [...boats.values()];
}
export function replayTimeAt(x: number, left: number, width: number, start: number, end: number) {
  return start + Math.max(0, Math.min(1, (x - left) / width)) * (end - start);
}
export function ReplayBoatControls({points, at, colors, hidden, toggle}: {
  points: TrackPoint[]; at: number; colors: Record<string, string>;
  hidden: Set<string>; toggle: (id: string) => void;
}) {
  const boats = useMemo(() => speedSeries(points), [points]);
  return (<div className="replay-boats">{boats.map(b => {
      const reading = b.readings.filter(p => p.at <= at).at(-1);
      return <button key={b.id} type="button" aria-pressed={!hidden.has(b.id)} onClick={() => toggle(b.id)}>
        <span aria-hidden="true" style={{ color: hidden.has(b.id) ? 'currentColor' : trackingColor(b.id, colors) }}>{hidden.has(b.id) ? '○' : '●'}</span>{' '}{b.name}
        {!hidden.has(b.id) && <span className="replay-speed-value">{reading && reading.knots !== null && at - reading.at <= 60000 ? reading.knots.toFixed(1) : '—'} kn</span>}
      </button>;
    })}</div>);
}
export function ReplaySpeedChart({ points, bounds: fullBounds, window, viewport, at, colors, hidden, toggle, seek, loading, hideBoatControls = false }: {
  hideBoatControls?: boolean;
  viewport?: MapViewport | null;
  window?: { start: number; end: number } | null;
  points: TrackPoint[]; bounds: { start: number; end: number }; at: number; colors: Record<string, string>;
  hidden: Set<string>; toggle: (id: string) => void; seek: (at: number) => void; loading: boolean;
}) {
  const boats = useMemo(() => speedSeries(points), [points]);
  const bounds = window ?? fullBounds;
  // Filter before clipping: zooming must not change which readings are outliers.
  const plotted = useMemo(() => window === null ? [] : boats.map(boat => ({ ...boat,
    segments: boat.segments.flatMap(segment => visibleMapSegments(segment, viewport)).map(segment => segment.filter(p => !window || (p.at >= window.start && p.at <= window.end))).filter(segment => segment.length),
  })), [boats, viewport, window?.start, window?.end, window === null]);
  const shown = plotted.filter(b => !hidden.has(b.id));
  const max = Math.max(1, Math.ceil(shown.reduce((max, b) => b.segments.reduce((m, s) => s.reduce((n, p) => Math.max(n, p.knots), m), max), 0)));
  const x = (stamp: number) => (stamp - bounds.start) / (bounds.end - bounds.start || 1) * 1000;
  const y = (knots: number) => 180 - knots / max * 170;
  const lines = useMemo(() => shown.flatMap(b => b.segments.map((segment, i) => segment.length === 1
          ? <circle key={`${b.id}:${i}`} cx={x(segment[0].at)} cy={y(segment[0].knots)} r="2" fill={trackingColor(b.id, colors)} />
          : <polyline key={`${b.id}:${i}`} points={segment.map(p => `${x(p.at).toFixed(2)},${y(p.knots).toFixed(2)}`).join(' ')} fill="none" stroke={trackingColor(b.id, colors)} strokeWidth="2" vectorEffect="non-scaling-stroke" />)), [plotted, hidden, colors, bounds.start, bounds.end, max]);
  const time = (stamp: number) => formatDateTime(stamp, "time", undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  function pick(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width) seek(replayTimeAt(event.clientX, box.left, box.width, bounds.start, bounds.end));
  }
  return <section className="replay-speed-chart" aria-label={t('Boat speeds')}>
    {!hideBoatControls && <ReplayBoatControls points={points} at={at} colors={colors} hidden={hidden} toggle={toggle} />}
    <div className="replay-chart-heading"><strong>{t('Boat speeds')}</strong><span>{t('SOG (kn)')}</span></div>
    {loading && <p role="status">{t('Loading replay…')}</p>}
    {window === null && !loading && <p>{t('No recorded positions in this map area. Zoom out to see the route.')}</p>}
    {!loading && window !== null && !boats.some(b => b.segments.length) && <p>{t('No speed data is available for this recording.')}</p>}
    {window !== null && <><div className="replay-chart-plot">
      <div className="replay-chart-axis" aria-hidden="true"><span>{max}</span><span>{(max / 2).toFixed(1)}</span><span>0</span></div>
      <svg viewBox="0 0 1000 190" preserveAspectRatio="none" role="slider" tabIndex={0}
        aria-label={t('Replay time')} aria-valuemin={bounds.start} aria-valuemax={bounds.end} aria-valuenow={Math.max(bounds.start, Math.min(bounds.end, at))}
        aria-valuetext={formatDateTime(Math.max(bounds.start, Math.min(bounds.end, at)), "full")} aria-describedby="replay-chart-help"
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e); }}
        onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
        onKeyDown={e => {
          const step = e.shiftKey ? 60000 : 1000;
          const current = Math.max(bounds.start, Math.min(bounds.end, at));
          const target = e.key === 'Home' ? bounds.start : e.key === 'End' ? bounds.end : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? current + step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? current - step : null;
          if (target !== null) { e.preventDefault(); seek(Math.max(bounds.start, Math.min(bounds.end, target))); }
        }}>
        {[0, max / 2, max].map(v => <line key={v} x1="0" x2="1000" y1={y(v)} y2={y(v)} className="replay-chart-grid" />)}
        {lines}
        {window !== null && at >= bounds.start && at <= bounds.end && <line x1={x(at)} x2={x(at)} y1="0" y2="190" className="replay-chart-cursor" />}
      </svg>
    </div>
    <div className="replay-chart-times"><span>{time(bounds.start)}</span><span>{time(bounds.end)}</span></div></>}
    <p id="replay-chart-help" className="replay-chart-help">{t('Zoom or pan the map to focus the chart. Drag on the chart to replay. Select boats to show or hide them on both the map and chart.')}</p>
  </section>;
}

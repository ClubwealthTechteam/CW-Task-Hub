'use client';

// The hub's own venues map (Leaflet + OpenStreetMap tiles; free, no key). Every venue is a pin colored by
// status, type or its Google color; clicking a pin picks the venue; the picked pin can be dragged to fix
// its spot. Replaces the Google My Maps embed so new venues show up without adding a pin in Google.

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapVenue { id: string; name: string; lat: number; lng: number; color: string; icon: 'pin' | 'letter' }

function pinHtml(color: string, letter: boolean, selected: boolean, dim: boolean) {
  const size = selected ? 38 : 28;
  const mark = letter
    ? `<text x="12" y="12.6" text-anchor="middle" font-size="8" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">T</text>`
    : `<circle cx="12" cy="9" r="2.7" fill="#fff"/>`;
  return `<div class="vnm-pin${selected ? ' is-sel' : ''}${dim ? ' is-dim' : ''}" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
      <path d="M12 1.6a7.4 7.4 0 0 0-7.4 7.4c0 5.5 7.4 13.4 7.4 13.4s7.4-7.9 7.4-13.4A7.4 7.4 0 0 0 12 1.6Z" fill="${color}" stroke="#fff" stroke-width="1.4"/>
      ${mark}
    </svg></div>`;
}

export function VenuesMap({ venues, colors, selected, shown, movable, onPick, onMoved }: {
  venues: MapVenue[];
  colors: Record<string, string>;   // pin color per venue id (status / type / Google)
  selected?: string;
  shown: Set<string>;               // venues matching the list's filters (others are faded)
  movable: boolean;                 // the picked pin can be dragged
  onPick: (id: string) => void;
  onMoved: (id: string, lat: number, lng: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markers = useRef(new Map<string, Leaflet.Marker>());
  const fitted = useRef(false);
  const [ready, setReady] = useState(false); // re-render once Leaflet has loaded, so pins are drawn with the latest data
  const cb = useRef({ onPick, onMoved });
  cb.current = { onPick, onMoved };

  // Create the map once (Leaflet needs the browser, so it's loaded here, not on the server).
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((mod) => {
      if (cancelled || !box.current || map.current) return;
      L.current = mod;
      const m = mod.map(box.current, { zoomControl: false, worldCopyJump: true }).setView([33, -80], 5);
      mod.control.zoom({ position: 'bottomright' }).addTo(m);
      mod.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(m);
      map.current = m;
      setTimeout(() => m.invalidateSize(), 50);
      setReady(true);
    });
    return () => { cancelled = true; map.current?.remove(); map.current = null; markers.current.clear(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the map the right size when the side panels open or close.
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(() => map.current?.invalidateSize());
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  function sync() {
    const mod = L.current, m = map.current;
    if (!mod || !m) return;
    const seen = new Set<string>();
    for (const v of venues) {
      seen.add(v.id);
      const isSel = v.id === selected;
      const icon = mod.divIcon({
        html: pinHtml(colors[v.id] ?? v.color, v.icon === 'letter', isSel, !shown.has(v.id) && !isSel),
        className: 'vnm-icon', iconSize: isSel ? [38, 38] : [28, 28], iconAnchor: isSel ? [19, 36] : [14, 27],
      });
      let mk = markers.current.get(v.id);
      if (!mk) {
        mk = mod.marker([v.lat, v.lng], { icon, title: v.name, riseOnHover: true, keyboard: true });
        mk.on('click', () => cb.current.onPick(v.id));
        mk.on('dragend', () => { const p = mk!.getLatLng(); cb.current.onMoved(v.id, p.lat, p.lng); });
        mk.bindTooltip(v.name, { direction: 'top', offset: [0, -26], opacity: 0.95 });
        mk.addTo(m);
        markers.current.set(v.id, mk);
      } else {
        mk.setIcon(icon);
        const p = mk.getLatLng();
        if (p.lat !== v.lat || p.lng !== v.lng) mk.setLatLng([v.lat, v.lng]);
      }
      mk.setZIndexOffset(isSel ? 1000 : shown.has(v.id) ? 100 : 0);
      if (isSel && movable) mk.dragging?.enable(); else mk.dragging?.disable();
    }
    for (const [id, mk] of markers.current) if (!seen.has(id)) { mk.remove(); markers.current.delete(id); }
    if (!fitted.current && venues.length) {
      fitted.current = true;
      m.fitBounds(mod.latLngBounds(venues.map((v) => [v.lat, v.lng] as [number, number])), { padding: [40, 40] });
    }
  }

  useEffect(sync); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to the picked venue.
  useEffect(() => {
    const v = venues.find((x) => x.id === selected);
    if (v && map.current) map.current.flyTo([v.lat, v.lng], Math.max(map.current.getZoom(), 13), { duration: 0.6 });
  }, [selected, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="vnm" role="application" aria-label="Venues map" />;
}


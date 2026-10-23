"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type MapPoint = { lat: number; lng: number };

/** Chișinău: where most of our businesses are, used before a pin exists. */
export const DEFAULT_CENTER: MapPoint = { lat: 47.0105, lng: 28.8638 };

const PIN = L.divIcon({
  className: "",
  iconSize: [36, 44],
  iconAnchor: [18, 42],
  html: `<svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M18 43C18 43 33 27.5 33 16.5C33 7.9 26.3 1 18 1C9.7 1 3 7.9 3 16.5C3 27.5 18 43 18 43Z" fill="#004741" stroke="white" stroke-width="2"/>
  <circle cx="18" cy="16.5" r="5.5" fill="white"/>
</svg>`,
});

function Recenter({ point, zoom }: { point: MapPoint; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([point.lat, point.lng], Math.max(map.getZoom(), zoom), { animate: true });
  }, [map, point.lat, point.lng, zoom]);
  return null;
}

function ClickToPlace({ onPlace }: { onPlace: (point: MapPoint) => void }) {
  useMapEvents({
    click(event) {
      onPlace({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

export default function BranchMap({
  point,
  onChange,
  editable = true,
  className = "",
}: {
  point: MapPoint | null;
  onChange?: (point: MapPoint) => void;
  editable?: boolean;
  className?: string;
}) {
  const center = point ?? DEFAULT_CENTER;
  const zoom = point ? 16 : 12;
  return (
    <div className={`overflow-hidden rounded-2xl border border-line ${className}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={editable}
        dragging
        className="h-full w-full"
        style={{ minHeight: 280 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {point ? (
          <Marker
            position={[point.lat, point.lng]}
            icon={PIN}
            draggable={editable && Boolean(onChange)}
            eventHandlers={{
              dragend(event) {
                const latlng = (event.target as L.Marker).getLatLng();
                onChange?.({ lat: latlng.lat, lng: latlng.lng });
              },
            }}
          />
        ) : null}
        {editable && onChange ? <ClickToPlace onPlace={onChange} /> : null}
        <Recenter point={center} zoom={zoom} />
      </MapContainer>
    </div>
  );
}

"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

const ESRI_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
const LOCAL_TILES_URL = "/tiles/{z}/{x}/{y}.png";
const LOCAL_TILES_ATTRIBUTION =
  "Offline basemap &mdash; cached Esri World Imagery (Madagascar z5–9)";
const LOCAL_TILES_MAX_ZOOM = 9;

import {
  IUCN_COLORS,
  iucnColor,
  type LocalityFeature,
  type LocalityFeatureCollection,
} from "@/lib/mapLocalities";

const MADAGASCAR_CENTER: [number, number] = [-19, 46.5];
const MADAGASCAR_ZOOM = 6;

const IUCN_LEGEND: Array<{ code: string; label: string }> = [
  { code: "CR", label: "Critically Endangered" },
  { code: "EN", label: "Endangered" },
  { code: "VU", label: "Vulnerable" },
  { code: "NT", label: "Near Threatened" },
  { code: "LC", label: "Least Concern" },
  { code: "DD", label: "Data Deficient" },
  { code: "NE", label: "Not yet assessed" },
];

/**
 * Satellite base layer with automatic fallback to locally-baked tiles.
 *
 * Swap triggers:
 *   - Any `tileerror` event from the ESRI layer (covers 4xx/5xx + timeout)
 *   - `!navigator.onLine` at mount time
 *
 * Once swapped, we stay on the fallback for the session (no auto-recover).
 * Max-zoom clamps to LOCAL_TILES_MAX_ZOOM under fallback.
 */
function SatelliteLayer({ onFallback }: { onFallback: (v: boolean) => void }) {
  const [fallback, setFallback] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return false;
    return !navigator.onLine;
  });
  const layerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    onFallback(fallback);
  }, [fallback, onFallback]);

  useEffect(() => {
    if (fallback || !layerRef.current) return;
    const layer = layerRef.current;
    const onErr = () => setFallback(true);
    layer.on("tileerror", onErr);
    return () => {
      layer.off("tileerror", onErr);
    };
  }, [fallback]);

  if (fallback) {
    return (
      <TileLayer
        attribution={LOCAL_TILES_ATTRIBUTION}
        url={LOCAL_TILES_URL}
        maxZoom={LOCAL_TILES_MAX_ZOOM}
      />
    );
  }

  return (
    <TileLayer
      ref={layerRef as unknown as React.RefObject<L.TileLayer>}
      attribution={ESRI_ATTRIBUTION}
      url={ESRI_URL}
      maxZoom={18}
    />
  );
}

function clusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 32 : count < 100 ? 40 : 48;
  return L.divIcon({
    html: `<div class="mffcp-cluster"><span>${count}</span></div>`,
    className: "mffcp-cluster-wrapper",
    iconSize: L.point(size, size, true),
  });
}

function FeaturePopup({ feature }: { feature: LocalityFeature }) {
  const p = feature.properties;
  const speciesUrl = `/species/${p.species_id}/`;
  return (
    <Popup>
      <div className="space-y-1 text-sm">
        <div className="font-semibold italic">
          <a href={speciesUrl} className="text-sky-700 underline">
            {p.scientific_name}
          </a>{" "}
          <span className="not-italic font-normal text-slate-500">({p.family})</span>
        </div>
        {p.iucn_status ? (
          <div>
            <span
              className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: iucnColor(p.iucn_status) }}
            >
              {p.iucn_status}
            </span>
          </div>
        ) : null}
        <div>
          <span className="font-medium">{p.locality_name || "Unnamed locality"}</span>
          <div className="text-xs text-slate-600">
            {p.locality_type.replace(/_/g, " ")} · {p.presence_status}
          </div>
        </div>
        {p.water_body || p.water_body_type ? (
          <div className="text-xs">
            {p.water_body && <span>{p.water_body} </span>}
            {p.water_body_type && (
              <span className="text-slate-500">({p.water_body_type})</span>
            )}
          </div>
        ) : null}
        {p.drainage_basin_name && (
          <div className="text-xs text-slate-600">Basin: {p.drainage_basin_name}</div>
        )}
        {p.year_collected && (
          <div className="text-xs text-slate-600">Collected: {p.year_collected}</div>
        )}
        <div className="text-xs text-slate-500">Precision: {p.coordinate_precision}</div>
        {p.source_citation && (
          <div className="border-t border-slate-200 pt-1 text-xs text-slate-600">
            {p.source_citation}
          </div>
        )}
      </div>
    </Popup>
  );
}

function Legend() {
  const [open, setOpen] = useState(true);
  return (
    <div className="absolute bottom-4 right-4 z-[1000] rounded border border-slate-200 bg-white/95 p-3 text-xs shadow">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex w-full items-center justify-between font-semibold text-slate-700"
        aria-expanded={open}
      >
        <span>IUCN status</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="space-y-1">
          {IUCN_LEGEND.map(({ code, label }) => (
            <li key={code}>
              <a
                href={`/species/?iucn_status=${code}`}
                className="flex items-center gap-2 hover:underline"
              >
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-full border border-slate-400"
                  style={{ backgroundColor: IUCN_COLORS[code] }}
                />
                <span className="font-semibold">{code}</span>
                <span className="text-slate-600">{label}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** When ?focus_locality=ID is present, pan/zoom to that point and open its popup.
 *
 * Fires once on mount (and again if the focus id changes). We look up the
 * feature in the already-loaded collection rather than refetching — the list
 * view and the map share the same dataset.
 */
function FocusLocality({
  features,
  focusLocalityId,
}: {
  features: LocalityFeature[];
  focusLocalityId: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (focusLocalityId == null) return;
    const target = features.find(
      (f) => (f.id ?? f.properties.id) === focusLocalityId,
    );
    if (!target || !target.geometry) return;
    const [lng, lat] = target.geometry.coordinates;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 11), { duration: 0.8 });
  }, [map, features, focusLocalityId]);
  return null;
}

export default function MapClient({
  initialData,
  focusLocalityId = null,
  heightClass = "h-[calc(100vh-8rem)] min-h-[500px]",
}: {
  initialData: LocalityFeatureCollection | null;
  focusLocalityId?: number | string | null;
  // S20 Profile embeds MapClient in a constrained distribution panel, so
  // callers can override the default full-viewport height with a shorter
  // Tailwind height class (e.g. "h-[380px]").
  heightClass?: string;
}) {
  const features = initialData?.features ?? [];
  const totalFeatures = features.length;
  const speciesCount = new Set(features.map((f) => f.properties.species_id)).size;
  const [usingFallbackTiles, setUsingFallbackTiles] = useState(false);
  const focusId =
    focusLocalityId == null || focusLocalityId === ""
      ? null
      : Number(focusLocalityId);

  return (
    <div className={`relative w-full ${heightClass}`}>
      <MapContainer
        center={MADAGASCAR_CENTER}
        zoom={MADAGASCAR_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        aria-label={`Map of ${totalFeatures} locality records across ${speciesCount} species in Madagascar. Use the species directory for a text-based view.`}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite (ESRI)">
            <SatelliteLayer onFallback={setUsingFallbackTiles} />
          </LayersControl.BaseLayer>
        </LayersControl>

        {focusId != null && Number.isFinite(focusId) ? (
          <FocusLocality features={features} focusLocalityId={focusId} />
        ) : null}

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={clusterIcon}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          maxClusterRadius={50}
        >
          {features.map((feature) => {
            if (!feature.geometry) return null;
            const [lng, lat] = feature.geometry.coordinates;
            const color = iucnColor(feature.properties.iucn_status);
            return (
              <CircleMarker
                key={feature.id ?? feature.properties.id}
                center={[lat, lng]}
                radius={8}
                weight={2}
                pathOptions={{
                  color: "#1f2937",
                  fillColor: color,
                  fillOpacity: 0.85,
                }}
              >
                <FeaturePopup feature={feature} />
              </CircleMarker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
      <Legend />
      {usingFallbackTiles ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 shadow"
        >
          Using offline basemap — satellite imagery limited to zoom {LOCAL_TILES_MAX_ZOOM}.
        </div>
      ) : null}
      <span className="sr-only" data-testid="map-summary">
        {totalFeatures} locality records across {speciesCount} species.
      </span>
    </div>
  );
}

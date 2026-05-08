import type { PaddingOptions } from "mapbox-gl";

export interface MapViewportState {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
  padding: PaddingOptions;
}

const MIN_LATITUDE = -85;
const MAX_LATITUDE = 85;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;
const MIN_PITCH = 0;
const MAX_PITCH = 85;
const VIEWPORT_EPSILON = 0.000001;

export const DEFAULT_MAP_VIEWPORT: MapViewportState = {
  latitude: 39.8283,
  longitude: -98.5795,
  zoom: 3.5,
  bearing: 0,
  pitch: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

function finiteOr(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLongitude(value: number) {
  if (value >= -180 && value <= 180) {
    return Object.is(value, -0) ? 0 : value;
  }

  const normalized = ((((value + 180) % 360) + 360) % 360) - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function normalizeBearing(value: number) {
  return normalizeLongitude(value);
}

function normalizePadding(
  padding: PaddingOptions | undefined,
  fallback: PaddingOptions,
): PaddingOptions {
  return {
    top: Math.max(0, finiteOr(padding?.top, fallback.top ?? 0)),
    right: Math.max(0, finiteOr(padding?.right, fallback.right ?? 0)),
    bottom: Math.max(0, finiteOr(padding?.bottom, fallback.bottom ?? 0)),
    left: Math.max(0, finiteOr(padding?.left, fallback.left ?? 0)),
  };
}

export function normalizeMapViewport(
  viewport: Partial<MapViewportState>,
  fallback: MapViewportState = DEFAULT_MAP_VIEWPORT,
): MapViewportState {
  const nextFallback = {
    ...DEFAULT_MAP_VIEWPORT,
    ...fallback,
    padding: normalizePadding(fallback.padding, DEFAULT_MAP_VIEWPORT.padding),
  };

  return {
    latitude: clamp(
      finiteOr(viewport.latitude, nextFallback.latitude),
      MIN_LATITUDE,
      MAX_LATITUDE,
    ),
    longitude: normalizeLongitude(
      finiteOr(viewport.longitude, nextFallback.longitude),
    ),
    zoom: clamp(finiteOr(viewport.zoom, nextFallback.zoom), MIN_ZOOM, MAX_ZOOM),
    bearing: normalizeBearing(finiteOr(viewport.bearing, nextFallback.bearing ?? 0)),
    pitch: clamp(
      finiteOr(viewport.pitch, nextFallback.pitch ?? 0),
      MIN_PITCH,
      MAX_PITCH,
    ),
    padding: normalizePadding(viewport.padding, nextFallback.padding),
  };
}

function numbersEqual(left: number | undefined, right: number | undefined, epsilon: number) {
  return Math.abs((left ?? 0) - (right ?? 0)) <= epsilon;
}

export function mapViewportsEqual(
  left: MapViewportState,
  right: MapViewportState,
  epsilon = VIEWPORT_EPSILON,
) {
  return (
    numbersEqual(left.latitude, right.latitude, epsilon) &&
    numbersEqual(left.longitude, right.longitude, epsilon) &&
    numbersEqual(left.zoom, right.zoom, epsilon) &&
    numbersEqual(left.bearing, right.bearing, epsilon) &&
    numbersEqual(left.pitch, right.pitch, epsilon) &&
    numbersEqual(left.padding.top, right.padding.top, epsilon) &&
    numbersEqual(left.padding.right, right.padding.right, epsilon) &&
    numbersEqual(left.padding.bottom, right.padding.bottom, epsilon) &&
    numbersEqual(left.padding.left, right.padding.left, epsilon)
  );
}

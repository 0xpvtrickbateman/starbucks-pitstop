"use client";

import { create } from "zustand";
import {
  DEFAULT_MAP_VIEWPORT,
  mapViewportsEqual,
  normalizeMapViewport,
  type MapViewportState,
} from "@/lib/map-viewport";

type MapPanelMode = "peek" | "open" | "collapsed";

type MapViewport = MapViewportState;

interface MapStoreState {
  selectedStoreId: string | null;
  searchQuery: string;
  viewport: MapViewport;
  panelMode: MapPanelMode;
  lastAction: "idle" | "select" | "search" | "geolocate" | "recenter";
  setSearchQuery: (query: string) => void;
  setViewport: (viewport: Partial<MapViewport>) => void;
  setSelectedStoreId: (id: string | null) => void;
  setPanelMode: (mode: MapPanelMode) => void;
  recenter: (viewport: Partial<MapViewport>) => void;
  clearSelection: () => void;
}

const DEFAULT_VIEWPORT: MapViewport = DEFAULT_MAP_VIEWPORT;

export const useMapStore = create<MapStoreState>((set) => ({
  selectedStoreId: null,
  searchQuery: "",
  viewport: DEFAULT_VIEWPORT,
  panelMode: "peek",
  lastAction: "idle",
  setSearchQuery: (query) =>
    set({ searchQuery: query, lastAction: "search", panelMode: "peek" }),
  setViewport: (viewport) =>
    set((state) => {
      const nextViewport = normalizeMapViewport(viewport, state.viewport);

      if (mapViewportsEqual(state.viewport, nextViewport)) {
        return state;
      }

      return {
        viewport: nextViewport,
      };
    }),
  setSelectedStoreId: (id) =>
    set({
      selectedStoreId: id,
      panelMode: id ? "open" : "peek",
      lastAction: "select",
    }),
  setPanelMode: (mode) => set({ panelMode: mode }),
  recenter: (viewport) =>
    set((state) => ({
      viewport: normalizeMapViewport(viewport, state.viewport),
      lastAction: "recenter",
      panelMode: "peek",
    })),
  clearSelection: () =>
    set({
      selectedStoreId: null,
      panelMode: "peek",
      lastAction: "idle",
    }),
}));

export type { MapViewport, MapPanelMode };

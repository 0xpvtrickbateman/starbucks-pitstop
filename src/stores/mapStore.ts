"use client";

import { create } from "zustand";
import type { PaddingOptions } from "mapbox-gl";

type MapPanelMode = "peek" | "open" | "collapsed";

interface MapViewport {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
  padding: PaddingOptions;
}

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

const DEFAULT_VIEWPORT: MapViewport = {
  latitude: 39.8283,
  longitude: -98.5795,
  zoom: 3.5,
  bearing: 0,
  pitch: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

export const useMapStore = create<MapStoreState>((set) => ({
  selectedStoreId: null,
  searchQuery: "",
  viewport: DEFAULT_VIEWPORT,
  panelMode: "peek",
  lastAction: "idle",
  setSearchQuery: (query) =>
    set({ searchQuery: query, lastAction: "search", panelMode: "peek" }),
  setViewport: (viewport) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    })),
  setSelectedStoreId: (id) =>
    set({
      selectedStoreId: id,
      panelMode: id ? "open" : "peek",
      lastAction: "select",
    }),
  setPanelMode: (mode) => set({ panelMode: mode }),
  recenter: (viewport) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
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

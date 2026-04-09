"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeolocationState =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported";

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface UseGeolocationOptions {
  autoRequest?: boolean;
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    autoRequest = true,
    enableHighAccuracy = true,
    timeout = 10_000,
    maximumAge = 60_000,
  } = options;

  const [status, setStatus] = useState<GeolocationState>("idle");
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedRef = useRef(false);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined") {
      setStatus("unsupported");
      setError("Geolocation is unavailable in this environment.");
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("This browser does not support geolocation.");
      return;
    }

    setStatus("requesting");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (result) => {
        setStatus("granted");
        setPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
        });
      },
      (geolocationError) => {
        setStatus("denied");
        setError(geolocationError.message || "Location access was denied.");
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      },
    );
  }, [enableHighAccuracy, maximumAge, timeout]);

  useEffect(() => {
    if (!autoRequest || requestedRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      requestedRef.current = true;
      requestLocation();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [autoRequest, requestLocation]);

  return {
    status,
    position,
    error,
    requestLocation,
    isSupported: status !== "unsupported",
    isGranted: status === "granted",
    isDenied: status === "denied",
    isRequesting: status === "requesting",
  };
}

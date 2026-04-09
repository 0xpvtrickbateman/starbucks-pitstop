export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function parseBoundingBox(bboxValue: string): BoundingBox {
  const [west, south, east, north] = bboxValue.split(",").map(Number);

  if ([west, south, east, north].some((value) => Number.isNaN(value))) {
    throw new Error("Invalid bbox parameter");
  }

  return {
    west,
    south,
    east,
    north,
  };
}

export function expandBoundingBox(box: BoundingBox, bufferRatio = 0.08): BoundingBox {
  const lonBuffer = Math.abs(box.east - box.west) * bufferRatio;
  const latBuffer = Math.abs(box.north - box.south) * bufferRatio;

  return {
    west: box.west - lonBuffer,
    south: box.south - latBuffer,
    east: box.east + lonBuffer,
    north: box.north + latBuffer,
  };
}

export function boundingBoxFromRadius(
  latitude: number,
  longitude: number,
  radiusMiles: number,
): BoundingBox {
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.cos((latitude * Math.PI) / 180));

  return {
    west: longitude - lngDelta,
    south: latitude - latDelta,
    east: longitude + lngDelta,
    north: latitude + latDelta,
  };
}

export function haversineMiles(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(latitudeB - latitudeA);
  const dLng = toRadians(longitudeB - longitudeA);
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

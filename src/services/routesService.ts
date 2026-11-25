import type { CustomerPin } from "../components/CustomerMap";

export interface OptimizedRouteResult {
  orderedCustomers: CustomerPin[];
  polylinePath: { lat: number; lng: number }[];
  totalDistanceMeters: number;
  durationText: string;
  googleMapsUrl: string;
}

export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const path: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return path;
}

export function buildGoogleMapsNavUrl(
  orderedCustomers: CustomerPin[],
  origin?: { lat: number; lng: number } | null
): string {
  if (orderedCustomers.length === 0) return "https://www.google.com/maps";
  const dest = orderedCustomers[orderedCustomers.length - 1];
  const waypoints = origin
    ? orderedCustomers.slice(0, -1)
    : orderedCustomers.slice(1, -1);

  const params = new URLSearchParams({
    api: "1",
    destination: `${dest.lat},${dest.lng}`,
    travelmode: "walking",
  });

  if (origin) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  } else if (orderedCustomers.length > 1) {
    params.set("origin", `${orderedCustomers[0].lat},${orderedCustomers[0].lng}`);
  }

  if (waypoints.length > 0) {
    params.set(
      "waypoints",
      waypoints.map((w) => `${w.lat},${w.lng}`).join("|")
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function formatDuration(durationStr: string | undefined): string {
  if (!durationStr) return "—";
  const sec = Number(durationStr.replace("s", ""));
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const min = Math.round(sec / 60);
  if (min < 60) return `約${min}分`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return `約${h}時間${rem}分`;
}

export async function computeOptimalRoute(
  selectedCustomers: CustomerPin[],
  apiKey: string,
  currentLocation?: { lat: number; lng: number } | null
): Promise<OptimizedRouteResult> {
  if (selectedCustomers.length < 2) {
    throw new Error("最適ルートを作成するには2件以上の顧客を選択してください。");
  }
  if (!apiKey.trim()) {
    throw new Error("Google Maps APIキー（VITE_GOOGLE_MAPS_API_KEY）が未設定です。");
  }

  const originCoord = currentLocation ?? {
    lat: selectedCustomers[0].lat,
    lng: selectedCustomers[0].lng,
  };
  const destinationCustomer = selectedCustomers[selectedCustomers.length - 1];
  const intermediateCustomers = currentLocation
    ? selectedCustomers.slice(0, -1)
    : selectedCustomers.slice(1, -1);

  const body: Record<string, unknown> = {
    origin: {
      location: { latLng: { latitude: originCoord.lat, longitude: originCoord.lng } },
    },
    destination: {
      location: {
        latLng: { latitude: destinationCustomer.lat, longitude: destinationCustomer.lng },
      },
    },
    travelMode: "WALK",
    optimizeWaypointOrder: intermediateCustomers.length > 1,
    languageCode: "ja",
  };

  if (intermediateCustomers.length > 0) {
    body.intermediates = intermediateCustomers.map((c) => ({
      location: { latLng: { latitude: c.lat, longitude: c.lng } },
    }));
  }

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey.trim(),
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    routes?: {
      distanceMeters?: number;
      duration?: string;
      polyline?: { encodedPolyline?: string };
      optimizedIntermediateWaypointIndex?: number[];
    }[];
  };

  if (!res.ok || !json.routes?.length) {
    throw new Error(json.error?.message || "Routes API でのルート計算に失敗しました。");
  }

  const route = json.routes[0];
  const indices = route.optimizedIntermediateWaypointIndex;
  const orderedIntermediates =
    Array.isArray(indices) && indices.length === intermediateCustomers.length
      ? indices.map((idx) => intermediateCustomers[idx])
      : intermediateCustomers;

  const orderedCustomers = currentLocation
    ? [...orderedIntermediates, destinationCustomer]
    : [selectedCustomers[0], ...orderedIntermediates, destinationCustomer];

  const polylinePath = route.polyline?.encodedPolyline
    ? decodePolyline(route.polyline.encodedPolyline)
    : orderedCustomers.map((c) => ({ lat: c.lat, lng: c.lng }));

  return {
    orderedCustomers,
    polylinePath,
    totalDistanceMeters: route.distanceMeters ?? 0,
    durationText: formatDuration(route.duration),
    googleMapsUrl: buildGoogleMapsNavUrl(orderedCustomers, currentLocation),
  };
}

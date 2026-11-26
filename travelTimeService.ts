export interface LatLngPoint {
  lat: number | null;
  lng: number | null;
}

const travelCache = new Map<string, number>();

function calcHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fallbackMinutes(from: LatLngPoint, to: LatLngPoint): number {
  if (
    from.lat === null ||
    from.lng === null ||
    to.lat === null ||
    to.lng === null
  ) {
    return 20;
  }
  const km = calcHaversineKm(from.lat, from.lng, to.lat, to.lng);
  if (km < 0.4) return 5;
  // 市街地平均移動速度 約20km/h で概算
  return Math.max(5, Math.round((km / 20) * 60));
}

export async function estimateTravelMinutes(
  from: LatLngPoint,
  to: LatLngPoint,
  apiKey: string
): Promise<number> {
  if (
    from.lat === null ||
    from.lng === null ||
    to.lat === null ||
    to.lng === null
  ) {
    return 20;
  }

  const cacheKey = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}->${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = travelCache.get(cacheKey);
  if (typeof cached === "number") return cached;

  const key = apiKey.trim();
  if (!key) {
    const mins = fallbackMinutes(from, to);
    travelCache.set(cacheKey, mins);
    return mins;
  }

  try {
    const distKm = calcHaversineKm(from.lat, from.lng, to.lat, to.lng);
    const travelMode = distKm < 1.0 ? "WALK" : "DRIVE";
    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "routes.duration",
        },
        body: JSON.stringify({
          origin: {
            location: { latLng: { latitude: from.lat, longitude: from.lng } },
          },
          destination: {
            location: { latLng: { latitude: to.lat, longitude: to.lng } },
          },
          travelMode,
        }),
      }
    );
    if (!res.ok) {
      const mins = fallbackMinutes(from, to);
      travelCache.set(cacheKey, mins);
      return mins;
    }
    const json = (await res.json()) as {
      routes?: { duration?: string }[];
    };
    const dur = json.routes?.[0]?.duration;
    const sec = dur ? Number(dur.replace("s", "")) : NaN;
    if (Number.isFinite(sec) && sec > 0) {
      const mins = Math.max(5, Math.round(sec / 60));
      travelCache.set(cacheKey, mins);
      return mins;
    }
  } catch {
    // ネットワーク・APIエラー時はフォールバック
  }

  const mins = fallbackMinutes(from, to);
  travelCache.set(cacheKey, mins);
  return mins;
}

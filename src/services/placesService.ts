import { loadGoogleMapsScript, type PlaceCandidatePin } from "../components/CustomerMap";

type PlacesResultRaw = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  vicinity?: string;
  rating?: number;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
};

function mapPlacesResults(results: unknown[] | null): PlaceCandidatePin[] {
  if (!Array.isArray(results)) return [];
  const list: PlaceCandidatePin[] = [];
  for (const item of results) {
    const r = item as PlacesResultRaw;
    const lat = r.geometry?.location?.lat?.();
    const lng = r.geometry?.location?.lng?.();
    if (!r.place_id || !r.name || typeof lat !== "number" || typeof lng !== "number") {
      continue;
    }
    list.push({
      placeId: r.place_id,
      name: r.name,
      address: r.formatted_address || r.vicinity || "",
      lat,
      lng,
      rating: typeof r.rating === "number" ? r.rating : undefined,
    });
  }
  return list.slice(0, 15);
}

export async function searchRestaurantsNearby(
  lat: number,
  lng: number,
  apiKey: string
): Promise<PlaceCandidatePin[]> {
  if (!apiKey.trim()) throw new Error("Google Maps APIキーが未設定です。");
  const google = await loadGoogleMapsScript(apiKey.trim());
  if (!google.maps.places) {
    throw new Error("Placesライブラリを読み込めませんでした。");
  }
  const container = document.createElement("div");
  const service = new google.maps.places.PlacesService(container);

  return new Promise((resolve, reject) => {
    service.nearbySearch(
      {
        location: { lat, lng },
        radius: 800,
        type: "restaurant",
      },
      (results, status) => {
        if (status === "OK") {
          resolve(mapPlacesResults(results));
        } else if (status === "ZERO_RESULTS") {
          resolve([]);
        } else {
          reject(new Error(`周辺検索に失敗しました（${status}）`));
        }
      }
    );
  });
}

export async function searchRestaurantsByPlaceText(
  placeText: string,
  apiKey: string
): Promise<PlaceCandidatePin[]> {
  if (!placeText.trim()) return [];
  if (!apiKey.trim()) throw new Error("Google Maps APIキーが未設定です。");
  const google = await loadGoogleMapsScript(apiKey.trim());
  if (!google.maps.places) {
    throw new Error("Placesライブラリを読み込めませんでした。");
  }
  const container = document.createElement("div");
  const service = new google.maps.places.PlacesService(container);

  return new Promise((resolve, reject) => {
    service.textSearch(
      {
        query: `${placeText.trim()} 飲食店`,
      },
      (results, status) => {
        if (status === "OK") {
          resolve(mapPlacesResults(results));
        } else if (status === "ZERO_RESULTS") {
          resolve([]);
        } else {
          reject(new Error(`場所検索に失敗しました（${status}）`));
        }
      }
    );
  });
}

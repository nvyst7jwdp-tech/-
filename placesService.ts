import { loadGoogleMapsScript, type PlaceCandidatePin } from "../components/CustomerMap";
import type { PlaceSalesDetails } from "./geminiSalesService";

export const RESTAURANT_GENRES = [
  "すべて",
  "カフェ",
  "焼肉",
  "居酒屋",
  "ラーメン",
  "イタリアン",
  "和食",
  "スイーツ",
] as const;

export type RestaurantGenre = (typeof RESTAURANT_GENRES)[number];

type PlacesResultRaw = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  vicinity?: string;
  rating?: number;
  types?: string[];
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
};

export function calcDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function inferGenreFromRaw(
  selectedGenre: RestaurantGenre,
  name: string,
  types?: string[]
): string {
  if (selectedGenre !== "すべて") return selectedGenre;
  const lowerName = name.toLowerCase();
  const typeSet = new Set(types ?? []);
  if (typeSet.has("cafe") || /カフェ|cafe|coffee|珈琲|喫茶/.test(lowerName)) return "カフェ";
  if (/焼肉|ホルモン|カルビ/.test(lowerName)) return "焼肉";
  if (typeSet.has("bar") || /居酒屋|酒場|焼鳥|焼き鳥|バル/.test(lowerName)) return "居酒屋";
  if (/ラーメン|らーめん|中華そば|麺/.test(lowerName)) return "ラーメン";
  if (/イタリアン|パスタ|ピザ|pizza|trattoria|osteria/.test(lowerName)) return "イタリアン";
  if (/和食|寿司|すし|蕎麦|そば|うどん|天ぷら|割烹/.test(lowerName)) return "和食";
  if (typeSet.has("bakery") || /スイーツ|ケーキ|パフェ|洋菓子|ベーカリー/.test(lowerName)) return "スイーツ";
  return "その他";
}

function mapPlacesResults(
  results: unknown[] | null,
  selectedGenre: RestaurantGenre,
  refCenter?: { lat: number; lng: number } | null
): PlaceCandidatePin[] {
  if (!Array.isArray(results)) return [];
  const rawList: PlaceCandidatePin[] = [];
  for (const item of results) {
    const r = item as PlacesResultRaw;
    const lat = r.geometry?.location?.lat?.();
    const lng = r.geometry?.location?.lng?.();
    if (!r.place_id || !r.name || typeof lat !== "number" || typeof lng !== "number") {
      continue;
    }
    rawList.push({
      placeId: r.place_id,
      name: r.name,
      address: r.formatted_address || r.vicinity || "",
      lat,
      lng,
      rating: typeof r.rating === "number" ? r.rating : undefined,
      genre: inferGenreFromRaw(selectedGenre, r.name, r.types),
    });
  }

  const anchor =
    refCenter ??
    (rawList.length > 0 ? { lat: rawList[0].lat, lng: rawList[0].lng } : null);

  if (anchor) {
    rawList.forEach((item) => {
      item.distanceMeters = calcDistanceMeters(
        anchor.lat,
        anchor.lng,
        item.lat,
        item.lng
      );
    });
    rawList.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  }

  return rawList;
}

export async function searchRestaurantsNearby(
  lat: number,
  lng: number,
  apiKey: string,
  genre: RestaurantGenre = "すべて"
): Promise<PlaceCandidatePin[]> {
  if (!apiKey.trim()) throw new Error("Google Maps APIキーが未設定です。");
  const google = await loadGoogleMapsScript(apiKey.trim());
  if (!google.maps.places) {
    throw new Error("Placesライブラリを読み込めませんでした。");
  }
  const container = document.createElement("div");
  const service = new google.maps.places.PlacesService(container);

  const req: {
    location: { lat: number; lng: number };
    radius: number;
    type?: string;
    keyword?: string;
  } = {
    location: { lat, lng },
    radius: 1200,
    type: genre === "カフェ" ? "cafe" : "restaurant",
  };
  if (genre !== "すべて") {
    req.keyword = genre;
  }

  return new Promise((resolve, reject) => {
    service.nearbySearch(req, (results, status) => {
      if (status === "OK") {
        resolve(mapPlacesResults(results, genre, { lat, lng }));
      } else if (status === "ZERO_RESULTS") {
        resolve([]);
      } else {
        reject(new Error(`周辺検索に失敗しました（${status}）`));
      }
    });
  });
}

export async function searchRestaurantsByPlaceText(
  placeText: string,
  apiKey: string,
  genre: RestaurantGenre = "すべて"
): Promise<PlaceCandidatePin[]> {
  if (!placeText.trim()) return [];
  if (!apiKey.trim()) throw new Error("Google Maps APIキーが未設定です。");
  const google = await loadGoogleMapsScript(apiKey.trim());
  if (!google.maps.places) {
    throw new Error("Placesライブラリを読み込めませんでした。");
  }
  const container = document.createElement("div");
  const service = new google.maps.places.PlacesService(container);
  const genreSuffix = genre === "すべて" ? "飲食店" : genre;

  return new Promise((resolve, reject) => {
    service.textSearch(
      {
        query: `${placeText.trim()} ${genreSuffix}`,
      },
      (results, status) => {
        if (status === "OK") {
          resolve(mapPlacesResults(results, genre, null));
        } else if (status === "ZERO_RESULTS") {
          resolve([]);
        } else {
          reject(new Error(`場所検索に失敗しました（${status}）`));
        }
      }
    );
  });
}

type PlaceDetailsRaw = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  opening_hours?: { weekday_text?: string[] };
  reviews?: { author_name?: string; rating?: number; text?: string }[];
  photos?: unknown[];
  editorial_summary?: { overview?: string };
  dine_in?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  reservable?: boolean;
  serves_beer?: boolean;
  serves_wine?: boolean;
  serves_lunch?: boolean;
  serves_dinner?: boolean;
};

function extractAttributes(raw: PlaceDetailsRaw): string[] {
  const attrs: string[] = [];
  if (raw.reservable) attrs.push("予約可");
  if (raw.dine_in) attrs.push("イートイン可");
  if (raw.takeout) attrs.push("テイクアウト可");
  if (raw.delivery) attrs.push("デリバリー対応");
  if (raw.serves_lunch) attrs.push("ランチ営業");
  if (raw.serves_dinner) attrs.push("ディナー営業");
  if (raw.serves_beer || raw.serves_wine) attrs.push("アルコール提供");
  return attrs;
}

export async function fetchPlaceSalesDetails(params: {
  name: string;
  address: string;
  placeId?: string;
  apiKey: string;
}): Promise<PlaceSalesDetails> {
  const { name, address, apiKey } = params;
  if (!apiKey.trim()) {
    throw new Error("Google Maps APIキーが未設定のため詳細情報を取得できません。");
  }
  const google = await loadGoogleMapsScript(apiKey.trim());
  if (!google.maps.places) {
    throw new Error("Placesライブラリを読み込めませんでした。");
  }
  const container = document.createElement("div");
  const service = new google.maps.places.PlacesService(container);

  let targetPlaceId = params.placeId?.trim() || "";
  if (!targetPlaceId) {
    targetPlaceId = await new Promise<string>((resolve) => {
      service.textSearch(
        { query: `${name} ${address}`.trim() },
        (results, status) => {
          if (status === "OK" && Array.isArray(results) && results[0]) {
            const first = results[0] as { place_id?: string };
            resolve(first.place_id ?? "");
          } else {
            resolve("");
          }
        }
      );
    });
  }

  if (!targetPlaceId) {
    return {
      name,
      address,
      types: [],
      weekdayText: [],
      reviews: [],
      attributes: [],
      photoCount: 0,
    };
  }

  return new Promise<PlaceSalesDetails>((resolve) => {
    service.getDetails(
      {
        placeId: targetPlaceId,
        fields: [
          "place_id",
          "name",
          "formatted_address",
          "formatted_phone_number",
          "website",
          "rating",
          "user_ratings_total",
          "price_level",
          "types",
          "opening_hours",
          "reviews",
          "photos",
        ],
      },
      (result, status) => {
        if (status !== "OK" || !result) {
          resolve({
            placeId: targetPlaceId,
            name,
            address,
            types: [],
            weekdayText: [],
            reviews: [],
            attributes: [],
            photoCount: 0,
          });
          return;
        }
        const raw = result as PlaceDetailsRaw;
        resolve({
          placeId: raw.place_id || targetPlaceId,
          name: raw.name || name,
          address: raw.formatted_address || address,
          website: raw.website,
          phone: raw.formatted_phone_number,
          rating: raw.rating,
          userRatingsTotal: raw.user_ratings_total,
          priceLevel: raw.price_level,
          types: Array.isArray(raw.types) ? raw.types.slice(0, 6) : [],
          weekdayText: Array.isArray(raw.opening_hours?.weekday_text)
            ? raw.opening_hours.weekday_text
            : [],
          reviews: Array.isArray(raw.reviews)
            ? raw.reviews
                .filter((r) => Boolean(r.text))
                .slice(0, 5)
                .map((r) => ({
                  authorName: r.author_name || "匿名",
                  rating: r.rating ?? 0,
                  text: r.text || "",
                }))
            : [],
          attributes: extractAttributes(raw),
          photoCount: Array.isArray(raw.photos) ? raw.photos.length : 0,
          editorialSummary: raw.editorial_summary?.overview,
        });
      }
    );
  });
}

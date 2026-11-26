import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { UserProfile } from "../types/gurupo";
import type { CustomerStatus } from "../components/CustomerMap";

export interface StoreRecord {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: CustomerStatus;
  situation: string;
  lat: number | null;
  lng: number | null;
  placeId?: string;
  ownerUid: string;
  ownerName: string;
  appointmentDate?: string;
  appointmentTime?: string;
  contractDate?: string;
  createdAt: string;
}

export function normalizeStoreStatus(raw: unknown): CustomerStatus {
  const s = String(raw ?? "").trim();
  if (s === "キック" || s === "アポ獲得" || s === "掲載のみ" || s === "契約済み") {
    return s;
  }
  if (s === "商談中" || s === "申込手続き") return "アポ獲得";
  return "キック";
}

export async function fetchUserNameMap(profile: UserProfile): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (profile.uid && profile.name) {
    map.set(profile.uid, profile.name);
  }
  if (!db) return map;
  if (profile.role !== "manager" && profile.role !== "admin") {
    return map;
  }
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.docs.forEach((d) => {
      const data = d.data();
      const name = String(data.name ?? "").trim();
      if (name) map.set(d.id, name);
    });
  } catch {
    // 権限不足時はフォールバック
  }
  return map;
}

export async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim() || !apiKey.trim()) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address.trim()
    )}&key=${encodeURIComponent(apiKey.trim())}&language=ja`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat: number; lng: number } } }[];
    };
    const loc = data.results?.[0]?.geometry?.location;
    if (data.status === "OK" && loc) {
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchStores(profile: UserProfile): Promise<StoreRecord[]> {
  if (!db) return [];
  const isLeader = profile.role === "manager" || profile.role === "admin";
  const q = isLeader
    ? query(collection(db, "stores"))
    : query(collection(db, "stores"), where("ownerUid", "==", profile.uid));

  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name ?? ""),
        address: String(data.address ?? ""),
        phone: String(data.phone ?? ""),
        status: normalizeStoreStatus(data.status),
        situation: String(data.situation ?? ""),
        lat: typeof data.lat === "number" ? data.lat : null,
        lng: typeof data.lng === "number" ? data.lng : null,
        placeId: typeof data.placeId === "string" ? data.placeId : undefined,
        ownerUid: String(data.ownerUid ?? ""),
        ownerName: String(data.ownerName ?? ""),
        appointmentDate:
          typeof data.appointmentDate === "string" ? data.appointmentDate : "",
        appointmentTime:
          typeof data.appointmentTime === "string" ? data.appointmentTime : "",
        contractDate:
          typeof data.contractDate === "string" ? data.contractDate : "",
        createdAt: String(data.createdAt ?? ""),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createStore(
  profile: UserProfile,
  input: {
    name: string;
    address: string;
    phone: string;
    situation: string;
    status: CustomerStatus;
    lat?: number | null;
    lng?: number | null;
    placeId?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    contractDate?: string;
  },
  mapsApiKey: string
): Promise<StoreRecord> {
  if (!db) throw new Error("データベースに接続できません。");
  let lat = input.lat ?? null;
  let lng = input.lng ?? null;
  if (lat === null || lng === null) {
    const coords = await geocodeAddress(input.address, mapsApiKey);
    lat = coords?.lat ?? null;
    lng = coords?.lng ?? null;
  }
  const createdAt = new Date().toISOString();
  const payload = {
    name: input.name.trim(),
    address: input.address.trim(),
    phone: input.phone.trim(),
    situation: input.situation.trim(),
    status: input.status,
    lat,
    lng,
    placeId: input.placeId ?? "",
    ownerUid: profile.uid,
    ownerName: profile.name,
    appointmentDate:
      input.status === "アポ獲得" ? input.appointmentDate ?? "" : "",
    appointmentTime:
      input.status === "アポ獲得" ? input.appointmentTime ?? "" : "",
    contractDate:
      input.status === "契約済み" ? input.contractDate ?? "" : "",
    createdAt,
  };
  const docRef = await addDoc(collection(db, "stores"), payload);
  return { id: docRef.id, ...payload };
}

export async function updateStoreStatus(
  storeId: string,
  patch: {
    status: CustomerStatus;
    appointmentDate?: string;
    appointmentTime?: string;
    contractDate?: string;
  }
): Promise<void> {
  if (!db) throw new Error("データベースに接続できません。");
  await updateDoc(doc(db, "stores", storeId), {
    status: patch.status,
    appointmentDate:
      patch.status === "アポ獲得" ? patch.appointmentDate ?? "" : "",
    appointmentTime:
      patch.status === "アポ獲得" ? patch.appointmentTime ?? "" : "",
    contractDate:
      patch.status === "契約済み" ? patch.contractDate ?? "" : "",
  });
}

export async function deleteStore(storeId: string): Promise<void> {
  if (!db) throw new Error("データベースに接続できません。");
  await deleteDoc(doc(db, "stores", storeId));
}

export function parseJapaneseAddress(address: string): {
  prefecture: string;
  city: string;
} {
  const clean = address.replace(/^〒?\d{3}-?\d{4}\s*/, "").trim();
  const prefMatch = clean.match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/);
  const prefecture = prefMatch ? prefMatch[1] : "";
  const rest = prefecture ? clean.slice(prefecture.length).trim() : clean;
  const cityMatch = rest.match(
    /^([^\s\d丁目番地号]+?(?:市[^\s\d丁目番地号]+?区|郡[^\s\d丁目番地号]+?[町村]|[市区町村]))/
  );
  const city = cityMatch ? cityMatch[1] : "";
  return { prefecture, city };
}

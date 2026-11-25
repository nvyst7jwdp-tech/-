import {
  addDoc,
  collection,
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
  dropReason?: string;
  contractDate?: string;
  contractAmount?: string;
  createdAt: string;
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
        status: (data.status as CustomerStatus) || "未接触",
        situation: String(data.situation ?? ""),
        lat: typeof data.lat === "number" ? data.lat : null,
        lng: typeof data.lng === "number" ? data.lng : null,
        placeId: typeof data.placeId === "string" ? data.placeId : undefined,
        ownerUid: String(data.ownerUid ?? ""),
        ownerName: String(data.ownerName ?? ""),
        dropReason: typeof data.dropReason === "string" ? data.dropReason : "",
        contractDate: typeof data.contractDate === "string" ? data.contractDate : "",
        contractAmount: typeof data.contractAmount === "string" ? data.contractAmount : "",
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
    createdAt,
  };
  const docRef = await addDoc(collection(db, "stores"), payload);
  return { id: docRef.id, ...payload };
}

export async function updateStoreStatus(
  storeId: string,
  patch: {
    status: CustomerStatus;
    dropReason?: string;
    contractDate?: string;
    contractAmount?: string;
  }
): Promise<void> {
  if (!db) throw new Error("データベースに接続できません。");
  await updateDoc(doc(db, "stores", storeId), {
    status: patch.status,
    dropReason: patch.status === "見送り" ? patch.dropReason ?? "" : "",
    contractDate: patch.status === "契約済み" ? patch.contractDate ?? "" : "",
    contractAmount: patch.status === "契約済み" ? patch.contractAmount ?? "" : "",
  });
}

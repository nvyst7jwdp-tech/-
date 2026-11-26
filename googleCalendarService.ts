import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../lib/firebase";

const SYNC_SETTING_PREFIX = "gurupo_gcal_sync_enabled_";
const SYNCED_EVENTS_PREFIX = "gurupo_gcal_synced_ids_";

export function isGoogleCalendarSyncEnabled(uid: string): boolean {
  try {
    return localStorage.getItem(`${SYNC_SETTING_PREFIX}${uid}`) === "true";
  } catch {
    return false;
  }
}

export function setGoogleCalendarSyncEnabled(uid: string, enabled: boolean): void {
  try {
    localStorage.setItem(`${SYNC_SETTING_PREFIX}${uid}`, enabled ? "true" : "false");
  } catch {
    // ignore storage errors
  }
}

export function getSyncedCalendarEventIds(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${SYNCED_EVENTS_PREFIX}${uid}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markCalendarEventSynced(uid: string, eventId: string): void {
  try {
    const set = getSyncedCalendarEventIds(uid);
    set.add(eventId);
    localStorage.setItem(`${SYNCED_EVENTS_PREFIX}${uid}`, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function addMinutesToTime(dateStr: string, timeStr: string, addMinutes: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "10:00").split(":").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 10, mm || 0);
  dt.setMinutes(dt.getMinutes() + addMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
    dt.getHours()
  )}:${pad(dt.getMinutes())}:00+09:00`;
}

export function buildGoogleCalendarTemplateUrl(params: {
  title: string;
  date: string;
  time: string;
  location?: string;
  description?: string;
}): string {
  const startIso = `${params.date}T${params.time || "10:00"}:00+09:00`;
  const endIso = addMinutesToTime(params.date, params.time || "10:00", 90);
  const fmt = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const qs = new URLSearchParams({
    action: "TEMPLATE",
    text: params.title,
    dates: `${fmt(startIso)}/${fmt(endIso)}`,
    location: params.location ?? "",
    details: params.description ?? "",
  });
  return `https://calendar.google.com/calendar/render?${qs.toString()}`;
}

export async function requestGoogleCalendarAccessToken(): Promise<string> {
  if (!auth) throw new Error("Firebase Auth が未初期化です。");
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/calendar.events");
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error("Googleカレンダーのアクセストークンを取得できませんでした。");
  }
  return credential.accessToken;
}

export async function createGoogleCalendarEvent(params: {
  accessToken: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  description?: string;
}): Promise<string> {
  const startDateTime = `${params.date}T${params.time || "10:00"}:00+09:00`;
  const endDateTime = addMinutesToTime(params.date, params.time || "10:00", 90);

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: params.title,
        location: params.location ?? "",
        description: params.description ?? "",
        start: { dateTime: startDateTime, timeZone: "Asia/Tokyo" },
        end: { dateTime: endDateTime, timeZone: "Asia/Tokyo" },
      }),
    }
  );

  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(json.error?.message || "Googleカレンダーへの予定登録に失敗しました。");
  }
  return json.id;
}

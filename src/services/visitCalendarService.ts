import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { UserProfile } from "../types/gurupo";

export interface CalendarVisitEvent {
  id: string;
  source: "store_appt" | "schedule";
  storeId?: string;
  title: string;
  storeName: string;
  purpose: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  address?: string;
  ownerUid: string;
  ownerName: string;
  interviewerUid: string;
  interviewerName: string;
}

export async function fetchVisitCalendarEvents(
  profile: UserProfile
): Promise<CalendarVisitEvent[]> {
  if (!db) return [];
  const isLeader = profile.role === "manager" || profile.role === "admin";

  const schedulesQ = isLeader
    ? query(collection(db, "schedules"))
    : query(collection(db, "schedules"), where("ownerUid", "==", profile.uid));

  const storesQ = isLeader
    ? query(collection(db, "stores"), where("status", "==", "アポ獲得"))
    : query(
        collection(db, "stores"),
        where("status", "==", "アポ獲得"),
        where("interviewerUid", "==", profile.uid)
      );

  // 旧データで interviewerUid 未設定（ownerUid のみ）の自分のアポも拾う
  const ownStoresQ = isLeader
    ? null
    : query(
        collection(db, "stores"),
        where("status", "==", "アポ獲得"),
        where("ownerUid", "==", profile.uid)
      );

  const [schSnap, stSnap, ownStSnap] = await Promise.all([
    getDocs(schedulesQ),
    getDocs(storesQ),
    ownStoresQ ? getDocs(ownStoresQ) : Promise.resolve(null),
  ]);

  const events: CalendarVisitEvent[] = [];
  const seenStoreIds = new Set<string>();

  const pushStoreDoc = (d: { id: string; data: () => Record<string, unknown> }) => {
    if (seenStoreIds.has(d.id)) return;
    seenStoreIds.add(d.id);
    const data = d.data();
    const date = String(data.appointmentDate ?? "").trim();
    if (!date) return;
    const time = String(data.appointmentTime ?? "").trim() || "10:00";
    const storeName = String(data.name ?? "");
    const ownerUid = String(data.ownerUid ?? "");
    const ownerName = String(data.ownerName ?? "");
    const interviewerUid = String(data.interviewerUid || ownerUid);
    const interviewerName = String(data.interviewerName || ownerName || "担当");
    events.push({
      id: `store-${d.id}`,
      source: "store_appt",
      storeId: d.id,
      title: `${storeName}（取材アポ）`,
      storeName,
      purpose: "取材アポ",
      date,
      time,
      address: String(data.address ?? ""),
      ownerUid,
      ownerName,
      interviewerUid,
      interviewerName,
    });
  };

  stSnap.docs.forEach(pushStoreDoc);
  ownStSnap?.docs.forEach(pushStoreDoc);

  schSnap.docs.forEach((d) => {
    const data = d.data();
    const date = String(data.date ?? "").trim();
    if (!date) return;
    const storeName = String(data.storeName ?? "");
    const purpose = String(data.purpose ?? "訪問");
    const ownerUid = String(data.ownerUid ?? "");
    const ownerName = String(data.ownerName ?? "");
    events.push({
      id: `sch-${d.id}`,
      source: "schedule",
      title: `${storeName}（${purpose}）`,
      storeName,
      purpose,
      date,
      time: String(data.time ?? "10:00"),
      ownerUid,
      ownerName,
      interviewerUid: ownerUid,
      interviewerName: ownerName || "担当",
    });
  });

  return events.sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  );
}

export async function createManualVisitSchedule(
  profile: UserProfile,
  input: { storeName: string; purpose: string; date: string; time: string }
): Promise<CalendarVisitEvent> {
  if (!db) throw new Error("データベースに接続できません。");
  const payload = {
    storeName: input.storeName.trim(),
    purpose: input.purpose.trim() || "訪問",
    date: input.date,
    time: input.time || "10:00",
    ownerUid: profile.uid,
    ownerName: profile.name,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, "schedules"), payload);
  return {
    id: `sch-${ref.id}`,
    source: "schedule",
    title: `${payload.storeName}（${payload.purpose}）`,
    storeName: payload.storeName,
    purpose: payload.purpose,
    date: payload.date,
    time: payload.time,
    ownerUid: profile.uid,
    ownerName: profile.name,
    interviewerUid: profile.uid,
    interviewerName: profile.name,
  };
}

export async function deleteManualVisitSchedule(eventId: string): Promise<void> {
  if (!db) throw new Error("データベースに接続できません。");
  const docId = eventId.replace(/^sch-/, "");
  await deleteDoc(doc(db, "schedules", docId));
}

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { UserProfile } from "../types/gurupo";

export type HomeSchedule = {
  id: string;
  time: string;
  storeName: string;
  purpose: string;
  ownerUid: string;
  ownerName: string;
};

export type HomeStore = {
  id: string;
  name: string;
  status: string;
  situation: string;
  distanceKm: number | null;
  scheduledTime: string | null;
  phone: string;
};

export type HomeAnnouncement = {
  id: string;
  title: string;
  date: string;
  body: string;
  important: boolean;
  read: boolean;
};

export type KpiCounts = {
  visits: number;
  appointments: number;
  negotiations: number;
  contracts: number;
};

export type RankedMember = KpiCounts & {
  uid: string;
  name: string;
  rank: number;
};

export type HomeData = {
  pendingSyncCount: number;
  schedules: HomeSchedule[];
  stores: HomeStore[];
  announcements: HomeAnnouncement[];
  kpiCounts: KpiCounts;
  selfRank: number | null;
  totalRankedMembers: number;
  rankedTeam: RankedMember[];
};

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCurrentMonthPrefix(): string {
  return getTodayDateString().slice(0, 7); // YYYY-MM
}

function getPendingSyncCountFromDevice(): number {
  try {
    const raw = localStorage.getItem("gurupo_pending_visits");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function computeRankByContracts(
  rows: { uid: string; contracts: number }[],
  targetUid: string
): number | null {
  const target = rows.find((r) => r.uid === targetUid);
  if (!target) return null;
  return rows.filter((r) => r.contracts > target.contracts).length + 1;
}

export async function fetchHomeData(profile: UserProfile): Promise<HomeData> {
  if (!db) {
    return {
      pendingSyncCount: getPendingSyncCountFromDevice(),
      schedules: [],
      stores: [],
      announcements: [],
      kpiCounts: { visits: 0, appointments: 0, negotiations: 0, contracts: 0 },
      selfRank: null,
      totalRankedMembers: 0,
      rankedTeam: [],
    };
  }

  const isLeader = profile.role === "manager" || profile.role === "admin";
  const todayStr = getTodayDateString();
  const monthPrefix = getCurrentMonthPrefix();

  // 1. 今日の予定
  const schedulesQuery = isLeader
    ? query(collection(db, "schedules"), where("date", "==", todayStr))
    : query(
        collection(db, "schedules"),
        where("date", "==", todayStr),
        where("ownerUid", "==", profile.uid)
      );

  // 2. 今日回る店舗（見送り・契約済み以外を対象、最大20件）
  const storesQuery = isLeader
    ? query(collection(db, "stores"))
    : query(collection(db, "stores"), where("ownerUid", "==", profile.uid));

  // 3. 今月の訪問記録（KPI集計用）
  const visitsQuery = isLeader
    ? query(collection(db, "visits"), where("month", "==", monthPrefix))
    : query(
        collection(db, "visits"),
        where("month", "==", monthPrefix),
        where("ownerUid", "==", profile.uid)
      );

  // 4. お知らせ
  const announcementsQuery = query(
    collection(db, "announcements"),
    orderBy("createdAt", "desc")
  );

  const [schSnap, stSnap, visSnap, annSnap] = await Promise.all([
    getDocs(schedulesQuery),
    getDocs(storesQuery),
    getDocs(visitsQuery),
    getDocs(announcementsQuery),
  ]);

  const schedules: HomeSchedule[] = schSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        time: String(data.time ?? ""),
        storeName: String(data.storeName ?? ""),
        purpose: String(data.purpose ?? ""),
        ownerUid: String(data.ownerUid ?? ""),
        ownerName: String(data.ownerName ?? ""),
      };
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const stores: HomeStore[] = stSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name ?? ""),
        status: String(data.status ?? "未接触"),
        situation: String(data.situation ?? ""),
        distanceKm: typeof data.distanceKm === "number" ? data.distanceKm : null,
        scheduledTime: typeof data.scheduledTime === "string" ? data.scheduledTime : null,
        phone: String(data.phone ?? ""),
      };
    })
    .filter((s) => s.status !== "契約済み" && s.status !== "見送り");

  // KPI集計
  const kpiCounts: KpiCounts = { visits: 0, appointments: 0, negotiations: 0, contracts: 0 };
  const byOwner = new Map<string, { uid: string; name: string } & KpiCounts>();

  for (const docSnap of visSnap.docs) {
    const v = docSnap.data();
    const uid = String(v.ownerUid ?? "");
    const ownerName = String(v.ownerName ?? "メンバー");
    const result = String(v.result ?? "");

    kpiCounts.visits += 1;
    if (result === "アポ獲得") kpiCounts.appointments += 1;
    if (result === "商談") kpiCounts.negotiations += 1;
    if (result === "契約") kpiCounts.contracts += 1;

    if (isLeader && uid) {
      const cur = byOwner.get(uid) ?? {
        uid,
        name: ownerName,
        visits: 0,
        appointments: 0,
        negotiations: 0,
        contracts: 0,
      };
      cur.visits += 1;
      if (result === "アポ獲得") cur.appointments += 1;
      if (result === "商談") cur.negotiations += 1;
      if (result === "契約") cur.contracts += 1;
      byOwner.set(uid, cur);
    }
  }

  // チーム順位（マネージャー・管理者のみ集計可能。メンバーは他人の詳細を取得しない）
  const rawTeamList = Array.from(byOwner.values());
  const rankedTeam: RankedMember[] = isLeader
    ? rawTeamList
        .sort((a, b) => b.contracts - a.contracts)
        .map((row) => ({
          ...row,
          rank: computeRankByContracts(rawTeamList, row.uid) ?? 1,
        }))
    : [];

  // お知らせと本人の既読状態取得
  const announcements: HomeAnnouncement[] = await Promise.all(
    annSnap.docs.slice(0, 20).map(async (d) => {
      const data = d.data();
      const readSnap = await getDoc(doc(db!, "announcements", d.id, "reads", profile.uid));
      return {
        id: d.id,
        title: String(data.title ?? ""),
        date: String(data.date ?? ""),
        body: String(data.body ?? ""),
        important: Boolean(data.important),
        read: readSnap.exists(),
      };
    })
  );

  return {
    pendingSyncCount: getPendingSyncCountFromDevice(),
    schedules,
    stores,
    announcements,
    kpiCounts,
    selfRank: null, // サーバー側の集計機能が追加されたら反映
    totalRankedMembers: rankedTeam.length,
    rankedTeam,
  };
}

export async function markAnnouncementRead(uid: string, announcementId: string): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, "announcements", announcementId, "reads", uid), {
    readAt: new Date().toISOString(),
  });
}

export async function createAnnouncement(
  profile: UserProfile,
  payload: { title: string; body: string; important: boolean }
): Promise<HomeAnnouncement> {
  if (!db) throw new Error("データベースに接続できません。");
  const date = getTodayDateString();
  const docRef = await addDoc(collection(db, "announcements"), {
    title: payload.title.trim(),
    body: payload.body.trim(),
    important: payload.important,
    date,
    createdByUid: profile.uid,
    createdByName: profile.name,
    createdAt: new Date().toISOString(),
  });
  return {
    id: docRef.id,
    title: payload.title.trim(),
    body: payload.body.trim(),
    important: payload.important,
    date,
    read: false,
  };
}

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
import type { TrendPoint } from "../components/KpiTrendChart";

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

export type StoreKpiSummary = {
  kick: number;
  appointment: number;
  listingOnly: number;
  contract: number;
  total: number;
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
  selectedDate: string;
  weekRangeLabel: string;
  monthLabel: string;
  pendingSyncCount: number;
  schedules: HomeSchedule[];
  stores: HomeStore[];
  announcements: HomeAnnouncement[];
  dayKpi: StoreKpiSummary;
  weekKpi: StoreKpiSummary;
  monthKpi: StoreKpiSummary;
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
  kpiCounts: KpiCounts;
  selfRank: number | null;
  totalRankedMembers: number;
  rankedTeam: RankedMember[];
};

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDateString(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

export function formatMonthDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const w = weekdays[dt.getDay()] ?? "";
  return `${m}月${d}日（${w}）`;
}

function toLocalDateString(isoOrDate: unknown): string {
  const raw = String(isoOrDate ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw.slice(0, 10);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

function getWeekBounds(dateStr: string): { start: string; end: string; label: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const day = dt.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
      x.getDate()
    ).padStart(2, "0")}`;

  return {
    start: fmt(monday),
    end: fmt(sunday),
    label: `${monday.getMonth() + 1}/${monday.getDate()}〜${sunday.getMonth() + 1}/${sunday.getDate()}`,
  };
}

function emptySummary(): StoreKpiSummary {
  return { kick: 0, appointment: 0, listingOnly: 0, contract: 0, total: 0 };
}

function addStoreToSummary(summary: StoreKpiSummary, status: string) {
  if (status === "キック") {
    summary.kick += 1;
    summary.total += 1;
  } else if (status === "アポ獲得") {
    summary.appointment += 1;
    summary.total += 1;
  } else if (status === "掲載のみ") {
    summary.listingOnly += 1;
    summary.total += 1;
  } else if (status === "契約済み") {
    summary.contract += 1;
    summary.total += 1;
  }
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

export async function fetchHomeData(
  profile: UserProfile,
  targetDate = getTodayDateString()
): Promise<HomeData> {
  const weekBounds = getWeekBounds(targetDate);
  const monthPrefix = targetDate.slice(0, 7);
  const monthNum = Number(targetDate.slice(5, 7));
  const monthLabel = `${monthNum}月`;

  if (!db) {
    return {
      selectedDate: targetDate,
      weekRangeLabel: weekBounds.label,
      monthLabel,
      pendingSyncCount: getPendingSyncCountFromDevice(),
      schedules: [],
      stores: [],
      announcements: [],
      dayKpi: emptySummary(),
      weekKpi: emptySummary(),
      monthKpi: emptySummary(),
      weeklyTrend: [],
      monthlyTrend: [],
      kpiCounts: { visits: 0, appointments: 0, negotiations: 0, contracts: 0 },
      selfRank: null,
      totalRankedMembers: 0,
      rankedTeam: [],
    };
  }

  const isLeader = profile.role === "manager" || profile.role === "admin";

  // 1. 選択日の予定
  const schedulesQuery = isLeader
    ? query(collection(db, "schedules"), where("date", "==", targetDate))
    : query(
        collection(db, "schedules"),
        where("date", "==", targetDate),
        where("ownerUid", "==", profile.uid)
      );

  // 2. 店舗データ（ホームKPI・推移グラフ・今日回る店舗・アポ予定と連動）
  const storesQuery = isLeader
    ? query(collection(db, "stores"))
    : query(collection(db, "stores"), where("ownerUid", "==", profile.uid));

  // 3. 選択月の訪問記録（従来のランキング・訪問集計用）
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

  const rawSchedules: HomeSchedule[] = schSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      time: String(data.time ?? ""),
      storeName: String(data.storeName ?? ""),
      purpose: String(data.purpose ?? ""),
      ownerUid: String(data.ownerUid ?? ""),
      ownerName: String(data.ownerName ?? ""),
    };
  });

  // 店舗データを集計（当日・週間・月間KPI ＋ 1週間おき/1ヶ月おきグラフ ＋ アポ予定）
  const dayKpi = emptySummary();
  const weekKpi = emptySummary();
  const monthKpi = emptySummary();

  // 1週間おき（直近6週）のバケット
  const weekBuckets: { start: string; end: string; label: string; point: TrendPoint }[] = [];
  for (let w = 5; w >= 0; w--) {
    const refDate = shiftDateString(targetDate, -w * 7);
    const wb = getWeekBounds(refDate);
    const [, mPart, dPart] = wb.start.split("-");
    weekBuckets.push({
      start: wb.start,
      end: wb.end,
      label: `${Number(mPart)}/${Number(dPart)}`,
      point: {
        label: `${Number(mPart)}/${Number(dPart)}`,
        kick: 0,
        appointment: 0,
        contract: 0,
      },
    });
  }

  // 1ヶ月おき（直近6ヶ月）のバケット
  const monthBuckets: { prefix: string; point: TrendPoint }[] = [];
  {
    const [ty, tm] = targetDate.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(ty, (tm || 1) - 1 - i, 1);
      const prefix = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      monthBuckets.push({
        prefix,
        point: {
          label: `${dt.getMonth() + 1}月`,
          kick: 0,
          appointment: 0,
          contract: 0,
        },
      });
    }
  }

  const apptSchedulesFromStores: HomeSchedule[] = [];
  const activeStores: HomeStore[] = [];

  for (const d of stSnap.docs) {
    const data = d.data();
    const status = String(data.status ?? "キック");
    const createdDate = toLocalDateString(data.createdAt);
    const contractDate = toLocalDateString(data.contractDate);
    const apptDate = toLocalDateString(data.appointmentDate);
    const apptTime = String(data.appointmentTime ?? "");

    // KPI集計用の基準日（契約済みは契約日、それ以外は獲得日/登録日）
    const kpiDate =
      status === "契約済み" && contractDate ? contractDate : createdDate;

    if (kpiDate) {
      if (kpiDate === targetDate) {
        addStoreToSummary(dayKpi, status);
      }
      if (kpiDate >= weekBounds.start && kpiDate <= weekBounds.end) {
        addStoreToSummary(weekKpi, status);
      }
      if (kpiDate.startsWith(monthPrefix)) {
        addStoreToSummary(monthKpi, status);
      }

      for (const wb of weekBuckets) {
        if (kpiDate >= wb.start && kpiDate <= wb.end) {
          if (status === "キック") wb.point.kick += 1;
          if (status === "アポ獲得") wb.point.appointment += 1;
          if (status === "契約済み") wb.point.contract += 1;
        }
      }
      for (const mb of monthBuckets) {
        if (kpiDate.startsWith(mb.prefix)) {
          if (status === "キック") mb.point.kick += 1;
          if (status === "アポ獲得") mb.point.appointment += 1;
          if (status === "契約済み") mb.point.contract += 1;
        }
      }
    }

    // 店舗画面で設定したアポ獲得予定を選択日の予定に表示
    if (status === "アポ獲得" && apptDate === targetDate) {
      apptSchedulesFromStores.push({
        id: `appt-${d.id}`,
        time: apptTime || "時間未定",
        storeName: String(data.name ?? ""),
        purpose: "取材アポ",
        ownerUid: String(data.interviewerUid || data.ownerUid || ""),
        ownerName: String(data.interviewerName || data.ownerName || ""),
      });
    }

    if (status !== "契約済み" && status !== "見送り") {
      activeStores.push({
        id: d.id,
        name: String(data.name ?? ""),
        status,
        situation: String(data.situation ?? ""),
        distanceKm: typeof data.distanceKm === "number" ? data.distanceKm : null,
        scheduledTime: apptDate === targetDate && apptTime ? apptTime : null,
        phone: String(data.phone ?? ""),
      });
    }
  }

  const schedules = [...rawSchedules, ...apptSchedulesFromStores].sort((a, b) =>
    a.time.localeCompare(b.time)
  );

  // 従来のvisits集計（メンバー別ランキング用）
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

  const rawTeamList = Array.from(byOwner.values());
  const rankedTeam: RankedMember[] = isLeader
    ? rawTeamList
        .sort((a, b) => b.contracts - a.contracts)
        .map((row) => ({
          ...row,
          rank: computeRankByContracts(rawTeamList, row.uid) ?? 1,
        }))
    : [];

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
    selectedDate: targetDate,
    weekRangeLabel: weekBounds.label,
    monthLabel,
    pendingSyncCount: getPendingSyncCountFromDevice(),
    schedules,
    stores: activeStores,
    announcements,
    dayKpi,
    weekKpi,
    monthKpi,
    weeklyTrend: weekBuckets.map((b) => b.point),
    monthlyTrend: monthBuckets.map((b) => b.point),
    kpiCounts,
    selfRank: null,
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

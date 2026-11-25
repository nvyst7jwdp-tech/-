import React, { useMemo, useState } from "react";
import {
  Calendar,
  MapPin,
  Phone,
  ClipboardCheck,
  RefreshCw,
  TrendingUp,
  Award,
  X,
  CheckCircle2,
  Store,
  Bell,
  ChevronRight,
} from "lucide-react";
import type { AppTab, UserProfile } from "../types/gurupo";
import { calculateKpiRates } from "../lib/kpiRates";

type ScheduleItem = {
  id: string;
  time: string;
  storeName: string;
  purpose: string;
  ownerRole: "member" | "team";
  ownerName: string;
};

type TodayStoreItem = {
  id: string;
  name: string;
  status: string;
  situation: string;
  distanceKm: number;
  scheduledTime: string | null;
  phone: string;
};

type AnnouncementItem = {
  id: string;
  title: string;
  date: string;
  body: string;
  important: boolean;
  read: boolean;
};

const INITIAL_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: "ann-1",
    title: "【重要】今月末までの訪問記録入力ルールについて",
    date: "2026-11-24",
    body: "商談後の訪問記録は当日中に入力し、同期待ちが残らないようご確認ください（サンプル）。",
    important: true,
    read: false,
  },
  {
    id: "ann-2",
    title: "営業定例ミーティングの時間変更",
    date: "2026-11-22",
    body: "今週のチーム定例は11:00開始に変更となりました（サンプル）。",
    important: false,
    read: true,
  },
];

const SAMPLE_SCHEDULES: ScheduleItem[] = [
  {
    id: "sch-1",
    time: "10:30",
    storeName: "サンプル店舗A",
    purpose: "訪問",
    ownerRole: "member",
    ownerName: "佐藤 健太",
  },
  {
    id: "sch-2",
    time: "13:30",
    storeName: "サンプル食堂B",
    purpose: "初回商談",
    ownerRole: "member",
    ownerName: "佐藤 健太",
  },
  {
    id: "sch-3",
    time: "15:00",
    storeName: "サンプルベーカリーC",
    purpose: "オンライン商談",
    ownerRole: "team",
    ownerName: "田中 翔",
  },
  {
    id: "sch-4",
    time: "16:30",
    storeName: "サンプル居酒屋D",
    purpose: "申込確認",
    ownerRole: "member",
    ownerName: "佐藤 健太",
  },
];

const SAMPLE_TODAY_STORES: TodayStoreItem[] = [
  {
    id: "st-1",
    name: "サンプル店舗A",
    status: "商談中",
    situation: "次回対応日を4日超過",
    distanceKm: 0.4,
    scheduledTime: "10:30",
    phone: "000-0101-0001",
  },
  {
    id: "st-2",
    name: "サンプル食堂B",
    status: "未接触",
    situation: "未接触",
    distanceKm: 0.8,
    scheduledTime: "13:30",
    phone: "000-0101-0002",
  },
  {
    id: "st-3",
    name: "サンプル居酒屋D",
    status: "申込手続き",
    situation: "本日夕方の再訪約束",
    distanceKm: 1.2,
    scheduledTime: "16:30",
    phone: "000-0101-0003",
  },
];

const SAMPLE_TEAM_MEMBERS_KPI = [
  { id: "u-yamada", name: "山田 陽子", visits: 34, appointments: 12, negotiations: 9, contracts: 6 },
  { id: "u-tanaka", name: "田中 翔", visits: 31, appointments: 10, negotiations: 8, contracts: 5 },
  { id: "u-satou", name: "佐藤 健太", visits: 28, appointments: 10, negotiations: 6, contracts: 4 },
  { id: "u-kondo", name: "近藤 蓮", visits: 22, appointments: 7, negotiations: 5, contracts: 4 },
];

function computeRankByContracts(
  rows: { id: string; contracts: number }[],
  targetId: string
): number {
  const target = rows.find((r) => r.id === targetId);
  if (!target) return 1;
  return rows.filter((r) => r.contracts > target.contracts).length + 1;
}

export function TodayScreen({
  profile,
  onNavigateTab,
  animateCards = true,
}: {
  profile: UserProfile;
  onNavigateTab: (tab: AppTab) => void;
  animateCards?: boolean;
}) {
  const isLeader = profile.role === "manager" || profile.role === "admin";
  const [pendingSyncCount] = useState(2);
  const [sortMode, setSortMode] = useState<"distance" | "time">("distance");
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(INITIAL_ANNOUNCEMENTS);
  const [showAnnouncementList, setShowAnnouncementList] = useState(false);
  const [phoneModalStore, setPhoneModalStore] = useState<TodayStoreItem | null>(null);
  const [notice, setNotice] = useState("");

  const unreadCount = announcements.filter((a) => !a.read).length;
  const hasImportantUnread = announcements.some((a) => !a.read && a.important);
  const latestAnnouncement = announcements[0];

  const visibleSchedules = isLeader
    ? SAMPLE_SCHEDULES
    : SAMPLE_SCHEDULES.filter((s) => s.ownerRole === "member");

  const sortedStores = useMemo(() => {
    const copy = [...SAMPLE_TODAY_STORES];
    if (sortMode === "distance") {
      return copy.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return copy.sort((a, b) => {
      const ta = a.scheduledTime ?? "99:99";
      const tb = b.scheduledTime ?? "99:99";
      return ta.localeCompare(tb);
    });
  }, [sortMode]);

  const selfKpi = SAMPLE_TEAM_MEMBERS_KPI.find((m) => m.id === "u-satou")!;
  const selfRank = computeRankByContracts(SAMPLE_TEAM_MEMBERS_KPI, "u-satou");

  const teamTotals = useMemo(() => {
    return SAMPLE_TEAM_MEMBERS_KPI.reduce(
      (acc, cur) => ({
        visits: acc.visits + cur.visits,
        appointments: acc.appointments + cur.appointments,
        negotiations: acc.negotiations + cur.negotiations,
        contracts: acc.contracts + cur.contracts,
      }),
      { visits: 0, appointments: 0, negotiations: 0, contracts: 0 }
    );
  }, []);

  const displayCounts = isLeader ? teamTotals : selfKpi;
  const displayRates = calculateKpiRates(displayCounts);

  const rankedTeam = useMemo(() => {
    return [...SAMPLE_TEAM_MEMBERS_KPI]
      .sort((a, b) => b.contracts - a.contracts)
      .map((row) => ({
        ...row,
        rank: computeRankByContracts(SAMPLE_TEAM_MEMBERS_KPI, row.id),
      }));
  }, []);

  const cardAnim = (index: number) =>
    animateCards
      ? {
          className: "gurupo-card-stagger",
          style: { animationDelay: `${Math.min(index * 35, 180)}ms` },
        }
      : { className: "", style: undefined };

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 2000);
  };

  const markAsRead = (id: string) => {
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
  };

  return (
    <div className="space-y-5">
      {/* 画面見出し「ホーム」 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[#1C1A16]">ホーム</h1>
      </div>

      {notice && (
        <div
          role="status"
          className="gurupo-toast-pop flex items-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-900 px-4 py-2.5 text-xs font-extrabold text-white"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>{notice}</span>
        </div>
      )}

      {/* ホーム上部のお知らせカード（未読件数・重要の印・一覧画面を開く） */}
      <button
        type="button"
        onClick={() => setShowAnnouncementList(true)}
        style={cardAnim(0).style}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-[#D5CEC0] bg-white px-4 py-3 text-left transition-transform duration-100 active:scale-[0.98] ${cardAnim(0).className}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Bell className="h-4 w-4 text-[#D94E2B]" />
            <span className="text-xs font-extrabold text-[#1C1A16]">お知らせ</span>
            {hasImportantUnread && (
              <span className="rounded bg-[#D94E2B] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                重要
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                unreadCount > 0
                  ? "bg-amber-100 text-amber-950"
                  : "bg-stone-200 text-stone-700"
              }`}
            >
              {unreadCount > 0 ? `未読 ${unreadCount}件` : "すべて既読"}
            </span>
          </div>
          {latestAnnouncement && (
            <p className="mt-1 truncate text-xs font-bold text-[#474239]">
              {latestAnnouncement.title}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-[#575249]" />
      </button>

      {/* 同期待ちの件数 */}
      <div
        className={`flex items-center justify-between rounded-2xl border-2 border-[#D5CEC0] bg-white px-4 py-3 ${cardAnim(1).className}`}
        style={cardAnim(1).style}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFEAE0] text-[#1C1A16]">
            <RefreshCw className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-bold text-[#575249]">同期待ちの記録</p>
            <p className="text-sm font-extrabold text-[#1C1A16]">{pendingSyncCount} 件（サンプル）</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab("visit")}
          className="min-h-[40px] rounded-xl border-2 border-[#1C1A16] bg-[#FBF9F4] px-3 text-xs font-extrabold text-[#1C1A16] transition-transform duration-100 active:scale-[0.97]"
        >
          訪問タブへ
        </button>
      </div>

      {/* 1. 今日の予定（時刻順） */}
      <section aria-labelledby="today-schedule-heading">
        <div className="mb-2.5 flex items-center justify-between">
          <h2
            id="today-schedule-heading"
            className="flex items-center gap-2 text-base font-extrabold text-[#1C1A16]"
          >
            <Calendar className="h-5 w-5 text-[#D94E2B]" />
            <span>今日の予定</span>
          </h2>
          <span className="text-xs font-bold text-[#575249]">{visibleSchedules.length}件</span>
        </div>

        <div className="space-y-2">
          {visibleSchedules.map((item, idx) => {
            const anim = cardAnim(idx + 2);
            return (
              <div
                key={item.id}
                style={anim.style}
                className={`flex items-center gap-3 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5 ${anim.className}`}
              >
                <span className="rounded-lg bg-[#1C1A16] px-2.5 py-1 text-xs font-extrabold tabular-nums text-white">
                  {item.time}
                </span>
                <div>
                  <p className="text-sm font-extrabold text-[#1C1A16]">
                    {item.storeName} {item.purpose}
                  </p>
                  {isLeader && (
                    <p className="mt-0.5 text-[11px] font-bold text-[#575249]">
                      担当：{item.ownerName}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. 今日回る店舗 */}
      <section aria-labelledby="today-stores-heading">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2
            id="today-stores-heading"
            className="flex items-center gap-2 text-base font-extrabold text-[#1C1A16]"
          >
            <Store className="h-5 w-5 text-[#D94E2B]" />
            <span>今日回る店舗</span>
          </h2>

          <div
            role="tablist"
            aria-label="店舗の並び順"
            className="inline-flex rounded-xl border border-[#D5CEC0] bg-[#EFEAE0] p-0.5 text-[11px] font-extrabold"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sortMode === "distance"}
              onClick={() => setSortMode("distance")}
              className={`min-h-[30px] rounded-lg px-2.5 transition-colors duration-150 ${
                sortMode === "distance" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
              }`}
            >
              近い順
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sortMode === "time"}
              onClick={() => setSortMode("time")}
              className={`min-h-[30px] rounded-lg px-2.5 transition-colors duration-150 ${
                sortMode === "time" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
              }`}
            >
              予定時刻順
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {sortedStores.map((store, idx) => {
            const anim = cardAnim(idx + 5);
            return (
              <article
                key={store.id}
                style={anim.style}
                className={`rounded-2xl border-2 border-[#D5CEC0] bg-white p-4 ${anim.className}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-[#D5CEC0] bg-[#F7F4ED] px-2 py-0.5 text-xs font-extrabold text-[#1C1A16]">
                    {store.status}
                  </span>
                  <span className="text-xs font-bold text-[#575249]">
                    {sortMode === "time" && store.scheduledTime
                      ? `予定 ${store.scheduledTime} ・ 約${store.distanceKm}km`
                      : `直線 約${store.distanceKm}km`}
                  </span>
                </div>

                <h3 className="mt-1.5 text-base font-extrabold text-[#1C1A16]">{store.name}</h3>

                <p className="mt-1.5 truncate rounded-lg bg-[#F7F4ED] px-2.5 py-1.5 text-xs font-medium text-[#3D3932]">
                  状況：{store.situation}
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      showTempNotice(`${store.name} の訪問記録画面へ移動します`);
                      onNavigateTab("visit");
                    }}
                    className="flex min-h-[46px] items-center justify-center gap-1 rounded-xl bg-[#D94E2B] px-2 text-xs font-extrabold text-white transition-transform duration-100 active:scale-[0.97]"
                  >
                    <ClipboardCheck className="h-4 w-4 shrink-0" />
                    <span>訪問を記録</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      showTempNotice(`${store.name} を地図で確認します`);
                      onNavigateTab("stores");
                    }}
                    className="flex min-h-[46px] items-center justify-center gap-1 rounded-xl border-2 border-[#1C1A16] bg-white px-2 text-xs font-extrabold text-[#1C1A16] transition-transform duration-100 active:scale-[0.97]"
                  >
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>地図</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhoneModalStore(store)}
                    className="flex min-h-[46px] items-center justify-center gap-1 rounded-xl border-2 border-[#D5CEC0] bg-[#F7F4ED] px-2 text-xs font-extrabold text-[#1C1A16] transition-transform duration-100 active:scale-[0.97]"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>電話</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. KPI（件数4枚 → 率2枚 → 順位1枚） */}
      <section aria-labelledby="today-kpi-heading">
        <div className="mb-2.5 flex items-center justify-between">
          <h2
            id="today-kpi-heading"
            className="flex items-center gap-2 text-base font-extrabold text-[#1C1A16]"
          >
            <TrendingUp className="h-5 w-5 text-[#D94E2B]" />
            <span>{isLeader ? "チーム全体の今月KPI" : "あなたの今月KPI"}</span>
          </h2>
          <span className="text-xs font-bold text-[#575249]">今月（サンプル）</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="text-xs font-bold text-[#575249]">訪問件数</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-[#1C1A16]">
              {displayCounts.visits}件
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="text-xs font-bold text-[#575249]">アポ獲得件数</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-[#1C1A16]">
              {displayCounts.appointments}件
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="text-xs font-bold text-[#575249]">商談件数</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-[#1C1A16]">
              {displayCounts.negotiations}件
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="text-xs font-bold text-[#575249]">契約件数</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-[#1C1A16]">
              {displayCounts.contracts}件
            </p>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="text-xs font-bold text-[#575249]">アポ率</p>
            <p className="mt-1 text-base font-extrabold tabular-nums text-[#1C1A16]">
              {displayRates.appointmentRateText}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="text-xs font-bold text-[#575249]">契約率</p>
            <p className="mt-1 text-base font-extrabold tabular-nums text-[#1C1A16]">
              {displayRates.contractRateText}
            </p>
          </div>
        </div>

        {!isLeader ? (
          <div className="mt-2.5 flex items-center justify-between rounded-2xl border-2 border-[#D94E2B]/40 bg-[#FFF5F2] px-4 py-3.5">
            <div>
              <p className="text-xs font-bold text-[#9A3412]">あなたの順位（契約件数）</p>
              <p className="mt-0.5 text-xl font-extrabold tabular-nums text-[#9A3412]">
                {selfRank}位 / {SAMPLE_TEAM_MEMBERS_KPI.length}人
              </p>
            </div>
            <Award className="h-6 w-6 text-[#D94E2B]" />
          </div>
        ) : (
          <div className="mt-2.5 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[#1C1A16]">
              <Award className="h-4 w-4 text-[#D94E2B]" />
              <span>チーム順位一覧（契約件数）</span>
            </p>
            <div className="divide-y divide-[#EAE3D5]">
              {rankedTeam.map((row) => (
                <div key={row.id} className="flex items-center justify-between py-2 text-xs">
                  <div className="flex items-center gap-2 font-bold">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1C1A16] text-[11px] text-white">
                      {row.rank}
                    </span>
                    <span>{row.name}</span>
                  </div>
                  <span className="font-bold tabular-nums text-[#3D3932]">
                    契約 {row.contracts}件 ・ 訪問 {row.visits}件
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* お知らせ一覧モーダル */}
      {showAnnouncementList && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ann-modal-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
        >
          <div className="gurupo-toast-pop max-h-[82vh] w-full max-w-md space-y-3 overflow-y-auto rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 id="ann-modal-title" className="text-base font-extrabold text-[#1C1A16]">
                お知らせ一覧
              </h3>
              <button
                type="button"
                onClick={() => setShowAnnouncementList(false)}
                aria-label="閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFEAE0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              {announcements.map((a) => (
                <article
                  key={a.id}
                  className={`rounded-2xl border-2 p-3.5 ${
                    a.read ? "border-[#D5CEC0] bg-white" : "border-[#D94E2B] bg-[#FFF8F6]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {a.important && (
                        <span className="rounded bg-[#D94E2B] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                          重要
                        </span>
                      )}
                      <span className="text-xs font-bold text-[#575249]">{a.date}</span>
                    </div>
                    <span className="text-[11px] font-extrabold text-[#474239]">
                      {a.read ? "既読" : "未読"}
                    </span>
                  </div>
                  <h4 className="mt-1.5 text-sm font-extrabold text-[#1C1A16]">{a.title}</h4>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-[#474239]">
                    {a.body}
                  </p>
                  {!a.read && (
                    <button
                      type="button"
                      onClick={() => markAsRead(a.id)}
                      className="mt-2.5 min-h-[40px] w-full rounded-xl bg-[#1C1A16] text-xs font-extrabold text-white transition-transform duration-100 active:scale-[0.97]"
                    >
                      既読にする
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 架空番号の電話確認モーダル */}
      {phoneModalStore && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="phone-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="gurupo-toast-pop w-full max-w-sm space-y-4 rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 id="phone-modal-title" className="text-base font-extrabold text-[#1C1A16]">
                {phoneModalStore.name}
              </h3>
              <button
                type="button"
                onClick={() => setPhoneModalStore(null)}
                aria-label="閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFEAE0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="rounded-xl border border-[#D5CEC0] bg-white p-3 text-center text-lg font-extrabold tabular-nums">
              {phoneModalStore.phone}
            </p>
            <p className="text-xs font-medium text-[#575249]">
              ※架空のサンプル番号です（実在の店舗ではありません）。
            </p>
            <button
              type="button"
              onClick={() => setPhoneModalStore(null)}
              className="min-h-[46px] w-full rounded-xl bg-[#1C1A16] text-xs font-extrabold text-white transition-transform duration-100 active:scale-[0.97]"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

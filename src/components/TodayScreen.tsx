import React, { useEffect, useMemo, useState } from "react";
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
  Plus,
} from "lucide-react";
import type { AppTab, UserProfile } from "../types/gurupo";
import { calculateKpiRates } from "../lib/kpiRates";
import {
  createAnnouncement,
  fetchHomeData,
  markAnnouncementRead,
  type HomeAnnouncement,
  type HomeData,
  type HomeStore,
} from "../services/homeDataService";

const EMPTY_HOME_DATA: HomeData = {
  pendingSyncCount: 0,
  schedules: [],
  stores: [],
  announcements: [],
  kpiCounts: { visits: 0, appointments: 0, negotiations: 0, contracts: 0 },
  selfRank: null,
  totalRankedMembers: 0,
  rankedTeam: [],
};

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
  const [data, setData] = useState<HomeData>(EMPTY_HOME_DATA);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<"distance" | "time">("distance");
  const [showAnnouncementList, setShowAnnouncementList] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState("");
  const [newAnnBody, setNewAnnBody] = useState("");
  const [newAnnImportant, setNewAnnImportant] = useState(false);
  const [savingAnn, setSavingAnn] = useState(false);
  const [phoneModalStore, setPhoneModalStore] = useState<HomeStore | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchHomeData(profile)
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setData(EMPTY_HOME_DATA);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile]);

  const unreadCount = data.announcements.filter((a) => !a.read).length;
  const hasImportantUnread = data.announcements.some((a) => !a.read && a.important);
  const latestAnnouncement = data.announcements[0] ?? null;

  const sortedStores = useMemo(() => {
    const copy = [...data.stores];
    if (sortMode === "distance") {
      return copy.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }
    return copy.sort((a, b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99"));
  }, [data.stores, sortMode]);

  const displayRates = calculateKpiRates(data.kpiCounts);

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

  const handleMarkAsRead = async (item: HomeAnnouncement) => {
    await markAnnouncementRead(profile.uid, item.id);
    setData((prev) => ({
      ...prev,
      announcements: prev.announcements.map((a) =>
        a.id === item.id ? { ...a, read: true } : a
      ),
    }));
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnBody.trim()) return;
    setSavingAnn(true);
    try {
      const created = await createAnnouncement(profile, {
        title: newAnnTitle,
        body: newAnnBody,
        important: newAnnImportant,
      });
      setData((prev) => ({
        ...prev,
        announcements: [created, ...prev.announcements],
      }));
      setNewAnnTitle("");
      setNewAnnBody("");
      setNewAnnImportant(false);
      showTempNotice("お知らせを公開しました");
    } finally {
      setSavingAnn(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <h1 className="text-xl font-extrabold text-[#1C1A16]">ホーム</h1>
        <p className="text-xs font-bold text-[#575249]">データを読み込んでいます...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
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

      {/* お知らせカード */}
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
                unreadCount > 0 ? "bg-amber-100 text-amber-950" : "bg-stone-200 text-stone-700"
              }`}
            >
              {unreadCount > 0 ? `未読 ${unreadCount}件` : "未読 0件"}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-bold text-[#474239]">
            {latestAnnouncement ? latestAnnouncement.title : "お知らせはまだありません"}
          </p>
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
            <p className="text-sm font-extrabold text-[#1C1A16]">{data.pendingSyncCount} 件</p>
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

      {/* 1. 今日の予定 */}
      <section aria-labelledby="today-schedule-heading">
        <div className="mb-2.5 flex items-center justify-between">
          <h2
            id="today-schedule-heading"
            className="flex items-center gap-2 text-base font-extrabold text-[#1C1A16]"
          >
            <Calendar className="h-5 w-5 text-[#D94E2B]" />
            <span>今日の予定</span>
          </h2>
          <span className="text-xs font-bold text-[#575249]">{data.schedules.length}件</span>
        </div>

        {data.schedules.length === 0 ? (
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4 text-xs font-bold text-[#575249]">
            今日の予定はまだ登録されていません。
          </div>
        ) : (
          <div className="space-y-2">
            {data.schedules.map((item, idx) => {
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
                    {isLeader && item.ownerName && (
                      <p className="mt-0.5 text-[11px] font-bold text-[#575249]">
                        担当：{item.ownerName}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

        {sortedStores.length === 0 ? (
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4 text-xs font-bold text-[#575249]">
            回る店舗はまだ登録されていません。
          </div>
        ) : (
          <div className="space-y-3">
            {sortedStores.map((store, idx) => {
              const anim = cardAnim(idx + 4);
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
                        ? `予定 ${store.scheduledTime}`
                        : store.distanceKm !== null
                        ? `直線 約${store.distanceKm}km`
                        : "距離未登録"}
                    </span>
                  </div>

                  <h3 className="mt-1.5 text-base font-extrabold text-[#1C1A16]">{store.name}</h3>

                  {store.situation && (
                    <p className="mt-1.5 truncate rounded-lg bg-[#F7F4ED] px-2.5 py-1.5 text-xs font-medium text-[#3D3932]">
                      状況：{store.situation}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigateTab("visit")}
                      className="flex min-h-[46px] items-center justify-center gap-1 rounded-xl bg-[#D94E2B] px-2 text-xs font-extrabold text-white transition-transform duration-100 active:scale-[0.97]"
                    >
                      <ClipboardCheck className="h-4 w-4 shrink-0" />
                      <span>訪問を記録</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab("stores")}
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
        )}
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
          <span className="text-xs font-bold text-[#575249]">今月</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="text-xs font-bold text-[#575249]">訪問件数</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-[#1C1A16]">
              {data.kpiCounts.visits}件
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="text-xs font-bold text-[#575249]">アポ獲得件数</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-[#1C1A16]">
              {data.kpiCounts.appointments}件
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="text-xs font-bold text-[#575249]">商談件数</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-[#1C1A16]">
              {data.kpiCounts.negotiations}件
            </p>
          </div>
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <p className="text-xs font-bold text-[#575249]">契約件数</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-[#1C1A16]">
              {data.kpiCounts.contracts}件
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
                {data.selfRank !== null && data.totalRankedMembers > 0
                  ? `${data.selfRank}位 / ${data.totalRankedMembers}人`
                  : "—"}
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
            {data.rankedTeam.length === 0 ? (
              <p className="text-xs font-bold text-[#575249]">今月の訪問・契約データはまだありません。</p>
            ) : (
              <div className="divide-y divide-[#EAE3D5]">
                {data.rankedTeam.map((row) => (
                  <div key={row.uid} className="flex items-center justify-between py-2 text-xs">
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
            )}
          </div>
        )}
      </section>

      {/* お知らせ一覧・投稿モーダル */}
      {showAnnouncementList && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ann-modal-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
        >
          <div className="gurupo-toast-pop max-h-[85vh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-xl">
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

            {isLeader && (
              <form
                onSubmit={handleCreateAnnouncement}
                className="space-y-2 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5"
              >
                <p className="text-xs font-extrabold text-[#1C1A16]">新しいお知らせを投稿</p>
                <input
                  type="text"
                  required
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  placeholder="タイトル"
                  className="min-h-[40px] w-full rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] px-3 text-xs font-bold"
                />
                <textarea
                  rows={2}
                  required
                  value={newAnnBody}
                  onChange={(e) => setNewAnnBody(e.target.value)}
                  placeholder="本文"
                  className="w-full rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] p-2.5 text-xs"
                />
                <label className="flex items-center gap-2 text-xs font-bold text-[#3D3932]">
                  <input
                    type="checkbox"
                    checked={newAnnImportant}
                    onChange={(e) => setNewAnnImportant(e.target.checked)}
                  />
                  <span>「重要」として表示する</span>
                </label>
                <button
                  type="submit"
                  disabled={savingAnn}
                  className="flex min-h-[40px] w-full items-center justify-center gap-1 rounded-xl bg-[#D94E2B] text-xs font-extrabold text-white disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  <span>{savingAnn ? "保存中..." : "投稿する"}</span>
                </button>
              </form>
            )}

            {data.announcements.length === 0 ? (
              <p className="py-4 text-center text-xs font-bold text-[#575249]">
                お知らせはまだありません。
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.announcements.map((a) => (
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
                        onClick={() => void handleMarkAsRead(a)}
                        className="mt-2.5 min-h-[40px] w-full rounded-xl bg-[#1C1A16] text-xs font-extrabold text-white transition-transform duration-100 active:scale-[0.97]"
                      >
                        既読にする
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 電話発信モーダル */}
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
            {phoneModalStore.phone ? (
              <a
                href={`tel:${phoneModalStore.phone}`}
                className="block rounded-xl border border-[#D5CEC0] bg-white p-3 text-center text-lg font-extrabold tabular-nums text-[#D94E2B]"
              >
                {phoneModalStore.phone}
              </a>
            ) : (
              <p className="rounded-xl border border-[#D5CEC0] bg-white p-3 text-center text-xs font-bold text-[#575249]">
                電話番号が未登録です
              </p>
            )}
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

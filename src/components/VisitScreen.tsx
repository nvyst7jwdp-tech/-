import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Lock,
  Bell,
  Plus,
  X,
  CheckCircle2,
  Trash2,
  MapPin,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type { UserProfile } from "../types/gurupo";
import {
  createManualVisitSchedule,
  deleteManualVisitSchedule,
  fetchVisitCalendarEvents,
  type CalendarVisitEvent,
} from "../services/visitCalendarService";
import {
  buildGoogleCalendarTemplateUrl,
  createGoogleCalendarEvent,
  getSyncedCalendarEventIds,
  isGoogleCalendarSyncEnabled,
  markCalendarEventSynced,
  requestGoogleCalendarAccessToken,
  setGoogleCalendarSyncEnabled,
} from "../services/googleCalendarService";

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function parseDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(str: string, delta: number): string {
  const dt = parseDate(str);
  dt.setDate(dt.getDate() + delta);
  return fmtDate(dt);
}

function getWeekDates(anchorStr: string): string[] {
  const dt = parseDate(anchorStr);
  const day = dt.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(dt);
  mon.setDate(dt.getDate() + diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return fmtDate(x);
  });
}

function getMonthGridDates(anchorStr: string): { date: string; inMonth: boolean }[] {
  const dt = parseDate(anchorStr);
  const year = dt.getFullYear();
  const month = dt.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const x = new Date(gridStart);
    x.setDate(gridStart.getDate() + i);
    return {
      date: fmtDate(x),
      inMonth: x.getMonth() === month,
    };
  });
}

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export function VisitScreen({ profile }: { profile: UserProfile }) {
  const isLeader = profile.role === "manager" || profile.role === "admin";
  const todayStr = fmtDate(new Date());
  const tomorrowStr = addDays(todayStr, 1);

  const [events, setEvents] = useState<CalendarVisitEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [scope, setScope] = useState<"mine" | "team">(isLeader ? "team" : "mine");
  const effectiveScope: "mine" | "team" = isLeader ? scope : "mine";
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [toast, setToast] = useState("");

  // Google カレンダー連携状態
  const [gcalEnabled, setGcalEnabled] = useState<boolean>(() =>
    isGoogleCalendarSyncEnabled(profile.uid)
  );
  const [syncedIds, setSyncedIds] = useState<Set<string>>(() =>
    getSyncedCalendarEventIds(profile.uid)
  );
  const [syncingGcal, setSyncingGcal] = useState(false);

  // リマインド状態
  const [reminderDismissed, setReminderDismissed] = useState(false);

  // 手動予定追加モーダル
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newPurpose, setNewPurpose] = useState("取材・商談");
  const [newDate, setNewDate] = useState(todayStr);
  const [newTime, setNewTime] = useState("11:00");
  const [savingNew, setSavingNew] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const loadEvents = () => {
    setLoading(true);
    fetchVisitCalendarEvents(profile)
      .then((list) => setEvents(list))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents();
  }, [profile]);

  const scopedEvents = useMemo(() => {
    if (effectiveScope === "team") return events;
    return events.filter(
      (ev) => ev.interviewerUid === profile.uid || ev.ownerUid === profile.uid
    );
  }, [events, effectiveScope, profile.uid]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarVisitEvent[]>();
    scopedEvents.forEach((ev) => {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    });
    return map;
  }, [scopedEvents]);

  const selectedDayEvents = eventsByDate.get(selectedDate) ?? [];
  const tomorrowEvents = eventsByDate.get(tomorrowStr) ?? [];

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthGrid = useMemo(() => getMonthGridDates(selectedDate), [selectedDate]);

  const selectedMonthLabel = useMemo(() => {
    const d = parseDate(selectedDate);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  }, [selectedDate]);

  const handleShiftPeriod = (dir: -1 | 1) => {
    if (viewMode === "week") {
      setSelectedDate((d) => addDays(d, dir * 7));
    } else {
      const dt = parseDate(selectedDate);
      dt.setMonth(dt.getMonth() + dir);
      setSelectedDate(fmtDate(dt));
    }
  };

  const handleToggleGcal = () => {
    const next = !gcalEnabled;
    setGcalEnabled(next);
    setGoogleCalendarSyncEnabled(profile.uid, next);
    showToast(
      next ? "Googleカレンダー連携をオンにしました" : "Googleカレンダー連携をオフにしました"
    );
  };

  const handleSyncToGoogleCalendar = async () => {
    if (!gcalEnabled) {
      showToast("先にGoogleカレンダー連携をオンにしてください");
      return;
    }
    const unsynced = scopedEvents.filter((ev) => !syncedIds.has(ev.id));
    if (unsynced.length === 0) {
      showToast("未同期の予定はありません");
      return;
    }
    setSyncingGcal(true);
    try {
      const token = await requestGoogleCalendarAccessToken();
      let count = 0;
      for (const ev of unsynced.slice(0, 10)) {
        await createGoogleCalendarEvent({
          accessToken: token,
          title: ev.title,
          date: ev.date,
          time: ev.time,
          location: ev.address,
          description: `担当：${ev.interviewerName}（ぐるポ 営業ポータルより同期）`,
        });
        markCalendarEventSynced(profile.uid, ev.id);
        count += 1;
      }
      setSyncedIds(getSyncedCalendarEventIds(profile.uid));
      showToast(`${count}件の予定をGoogleカレンダーに同期しました`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "同期に失敗しました");
    } finally {
      setSyncingGcal(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim() || !newDate) return;
    setSavingNew(true);
    try {
      const created = await createManualVisitSchedule(profile, {
        storeName: newStoreName,
        purpose: newPurpose,
        date: newDate,
        time: newTime,
      });
      setEvents((prev) =>
        [...prev, created].sort((a, b) =>
          a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
        )
      );
      setSelectedDate(newDate);
      setNewStoreName("");
      setShowAddModal(false);
      showToast("予定を追加しました");
    } finally {
      setSavingNew(false);
    }
  };

  const handleDeleteSchedule = async (ev: CalendarVisitEvent) => {
    if (ev.source !== "schedule") return;
    await deleteManualVisitSchedule(ev.id);
    setEvents((prev) => prev.filter((x) => x.id !== ev.id));
    showToast("予定を削除しました");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-[#1C1A16]">予定</h1>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={loadEvents}
            aria-label="予定を再読み込み"
            className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#D5CEC0] bg-white text-[#1C1A16] active:scale-[0.97]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setNewDate(selectedDate);
              setShowAddModal(true);
            }}
            className="flex min-h-[40px] items-center gap-1 rounded-xl bg-[#D94E2B] px-3 text-xs font-extrabold text-white active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            <span>予定を追加</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="gurupo-toast-pop flex items-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-900 px-4 py-2.5 text-xs font-extrabold text-white"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>{toast}</span>
        </div>
      )}

      {/* 翌日の予定リマインドバナー */}
      {!reminderDismissed && tomorrowEvents.length > 0 && (
        <div
          role="alert"
          className="space-y-2 rounded-2xl border-2 border-[#D94E2B] bg-[#FFF5F2] p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#9A3412]">
              <Bell className="h-4 w-4 text-[#D94E2B]" />
              <span>明日の予定リマインド（{tomorrowEvents.length}件）</span>
            </p>
            <button
              type="button"
              onClick={() => setReminderDismissed(true)}
              className="text-[11px] font-extrabold text-[#9A3412] underline"
            >
              確認済み
            </button>
          </div>
          <ul className="space-y-1">
            {tomorrowEvents.slice(0, 3).map((ev) => (
              <li key={ev.id} className="text-xs font-bold text-[#1C1A16]">
                ・{ev.time} {ev.storeName}（担当：{ev.interviewerName}）
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 自分の予定 / チーム予定 ＆ 週 / 月 切り替え */}
      <div className="space-y-2">
        <div
          role="group"
          aria-label="予定の表示範囲"
          className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-[#D5CEC0] bg-[#EFEAE0] p-1"
        >
          <button
            type="button"
            onClick={() => setScope("mine")}
            className={`min-h-[38px] rounded-xl text-xs font-extrabold ${
              effectiveScope === "mine" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
            }`}
          >
            自分の予定
          </button>
          <button
            type="button"
            disabled={!isLeader}
            onClick={() => {
              if (isLeader) setScope("team");
            }}
            className={`flex min-h-[38px] items-center justify-center gap-1 rounded-xl text-xs font-extrabold ${
              !isLeader
                ? "cursor-not-allowed text-[#8A8377] opacity-65"
                : effectiveScope === "team"
                ? "bg-[#1C1A16] text-white"
                : "text-[#474239]"
            }`}
          >
            {!isLeader && <Lock className="h-3.5 w-3.5 shrink-0" />}
            <span>チーム予定</span>
          </button>
        </div>

        {/* Googleカレンダー連携オン/オフ */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#D5CEC0] bg-white px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-[#D94E2B]" />
            <div>
              <p className="text-xs font-extrabold text-[#1C1A16]">Googleカレンダー連携</p>
              <p className="text-[10px] font-bold text-[#575249]">
                {gcalEnabled ? "オン（予定をGoogleカレンダーへ同期可能）" : "オフ"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gcalEnabled && (
              <button
                type="button"
                disabled={syncingGcal}
                onClick={() => void handleSyncToGoogleCalendar()}
                className="min-h-[32px] rounded-lg bg-[#1C1A16] px-2.5 text-[11px] font-extrabold text-white disabled:opacity-50"
              >
                {syncingGcal ? "同期中..." : "今すぐ同期"}
              </button>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={gcalEnabled}
              onClick={handleToggleGcal}
              className={`min-h-[32px] rounded-full px-3 text-[11px] font-extrabold ${
                gcalEnabled
                  ? "bg-emerald-700 text-white"
                  : "border border-[#D5CEC0] bg-[#EFEAE0] text-[#474239]"
              }`}
            >
              {gcalEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </div>

      {/* カレンダー本体（週表示 / 月表示） */}
      <section className="space-y-3 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="前の期間"
              onClick={() => handleShiftPeriod(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFEAE0]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-1.5 text-sm font-extrabold text-[#1C1A16]">
              {selectedMonthLabel}
            </span>
            <button
              type="button"
              aria-label="次の期間"
              onClick={() => handleShiftPeriod(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFEAE0]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="rounded-lg border border-[#D94E2B] bg-[#FFF5F2] px-2 py-1 text-[10px] font-extrabold text-[#B93818]"
              >
                今日
              </button>
            )}
            <div className="inline-flex rounded-xl border border-[#D5CEC0] bg-[#EFEAE0] p-0.5 text-[11px] font-extrabold">
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`min-h-[28px] rounded-lg px-2.5 ${
                  viewMode === "week" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                }`}
              >
                週
              </button>
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`min-h-[28px] rounded-lg px-2.5 ${
                  viewMode === "month" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                }`}
              >
                月
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-[#575249]">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        {viewMode === "week" ? (
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((d) => {
              const dt = parseDate(d);
              const count = eventsByDate.get(d)?.length ?? 0;
              const isSelected = d === selectedDate;
              const isToday = d === todayStr;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs font-extrabold ${
                    isSelected
                      ? "border-[#1C1A16] bg-[#1C1A16] text-white"
                      : isToday
                      ? "border-[#D94E2B] bg-[#FFF5F2] text-[#B93818]"
                      : "border-[#EAE3D5] bg-[#FBF9F4] text-[#1C1A16]"
                  }`}
                >
                  <span>{dt.getDate()}</span>
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[9px] font-extrabold ${
                        isSelected
                          ? "bg-[#D94E2B] text-white"
                          : "bg-[#2563EB] text-white"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((cell) => {
              const dt = parseDate(cell.date);
              const count = eventsByDate.get(cell.date)?.length ?? 0;
              const isSelected = cell.date === selectedDate;
              const isToday = cell.date === todayStr;
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDate(cell.date)}
                  className={`flex min-h-[42px] flex-col items-center justify-center rounded-lg border text-[11px] font-extrabold ${
                    isSelected
                      ? "border-[#1C1A16] bg-[#1C1A16] text-white"
                      : isToday
                      ? "border-[#D94E2B] bg-[#FFF5F2] text-[#B93818]"
                      : cell.inMonth
                      ? "border-[#EAE3D5] bg-[#FBF9F4] text-[#1C1A16]"
                      : "border-transparent bg-transparent text-[#A8A196]"
                  }`}
                >
                  <span>{dt.getDate()}</span>
                  {count > 0 && (
                    <span
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                        isSelected ? "bg-[#F27D52]" : "bg-[#2563EB]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 選択日の予定一覧 */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#1C1A16]">
            {parseDate(selectedDate).getMonth() + 1}月{parseDate(selectedDate).getDate()}
            日の予定（{selectedDayEvents.length}件）
          </h2>
          <span className="text-[11px] font-bold text-[#575249]">
            店舗画面のアポは自動連動
          </span>
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4 text-center text-xs font-bold text-[#575249]">
            この日の予定はありません。
          </div>
        ) : (
          selectedDayEvents.map((ev) => {
            const isSynced = syncedIds.has(ev.id);
            const gcalUrl = buildGoogleCalendarTemplateUrl({
              title: ev.title,
              date: ev.date,
              time: ev.time,
              location: ev.address,
              description: `担当：${ev.interviewerName}`,
            });
            return (
              <article
                key={ev.id}
                className="space-y-2 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-[#1C1A16] px-2.5 py-1 text-xs font-extrabold tabular-nums text-white">
                      {ev.time}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                        ev.source === "store_appt"
                          ? "bg-blue-100 text-blue-950"
                          : "bg-stone-200 text-stone-800"
                      }`}
                    >
                      {ev.source === "store_appt" ? "店舗アポ連動" : ev.purpose}
                    </span>
                    {isSynced && (
                      <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-900">
                        同期済み
                      </span>
                    )}
                  </div>
                  {ev.source === "schedule" && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteSchedule(ev)}
                      aria-label="予定を削除"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <h3 className="text-sm font-extrabold text-[#1C1A16]">{ev.storeName}</h3>
                <p className="text-xs font-bold text-[#474239]">
                  取材担当：{ev.interviewerName}
                </p>
                {ev.address && (
                  <p className="flex items-center gap-1 text-xs text-[#575249]">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D94E2B]" />
                    <span>{ev.address}</span>
                  </p>
                )}

                {gcalEnabled && (
                  <a
                    href={gcalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#D5CEC0] bg-[#FBF9F4] px-2.5 text-[11px] font-extrabold text-[#1C1A16]"
                  >
                    <ExternalLink className="h-3 w-3 text-[#D94E2B]" />
                    <span>Googleカレンダーで開く</span>
                  </a>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* 手動予定追加モーダル */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
        >
          <form
            onSubmit={handleCreateSchedule}
            className="gurupo-toast-pop w-full max-w-md space-y-3 rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold">予定を追加</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFEAE0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="店舗名・タイトル（必須）"
              className="min-h-[44px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-sm font-bold"
            />
            <input
              type="text"
              value={newPurpose}
              onChange={(e) => setNewPurpose(e.target.value)}
              placeholder="内容（例：取材、打ち合わせ）"
              className="min-h-[44px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white px-2 text-sm font-bold"
              />
              <input
                type="time"
                required
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white px-2 text-sm font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={savingNew}
              className="min-h-[46px] w-full rounded-2xl bg-[#D94E2B] text-sm font-extrabold text-white disabled:opacity-60"
            >
              {savingNew ? "保存中..." : "予定を保存"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

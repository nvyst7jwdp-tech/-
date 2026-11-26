import type { StoreRecord } from "../services/storesService";
import { estimateTravelMinutes, type LatLngPoint } from "../services/travelTimeService";

export const INTERVIEW_DURATION_MINUTES = 120; // 取材時間目安：1.5〜2時間（保守的に2時間で概算）
export const MIN_BUFFER_MINUTES = 30;

export interface AppointmentConflictWarning {
  message: string;
  detail: string;
}

function parseTimeToMinutes(timeStr: string): number | null {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

function formatMinutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, totalMinutes);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function checkAppointmentBuffer(params: {
  targetDate: string;
  targetTime: string;
  targetInterviewerUid: string;
  targetLocation: LatLngPoint;
  existingStores: StoreRecord[];
  excludeStoreId?: string;
  mapsApiKey: string;
}): Promise<AppointmentConflictWarning | null> {
  const {
    targetDate,
    targetTime,
    targetInterviewerUid,
    targetLocation,
    existingStores,
    excludeStoreId,
    mapsApiKey,
  } = params;

  if (!targetDate || !targetTime || !targetInterviewerUid) return null;
  const targetStart = parseTimeToMinutes(targetTime);
  if (targetStart === null) return null;

  // 同じ取材担当・同じ日付のアポ獲得店舗を抽出
  const sameDayAppts = existingStores
    .filter((s) => {
      if (s.id === excludeStoreId) return false;
      if (s.status !== "アポ獲得") return false;
      if (s.appointmentDate !== targetDate) return false;
      const ivUid = s.interviewerUid || s.ownerUid;
      return ivUid === targetInterviewerUid && Boolean(s.appointmentTime);
    })
    .map((s) => ({
      store: s,
      startMin: parseTimeToMinutes(s.appointmentTime || "") ?? 0,
    }))
    .sort((a, b) => a.startMin - b.startMin);

  if (sameDayAppts.length === 0) return null;

  // 直前のアポと直後のアポを特定
  const prevAppt = [...sameDayAppts]
    .reverse()
    .find((a) => a.startMin <= targetStart);
  const nextAppt = sameDayAppts.find((a) => a.startMin > targetStart);

  if (prevAppt) {
    const travelMin = await estimateTravelMinutes(
      { lat: prevAppt.store.lat, lng: prevAppt.store.lng },
      targetLocation,
      mapsApiKey
    );
    const prevEndMin = prevAppt.startMin + INTERVIEW_DURATION_MINUTES;
    const arrivalMin = prevEndMin + travelMin;
    const gapMin = targetStart - arrivalMin;
    if (gapMin <= MIN_BUFFER_MINUTES) {
      return {
        message:
          "前の取材終了後の移動を考慮すると、次の取材まで30分以下です。時間に余裕を持たせることをおすすめします。",
        detail: `直前：「${prevAppt.store.name}」（${prevAppt.store.appointmentTime}開始＋取材目安1.5〜2時間→移動約${travelMin}分で${formatMinutesToTime(arrivalMin)}頃着／空き${gapMin}分）`,
      };
    }
  }

  if (nextAppt) {
    const travelMin = await estimateTravelMinutes(
      targetLocation,
      { lat: nextAppt.store.lat, lng: nextAppt.store.lng },
      mapsApiKey
    );
    const currEndMin = targetStart + INTERVIEW_DURATION_MINUTES;
    const arrivalMin = currEndMin + travelMin;
    const gapMin = nextAppt.startMin - arrivalMin;
    if (gapMin <= MIN_BUFFER_MINUTES) {
      return {
        message:
          "前の取材終了後の移動を考慮すると、次の取材まで30分以下です。時間に余裕を持たせることをおすすめします。",
        detail: `直後：「${nextAppt.store.name}」（${nextAppt.store.appointmentTime}開始／今回の終了＋移動約${travelMin}分で${formatMinutesToTime(arrivalMin)}頃着・空き${gapMin}分）`,
      };
    }
  }

  return null;
}

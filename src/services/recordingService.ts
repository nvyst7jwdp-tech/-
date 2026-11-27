import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import type { UserProfile } from "../types/gurupo";

export type RecordingStatus = "processing" | "completed" | "error";

export interface RecordingFeedback {
  goodPoints: string[];
  improvements: string[];
  nextAdvice: string;
}

export interface RecordingTaskItem {
  id: string;
  text: string;
  done: boolean;
}

export interface RecordingRecord {
  id: string;
  title: string;
  ownerUid: string;
  ownerName: string;
  recordedAt: string;
  durationSec: number;
  audioUrl: string;
  storagePath: string;
  mimeType: string;
  status: RecordingStatus;
  storeId?: string;
  storeName?: string;
  summaryPoints: string[];
  tasks: RecordingTaskItem[];
  feedback: RecordingFeedback | null;
  analysisError?: string;
  processedAt?: string;
}

export interface TodayAppointmentStore {
  id: string;
  name: string;
  address: string;
  appointmentDate: string;
  appointmentTime: string;
  interviewerUid: string;
  interviewerName: string;
  ownerUid: string;
}

function getLocalTodayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLocalNowHm(now = new Date()): string {
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function mapRecordingDoc(id: string, data: Record<string, unknown>): RecordingRecord {
  const rawStatus = String(data.status ?? "completed");
  const status: RecordingStatus =
    rawStatus === "processing" || rawStatus === "error" ? rawStatus : "completed";

  const fb = data.feedback as Record<string, unknown> | null | undefined;
  return {
    id,
    title: String(data.title ?? "取材録音"),
    ownerUid: String(data.ownerUid ?? ""),
    ownerName: String(data.ownerName ?? ""),
    recordedAt: String(data.recordedAt ?? ""),
    durationSec: typeof data.durationSec === "number" ? data.durationSec : 0,
    audioUrl: String(data.audioUrl ?? ""),
    storagePath: String(data.storagePath ?? ""),
    mimeType: String(data.mimeType ?? "audio/webm"),
    status,
    storeId: typeof data.storeId === "string" && data.storeId ? data.storeId : undefined,
    storeName: typeof data.storeName === "string" && data.storeName ? data.storeName : undefined,
    summaryPoints: Array.isArray(data.summaryPoints)
      ? data.summaryPoints.map(String)
      : [],
    tasks: Array.isArray(data.tasks)
      ? data.tasks.map((t: Record<string, unknown>, idx: number) => ({
          id: String(t.id ?? `task-${idx}`),
          text: String(t.text ?? ""),
          done: Boolean(t.done),
        }))
      : [],
    feedback: fb
      ? {
          goodPoints: Array.isArray(fb.goodPoints) ? fb.goodPoints.map(String) : [],
          improvements: Array.isArray(fb.improvements) ? fb.improvements.map(String) : [],
          nextAdvice: String(fb.nextAdvice ?? ""),
        }
      : null,
    analysisError:
      typeof data.analysisError === "string" && data.analysisError ? data.analysisError : undefined,
    processedAt: typeof data.processedAt === "string" ? data.processedAt : undefined,
  };
}

export function subscribeRecordings(
  profile: UserProfile,
  onChange: (items: RecordingRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!db) {
    onChange([]);
    return () => {};
  }
  const isLeader = profile.role === "manager" || profile.role === "admin";
  const q = isLeader
    ? query(collection(db, "recordings"))
    : query(collection(db, "recordings"), where("ownerUid", "==", profile.uid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapRecordingDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
      onChange(list);
    },
    (err) => {
      onError(err instanceof Error ? err : new Error("録音一覧の取得に失敗しました。"));
    }
  );
}

export async function uploadRecordingOnly(params: {
  profile: UserProfile;
  audioBlob: Blob;
  mimeType: string;
  durationSec: number;
  title: string;
  storeId?: string;
  storeName?: string;
}): Promise<RecordingRecord> {
  if (!db || !storage) {
    throw new Error("Firebase Storage / Firestore が未初期化です。");
  }
  const { profile, audioBlob, mimeType, durationSec, storeId, storeName } = params;
  const recordedAt = new Date().toISOString();
  const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
  const storagePath = `recordings/${profile.uid}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, audioBlob, {
    contentType: mimeType || "audio/webm",
  });
  const audioUrl = await getDownloadURL(storageRef);

  const trimmedTitle = params.title.trim();
  const displayTitle =
    trimmedTitle ||
    (storeName
      ? `${storeName} 取材`
      : `取材録音 ${new Date().toLocaleString("ja-JP", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`);

  const payload = {
    title: displayTitle,
    ownerUid: profile.uid,
    ownerName: profile.name,
    recordedAt,
    durationSec,
    audioUrl,
    storagePath,
    mimeType,
    status: "processing" as RecordingStatus,
    storeId: storeId ?? "",
    storeName: storeName ?? "",
    summaryPoints: [] as string[],
    tasks: [] as RecordingTaskItem[],
    feedback: null as RecordingFeedback | null,
    analysisError: "",
  };

  const docRef = await addDoc(collection(db, "recordings"), payload);
  return {
    id: docRef.id,
    ...payload,
    storeId: storeId || undefined,
    storeName: storeName || undefined,
    analysisError: undefined,
  };
}

export async function updateRecordingTasks(
  recordingId: string,
  tasks: RecordingTaskItem[]
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "recordings", recordingId), { tasks });
}

export async function deleteRecordingRecord(recordingId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, "recordings", recordingId));
}

export async function fetchTodayAppointmentsForUser(
  profile: UserProfile
): Promise<TodayAppointmentStore[]> {
  if (!db) return [];
  const today = getLocalTodayYmd();
  const isLeader = profile.role === "manager" || profile.role === "admin";

  const snap = await getDocs(
    query(collection(db, "stores"), where("status", "==", "アポ獲得"))
  );

  const allToday = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name ?? ""),
        address: String(data.address ?? ""),
        appointmentDate: String(data.appointmentDate ?? "").trim(),
        appointmentTime: String(data.appointmentTime ?? "").trim(),
        interviewerUid: String(data.interviewerUid ?? ""),
        interviewerName: String(data.interviewerName ?? ""),
        ownerUid: String(data.ownerUid ?? ""),
      };
    })
    .filter((s) => s.appointmentDate === today);

  const mine = allToday.filter(
    (s) =>
      s.interviewerUid === profile.uid ||
      (!s.interviewerUid && s.ownerUid === profile.uid)
  );

  const list = mine.length > 0 ? mine : isLeader ? allToday : [];
  return list.sort((a, b) =>
    (a.appointmentTime || "99:99").localeCompare(b.appointmentTime || "99:99")
  );
}

export function pickNextAppointment(
  appointments: TodayAppointmentStore[],
  now = new Date()
): { next: TodayAppointmentStore | null; isUpcoming: boolean } {
  if (appointments.length === 0) return { next: null, isUpcoming: false };
  const nowHm = getLocalNowHm(now);
  const upcoming = appointments.find(
    (a) => (a.appointmentTime || "00:00") >= nowHm
  );
  if (upcoming) {
    return { next: upcoming, isUpcoming: true };
  }
  return { next: appointments[appointments.length - 1], isUpcoming: false };
}

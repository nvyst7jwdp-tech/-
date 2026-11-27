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
export type InterviewOutcome = "掲載のみ" | "再対応" | "契約済み";

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
  interviewDate: string;
  durationSec: number;
  audioUrl: string;
  storagePath: string;
  mimeType: string;
  status: RecordingStatus;
  storeId?: string;
  storeName?: string;
  outcome?: InterviewOutcome;
  followUpDate?: string;
  followUpTime?: string;
  summaryPoints: string[];
  tasks: RecordingTaskItem[];
  feedback: RecordingFeedback | null;
  analysisError?: string;
  processedAt?: string;
}

export interface ScheduledInterviewStore {
  id: string;
  name: string;
  address: string;
  appointmentDate: string;
  appointmentTime: string;
  interviewerUid: string;
  interviewerName: string;
  ownerUid: string;
}

export function getLocalTodayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mapRecordingDoc(id: string, data: Record<string, unknown>): RecordingRecord {
  const rawStatus = String(data.status ?? "completed");
  const status: RecordingStatus =
    rawStatus === "processing" || rawStatus === "error" ? rawStatus : "completed";

  const rawOutcome = String(data.outcome ?? "");
  const outcome: InterviewOutcome | undefined =
    rawOutcome === "掲載のみ" || rawOutcome === "再対応" || rawOutcome === "契約済み"
      ? rawOutcome
      : undefined;

  const recordedAt = String(data.recordedAt ?? "");
  const interviewDate =
    typeof data.interviewDate === "string" && data.interviewDate
      ? data.interviewDate
      : recordedAt
      ? recordedAt.slice(0, 10)
      : getLocalTodayYmd();

  const fb = data.feedback as Record<string, unknown> | null | undefined;
  return {
    id,
    title: String(data.title ?? "取材録音"),
    ownerUid: String(data.ownerUid ?? ""),
    ownerName: String(data.ownerName ?? ""),
    recordedAt,
    interviewDate,
    durationSec: typeof data.durationSec === "number" ? data.durationSec : 0,
    audioUrl: String(data.audioUrl ?? ""),
    storagePath: String(data.storagePath ?? ""),
    mimeType: String(data.mimeType ?? "audio/webm"),
    status,
    storeId: typeof data.storeId === "string" && data.storeId ? data.storeId : undefined,
    storeName: typeof data.storeName === "string" && data.storeName ? data.storeName : undefined,
    outcome,
    followUpDate:
      typeof data.followUpDate === "string" && data.followUpDate ? data.followUpDate : undefined,
    followUpTime:
      typeof data.followUpTime === "string" && data.followUpTime ? data.followUpTime : undefined,
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
      onError(err instanceof Error ? err : new Error("取材一覧の取得に失敗しました。"));
    }
  );
}

async function runBackgroundServerAnalysis(params: {
  recordingId: string;
  audioUrl: string;
  mimeType: string;
  title: string;
  storeName?: string;
  speakerName: string;
}): Promise<void> {
  if (!db) return;
  const docRef = doc(db, "recordings", params.recordingId);
  try {
    const res = await fetch("/api/analyze-recording", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioUrl: params.audioUrl,
        mimeType: params.mimeType,
        title: params.title,
        storeName: params.storeName ?? "",
        speakerName: params.speakerName,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      summaryPoints?: string[];
      tasks?: string[];
      feedback?: RecordingFeedback;
    };
    if (!res.ok) {
      throw new Error(data.error || "サーバーでのAI解析に失敗しました。");
    }

    const tasks: RecordingTaskItem[] = Array.isArray(data.tasks)
      ? data.tasks.map((text, idx) => ({
          id: `t-${Date.now()}-${idx}`,
          text: String(text),
          done: false,
        }))
      : [];

    await updateDoc(docRef, {
      status: "completed",
      summaryPoints: Array.isArray(data.summaryPoints) ? data.summaryPoints : [],
      tasks,
      feedback: data.feedback ?? null,
      analysisError: "",
      processedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI解析に失敗しました。";
    await updateDoc(docRef, {
      status: "error",
      analysisError: msg,
      processedAt: new Date().toISOString(),
    });
  }
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
  const interviewDate = getLocalTodayYmd();
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
    interviewDate,
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

  // 音声保存後、サーバー(/api/analyze-recording)へ重いAI解析を非同期でオフロード
  void runBackgroundServerAnalysis({
    recordingId: docRef.id,
    audioUrl,
    mimeType,
    title: displayTitle,
    storeName,
    speakerName: profile.name,
  });

  return {
    id: docRef.id,
    ...payload,
    storeId: storeId || undefined,
    storeName: storeName || undefined,
    analysisError: undefined,
  };
}

export async function completeInterviewOutcome(params: {
  profile: UserProfile;
  recordingId: string | null;
  storeId?: string;
  storeName?: string;
  outcome: InterviewOutcome;
  followUpDate?: string;
  followUpTime?: string;
}): Promise<void> {
  if (!db) throw new Error("データベースに接続できません。");
  const { profile, recordingId, storeId, storeName, outcome, followUpDate, followUpTime } = params;
  const todayYmd = getLocalTodayYmd();

  if (recordingId) {
    await updateDoc(doc(db, "recordings", recordingId), {
      outcome,
      followUpDate: outcome === "再対応" ? followUpDate ?? "" : "",
      followUpTime: outcome === "再対応" ? followUpTime ?? "" : "",
      interviewDate: todayYmd,
    });
  } else {
    // 録音がスキップまたは未作成の場合も取材一覧に結果を残す
    await addDoc(collection(db, "recordings"), {
      title: storeName ? `${storeName} 取材` : `取材記録 ${todayYmd}`,
      ownerUid: profile.uid,
      ownerName: profile.name,
      recordedAt: new Date().toISOString(),
      interviewDate: todayYmd,
      durationSec: 0,
      audioUrl: "",
      storagePath: "",
      mimeType: "",
      status: "completed",
      storeId: storeId ?? "",
      storeName: storeName ?? "",
      outcome,
      followUpDate: outcome === "再対応" ? followUpDate ?? "" : "",
      followUpTime: outcome === "再対応" ? followUpTime ?? "" : "",
      summaryPoints: [],
      tasks: [],
      feedback: null,
      analysisError: "",
    });
  }

  if (storeId) {
    if (outcome === "掲載のみ") {
      await updateDoc(doc(db, "stores", storeId), {
        status: "掲載のみ",
        appointmentDate: "",
        appointmentTime: "",
        contractDate: "",
        situation: `取材完了（${todayYmd}）：掲載のみ`,
      });
    } else if (outcome === "契約済み") {
      await updateDoc(doc(db, "stores", storeId), {
        status: "契約済み",
        appointmentDate: "",
        appointmentTime: "",
        contractDate: todayYmd,
        situation: `取材完了（${todayYmd}）：契約済み`,
      });
    } else {
      const nextDate = followUpDate || todayYmd;
      const nextTime = followUpTime || "";
      await updateDoc(doc(db, "stores", storeId), {
        status: "アポ獲得",
        appointmentDate: nextDate,
        appointmentTime: nextTime,
        interviewerUid: profile.uid,
        interviewerName: profile.name,
        contractDate: "",
        situation: `取材後・再対応予定（${nextDate}${nextTime ? ` ${nextTime}` : ""}）`,
      });
    }
  }
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

export async function fetchScheduledInterviews(
  profile: UserProfile
): Promise<ScheduledInterviewStore[]> {
  if (!db) return [];
  const isLeader = profile.role === "manager" || profile.role === "admin";
  const snap = await getDocs(
    query(collection(db, "stores"), where("status", "==", "アポ獲得"))
  );

  const all = snap.docs.map((d) => {
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
  });

  const filtered = isLeader
    ? all
    : all.filter(
        (s) =>
          s.interviewerUid === profile.uid ||
          (!s.interviewerUid && s.ownerUid === profile.uid)
      );

  // 日程・時間が早いものから優先表示
  return filtered.sort((a, b) => {
    const da = a.appointmentDate || "9999-99-99";
    const dbDate = b.appointmentDate || "9999-99-99";
    if (da !== dbDate) return da.localeCompare(dbDate);
    const ta = a.appointmentTime || "99:99";
    const tb = b.appointmentTime || "99:99";
    if (ta !== tb) return ta.localeCompare(tb);
    return a.name.localeCompare(b.name, "ja");
  });
}

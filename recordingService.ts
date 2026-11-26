import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import type { UserProfile } from "../types/gurupo";
import {
  analyzeRecordingWithGemini,
  type RecordingFeedback,
} from "./geminiAudioService";

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
  mimeType: string;
  summaryPoints: string[];
  tasks: RecordingTaskItem[];
  feedback: RecordingFeedback | null;
  analysisError?: string;
}

export async function fetchRecordings(
  profile: UserProfile
): Promise<RecordingRecord[]> {
  if (!db) return [];
  const isLeader = profile.role === "manager" || profile.role === "admin";
  const q = isLeader
    ? query(collection(db, "recordings"))
    : query(collection(db, "recordings"), where("ownerUid", "==", profile.uid));

  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: String(data.title ?? "録音"),
        ownerUid: String(data.ownerUid ?? ""),
        ownerName: String(data.ownerName ?? ""),
        recordedAt: String(data.recordedAt ?? ""),
        durationSec: typeof data.durationSec === "number" ? data.durationSec : 0,
        audioUrl: String(data.audioUrl ?? ""),
        mimeType: String(data.mimeType ?? "audio/webm"),
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
        feedback: data.feedback
          ? {
              goodPoints: Array.isArray(data.feedback.goodPoints)
                ? data.feedback.goodPoints.map(String)
                : [],
              improvements: Array.isArray(data.feedback.improvements)
                ? data.feedback.improvements.map(String)
                : [],
              nextAdvice: String(data.feedback.nextAdvice ?? ""),
            }
          : null,
        analysisError:
          typeof data.analysisError === "string" ? data.analysisError : undefined,
      };
    })
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export async function saveAndAnalyzeRecording(params: {
  profile: UserProfile;
  audioBlob: Blob;
  mimeType: string;
  durationSec: number;
  title: string;
  geminiApiKey: string;
}): Promise<RecordingRecord> {
  if (!db || !storage) {
    throw new Error("Firebase Storage / Firestore が未初期化です。");
  }
  const { profile, audioBlob, mimeType, durationSec, geminiApiKey } = params;
  const recordedAt = new Date().toISOString();
  const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
  const storageRef = ref(
    storage,
    `recordings/${profile.uid}/${Date.now()}.${ext}`
  );
  await uploadBytes(storageRef, audioBlob, {
    contentType: mimeType || "audio/webm",
  });
  const audioUrl = await getDownloadURL(storageRef);

  const displayTitle =
    params.title.trim() ||
    `商談録音 ${new Date().toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;

  let summaryPoints: string[] = [];
  let tasks: RecordingTaskItem[] = [];
  let feedback: RecordingFeedback | null = null;
  let analysisError = "";

  try {
    const ai = await analyzeRecordingWithGemini({
      audioBlob,
      mimeType,
      title: displayTitle,
      speakerName: profile.name,
      geminiApiKey,
    });
    summaryPoints = ai.summaryPoints;
    tasks = ai.tasks.map((text, idx) => ({
      id: `t-${Date.now()}-${idx}`,
      text,
      done: false,
    }));
    feedback = ai.feedback;
  } catch (err) {
    analysisError =
      err instanceof Error ? err.message : "AI解析に失敗しました。";
  }

  const payload = {
    title: displayTitle,
    ownerUid: profile.uid,
    ownerName: profile.name,
    recordedAt,
    durationSec,
    audioUrl,
    mimeType,
    summaryPoints,
    tasks,
    feedback,
    analysisError,
  };
  const docRef = await addDoc(collection(db, "recordings"), payload);
  return { id: docRef.id, ...payload };
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

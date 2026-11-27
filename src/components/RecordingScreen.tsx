import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Loader2,
  ChevronLeft,
  CheckSquare,
  Sparkles,
  ListChecks,
  ThumbsUp,
  Lightbulb,
  ArrowRight,
  Trash2,
  AlertTriangle,
  Volume2,
  Clock,
  User,
} from "lucide-react";
import type { UserProfile } from "../types/gurupo";
import {
  deleteRecordingRecord,
  fetchRecordings,
  saveAndAnalyzeRecording,
  updateRecordingTasks,
  type RecordingRecord,
} from "../services/recordingService";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDateTimeJa(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidates = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function RecordingScreen({ profile }: { profile: UserProfile }) {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? "";
  const [recordings, setRecordings] = useState<RecordingRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [titleInput, setTitleInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const titleRef = useRef("");
  titleRef.current = titleInput;

  const loadList = async () => {
    setLoadingList(true);
    setErrorMsg("");
    try {
      const items = await fetchRecordings(profile);
      setRecordings(items);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "録音一覧の読み込みに失敗しました。");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadList();
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.uid, profile.role]);

  const startRecording = async () => {
    setErrorMsg("");
    setStatusMsg("");
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      setErrorMsg("このブラウザはマイク録音に対応していません。SafariまたはChromeで開いてください。");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setErrorMsg("MediaRecorder APIが利用できません。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredMime = pickSupportedMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      const actualMime = recorder.mimeType || preferredMime || "audio/webm";
      chunksRef.current = [];
      elapsedRef.current = 0;
      setElapsedSec(0);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsRecording(false);

        const blob = new Blob(chunksRef.current, { type: actualMime });
        if (blob.size === 0) {
          setErrorMsg("録音データが空でした。もう一度お試しください。");
          return;
        }

        setSaving(true);
        setStatusMsg("音声を保存し、Geminiで要約・タスク・フィードバックを生成しています...");
        try {
          const saved = await saveAndAnalyzeRecording({
            profile,
            audioBlob: blob,
            mimeType: actualMime,
            durationSec: Math.max(1, elapsedRef.current),
            title: titleRef.current,
            geminiApiKey,
          });
          setRecordings((prev) => [saved, ...prev]);
          setSelectedId(saved.id);
          setTitleInput("");
          setStatusMsg(
            saved.analysisError
              ? "音声を保存しました（AI解析はエラーのためスキップされました）。"
              : "録音とAI解析が完了しました。"
          );
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : "録音の保存に失敗しました。");
          setStatusMsg("");
        } finally {
          setSaving(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSec(elapsedRef.current);
      }, 1000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.name === "NotAllowedError"
          ? "マイクへのアクセスが許可されていません。端末・ブラウザの設定でマイクを許可してください。"
          : "録音を開始できませんでした。"
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const selected = recordings.find((r) => r.id === selectedId) ?? null;

  const toggleTaskDone = async (rec: RecordingRecord, taskId: string) => {
    const nextTasks = rec.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
    setRecordings((prev) => prev.map((r) => (r.id === rec.id ? { ...r, tasks: nextTasks } : r)));
    try {
      await updateRecordingTasks(rec.id, nextTasks);
    } catch {
      setErrorMsg("タスク状態の更新に失敗しました。");
    }
  };

  const handleDelete = async (recId: string) => {
    setDeleting(true);
    try {
      await deleteRecordingRecord(recId);
      setRecordings((prev) => prev.filter((r) => r.id !== recId));
      if (selectedId === recId) setSelectedId(null);
      setConfirmDeleteId(null);
      setStatusMsg("録音を削除しました。");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "削除に失敗しました。");
    } finally {
      setDeleting(false);
    }
  };

  if (selected) {
    const doneCount = selected.tasks.filter((t) => t.done).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-xs font-extrabold text-[#1C1A16] active:scale-[0.97]"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>録音一覧へ</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteId(selected.id)}
            aria-label="録音を削除"
            className="flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-red-200 bg-red-50 px-3 text-xs font-extrabold text-red-700 active:scale-[0.97]"
          >
            <Trash2 className="h-4 w-4" />
            <span>削除</span>
          </button>
        </div>

        <section className="rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
          <h2 className="text-base font-extrabold text-[#1C1A16]">{selected.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-bold text-[#575249]">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDateTimeJa(selected.recordedAt)}（{formatDuration(selected.durationSec)}）
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {selected.ownerName}
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-[#1C1A16]">
              <Volume2 className="h-4 w-4 text-[#D94E2B]" />
              <span>音声再生</span>
            </p>
            {selected.audioUrl ? (
              <audio controls src={selected.audioUrl} className="w-full" preload="metadata" />
            ) : (
              <p className="text-xs font-bold text-[#575249]">音声URLが登録されていません。</p>
            )}
          </div>
        </section>

        {selected.analysisError && (
          <div className="flex items-start gap-2 rounded-2xl border-2 border-amber-400 bg-amber-50 p-3.5 text-xs font-bold text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <span>AI解析エラー：{selected.analysisError}</span>
          </div>
        )}

        <section className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#1C1A16]">
            <Sparkles className="h-4 w-4 text-[#D94E2B]" />
            <span>要点サマリー（{selected.summaryPoints.length}件）</span>
          </h3>
          {selected.summaryPoints.length > 0 ? (
            <ul className="mt-2.5 space-y-2">
              {selected.summaryPoints.map((pt, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 rounded-xl bg-[#FBF9F4] px-3 py-2 text-xs font-bold leading-relaxed text-[#1C1A16]"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1C1A16] text-[10px] font-extrabold text-white">
                    {idx + 1}
                  </span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs font-bold text-[#575249]">要約データがありません。</p>
          )}
        </section>

        <section className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#1C1A16]">
              <ListChecks className="h-4 w-4 text-[#2563EB]" />
              <span>抽出タスク（やるべきこと）</span>
            </h3>
            {selected.tasks.length > 0 && (
              <span className="rounded-full bg-[#EFEAE0] px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-[#474239]">
                {doneCount} / {selected.tasks.length} 完了
              </span>
            )}
          </div>
          {selected.tasks.length > 0 ? (
            <div className="mt-2.5 space-y-2">
              {selected.tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => void toggleTaskDone(selected, task.id)}
                  className={`flex min-h-[44px] w-full items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                    task.done
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950 line-through opacity-75"
                      : "border-[#D5CEC0] bg-[#FBF9F4] text-[#1C1A16]"
                  }`}
                >
                  <CheckSquare
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      task.done ? "text-emerald-600" : "text-[#8A8377]"
                    }`}
                  />
                  <span className="leading-relaxed">{task.text}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs font-bold text-[#575249]">抽出されたタスクはありません。</p>
          )}
        </section>

        {selected.feedback && (
          <section className="space-y-3 rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
            <h3 className="text-sm font-extrabold text-[#1C1A16]">AI営業フィードバック</h3>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>良かった点</span>
              </p>
              <ul className="mt-1.5 space-y-1 text-xs font-bold leading-relaxed text-emerald-950">
                {selected.feedback.goodPoints.map((g, i) => (
                  <li key={i}>・{g}</li>
                ))}
              </ul>
            </div>

            {selected.feedback.improvements.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span>改善のポイント</span>
                </p>
                <ul className="mt-1.5 space-y-1 text-xs font-bold leading-relaxed text-amber-950">
                  {selected.feedback.improvements.map((imp, i) => (
                    <li key={i}>・{imp}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-[#D94E2B]/30 bg-[#FFF5F2] p-3">
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#9A3412]">
                <ArrowRight className="h-3.5 w-3.5" />
                <span>次回への提案</span>
              </p>
              <p className="mt-1 text-xs font-bold leading-relaxed text-[#1C1A16]">
                {selected.feedback.nextAdvice}
              </p>
            </div>
          </section>
        )}

        {confirmDeleteId === selected.id && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <div className="w-full max-w-sm space-y-4 rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-xl">
              <h3 className="text-base font-extrabold">録音を削除しますか？</h3>
              <p className="text-xs font-bold text-[#474239]">
                「{selected.title}」の要約・タスク・記録を削除します。この操作は取り消せません。
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmDeleteId(null)}
                  className="min-h-[42px] rounded-xl border-2 border-[#D5CEC0] bg-white text-xs font-extrabold"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDelete(selected.id)}
                  className="min-h-[42px] rounded-xl bg-red-700 text-xs font-extrabold text-white"
                >
                  {deleting ? "削除中..." : "削除する"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[#1C1A16]">取材</h1>
        <span className="rounded-full bg-[#EFEAE0] px-2.5 py-1 text-[11px] font-extrabold text-[#474239]">
          {recordings.length}件
        </span>
      </div>

      <section className="space-y-3 rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
        <div>
          <label htmlFor="recording-title" className="block text-xs font-extrabold text-[#474239]">
            タイトル・店舗名（任意）
          </label>
          <input
            id="recording-title"
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            disabled={isRecording || saving}
            placeholder="例：サンプル居酒屋A 初回商談"
            className="mt-1 min-h-[44px] w-full rounded-xl border-2 border-[#D5CEC0] bg-[#FBF9F4] px-3 text-sm font-bold text-[#1C1A16]"
          />
        </div>

        <div className="flex items-center justify-between rounded-2xl border-2 border-[#D5CEC0] bg-[#FBF9F4] px-4 py-3">
          <div>
            <p className="text-xs font-bold text-[#575249]">
              {saving
                ? "保存・AI解析中"
                : isRecording
                ? "録音中..."
                : "ボタンを押して録音を開始"}
            </p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-[#1C1A16]">
              {formatDuration(elapsedSec)}
            </p>
          </div>

          {!isRecording ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void startRecording()}
              className="flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#D94E2B] px-5 text-sm font-extrabold text-white shadow-sm active:scale-[0.97] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
              <span>{saving ? "処理中..." : "録音開始"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#1C1A16] px-5 text-sm font-extrabold text-white shadow-sm active:scale-[0.97]"
            >
              <Square className="h-4 w-4 fill-current text-red-400" />
              <span>停止して解析</span>
            </button>
          )}
        </div>

        {statusMsg && (
          <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-950">
            {statusMsg}
          </p>
        )}
        {errorMsg && (
          <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
            {errorMsg}
          </p>
        )}
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#1C1A16]">録音一覧</h2>
          <button
            type="button"
            onClick={() => void loadList()}
            className="text-xs font-extrabold text-[#B93818]"
          >
            再読み込み
          </button>
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#D5CEC0] bg-white py-8 text-xs font-bold text-[#575249]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>読み込み中...</span>
          </div>
        ) : recordings.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#D5CEC0] bg-white p-6 text-center text-xs font-bold text-[#575249]">
            まだ録音がありません。上の「録音開始」から商談や取材の音声を記録できます。
          </div>
        ) : (
          <div className="space-y-2.5">
            {recordings.map((rec) => {
              const doneCount = rec.tasks.filter((t) => t.done).length;
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setSelectedId(rec.id)}
                  className="w-full rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5 text-left transition-transform duration-100 active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-extrabold text-[#1C1A16]">{rec.title}</p>
                    <span className="shrink-0 rounded-lg bg-[#EFEAE0] px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-[#474239]">
                      {formatDuration(rec.durationSec)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#575249]">
                    <span>{formatDateTimeJa(rec.recordedAt)}</span>
                    <span>・担当：{rec.ownerName}</span>
                    {rec.tasks.length > 0 && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-950">
                        タスク {doneCount}/{rec.tasks.length}
                      </span>
                    )}
                  </div>
                  {rec.summaryPoints[0] && (
                    <p className="mt-2 line-clamp-2 text-xs font-medium text-[#474239]">
                      {rec.summaryPoints[0]}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

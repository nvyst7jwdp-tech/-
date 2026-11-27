import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  Loader2,
  ChevronLeft,
  ChevronRight,
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
  CalendarClock,
  Store,
  CheckCircle2,
  Camera,
  MessageSquareText,
  FileText,
  Play,
} from "lucide-react";
import type { UserProfile } from "../types/gurupo";
import {
  completeInterviewOutcome,
  deleteRecordingRecord,
  fetchScheduledInterviews,
  getLocalTodayYmd,
  subscribeRecordings,
  updateRecordingTasks,
  uploadRecordingOnly,
  type InterviewOutcome,
  type RecordingRecord,
  type ScheduledInterviewStore,
} from "../services/recordingService";

const INTERVIEW_STEPS = [
  { id: 1, label: "ぐるポについて" },
  { id: 2, label: "撮影" },
  { id: 3, label: "インタビュー" },
  { id: 4, label: "ぐるポの説明" },
  { id: 5, label: "今後について" },
] as const;

const PHOTO_CHECKLIST = [
  "外観（店名看板・入口の雰囲気がわかるカット）",
  "内観（カウンター・テーブル席・店内の空気感）",
  "看板メニュー①（料理のアップ＋全体のシズル感）",
  "看板メニュー②（ドリンク・サブメニューとの組み合わせ）",
  "店主・スタッフの笑顔カット（許可をいただいた場合）",
];

const INTERVIEW_QUESTIONS = [
  "お店のオープン時期や、店名・コンセプトに込めた想いを教えてください。",
  "一番おすすめの看板メニュー（またはこだわりの食材・調理法）は何ですか？",
  "普段どのようなお客様（客層・利用シーン・時間帯）が多いですか？",
  "今後、新しく増やしていきたい客層や集客面での課題はありますか？",
  "ぐるポを見ているユーザー・読者へ一言メッセージをお願いします！",
];

const EXPLANATION_SCRIPTS = [
  {
    title: "① ぐるポ掲載のメリット",
    body: "「ぐるポは“本当においしいお店を探しているグルメ好き”が集まるSNSです。今日撮影させていただいたお写真とインタビュー記事を掲載することで、近隣エリアで店探しをしているユーザーへお店のこだわりを直接届けられます。」",
  },
  {
    title: "② 料金・掲載プランのご案内",
    body: "「まずは取材記事・写真掲載でお店の魅力を知っていただく形からスタートでき、集客をさらに強化したいタイミングでPRプランをご活用いただけます。初期の編集・ページ作成はすべてこちらで代行いたします。」",
  },
  {
    title: "③ 掲載までの流れ",
    body: "「本日の内容をもとに1〜2営業日ほどで記事ページを作成し、公開前に必ずお店側へ内容をご確認いただきます。修正のご希望があれば何度でも調整可能です。」",
  },
  {
    title: "④ よくあるご質問への切り返し",
    body: "「『SNSの更新に手間をかけられない』というお声もよくいただきますが、ぐるポ側は掲載後のお店の作業はほとんど不要です。まずはページを公開して反応を見てみませんか？」",
  },
];

const OUTCOME_BADGE_STYLES: Record<InterviewOutcome, string> = {
  掲載のみ: "border-purple-300 bg-purple-100 text-purple-950",
  再対応: "border-amber-300 bg-amber-100 text-amber-950",
  契約済み: "border-emerald-300 bg-emerald-100 text-emerald-950",
};

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

function formatDateSectionJa(ymd: string): string {
  if (!ymd) return "日付未設定";
  const parts = ymd.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return ymd;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const wdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${parts[0]}年${parts[1]}月${parts[2]}日（${wdays[d.getDay()]}）`;
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
  const [recordings, setRecordings] = useState<RecordingRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);

  // 取材候補（アポ獲得・日程時間早い順）
  const [scheduledStores, setScheduledStores] = useState<ScheduledInterviewStore[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [chosenStoreId, setChosenStoreId] = useState<string>("");

  // 取材進行フロー状態
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [checkedPhotos, setCheckedPhotos] = useState<Record<number, boolean>>({});
  const [checkedQuestions, setCheckedQuestions] = useState<Record<number, boolean>>({});
  const [outcome, setOutcome] = useState<InterviewOutcome>("掲載のみ");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  // 一覧絞り込み
  const [outcomeFilter, setOutcomeFilter] = useState<"すべて" | InterviewOutcome>("すべて");

  // 録音状態
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const sessionStoreRef = useRef<ScheduledInterviewStore | null>(null);
  const activeRecordingIdRef = useRef<string | null>(null);
  const uploadPromiseRef = useRef<Promise<RecordingRecord | null> | null>(null);

  const chosenStore = scheduledStores.find((s) => s.id === chosenStoreId) ?? null;

  const reloadAppts = async () => {
    setLoadingAppts(true);
    try {
      const list = await fetchScheduledInterviews(profile);
      setScheduledStores(list);
      if (list.length > 0) {
        setChosenStoreId((prev) =>
          prev && list.some((s) => s.id === prev) ? prev : list[0].id
        );
      } else {
        setChosenStoreId("");
      }
    } catch {
      // ignore non-blocking error
    } finally {
      setLoadingAppts(false);
    }
  };

  useEffect(() => {
    setLoadingList(true);
    setErrorMsg("");
    const unsub = subscribeRecordings(
      profile,
      (items) => {
        setRecordings(items);
        setLoadingList(false);
      },
      (err) => {
        setErrorMsg(err.message);
        setLoadingList(false);
      }
    );

    void reloadAppts();

    return () => {
      unsub();
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const startRecording = async () => {
    if (isRecording) return;
    setErrorMsg("");
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

      recorder.onstop = () => {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsRecording(false);

        const blob = new Blob(chunksRef.current, { type: actualMime });
        if (blob.size === 0) {
          setErrorMsg("録音データが空でした。");
          return;
        }

        const st = sessionStoreRef.current;
        setUploadingAudio(true);
        const promise = uploadRecordingOnly({
          profile,
          audioBlob: blob,
          mimeType: actualMime,
          durationSec: Math.max(1, elapsedRef.current),
          title: st ? `${st.name} 取材` : "",
          storeId: st?.id,
          storeName: st?.name,
        })
          .then((saved) => {
            activeRecordingIdRef.current = saved.id;
            setStatusMsg(
              "音声を保存しました！AI要約・タスク・フィードバックを裏側で自動作成しています。"
            );
            return saved;
          })
          .catch((err) => {
            setErrorMsg(
              err instanceof Error ? err.message : "音声の保存に失敗しました。"
            );
            return null;
          })
          .finally(() => {
            setUploadingAudio(false);
          });

        uploadPromiseRef.current = promise;
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

  const stopRecordingAndSave = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const beginInterviewSession = (store: ScheduledInterviewStore | null) => {
    sessionStoreRef.current = store;
    activeRecordingIdRef.current = null;
    uploadPromiseRef.current = null;
    setActiveStep(1);
    setCheckedPhotos({});
    setCheckedQuestions({});
    setOutcome("掲載のみ");
    setFollowUpDate(getLocalTodayYmd());
    setFollowUpTime("");
    setErrorMsg("");
    setStatusMsg("");
    setIsSessionActive(true);
  };

  const goToStep = (nextStep: 1 | 2 | 3 | 4 | 5) => {
    // ステップ3（インタビュー）に入った時に自動で音声録音を開始
    if (nextStep === 3 && activeStep < 3 && !isRecording && !activeRecordingIdRef.current) {
      void startRecording();
    }
    // ステップ4が終わってステップ5へ進む時に自動で録音を停止＆即保存
    if (activeStep === 4 && nextStep === 5 && isRecording) {
      stopRecordingAndSave();
    }
    setActiveStep(nextStep);
  };

  const finishInterview = async () => {
    setErrorMsg("");
    setSubmittingOutcome(true);
    try {
      // ステップ4終了直後の音声アップロードが完了していなければ待機してIDを取得
      if (uploadPromiseRef.current) {
        await uploadPromiseRef.current;
      }
      const st = sessionStoreRef.current;
      await completeInterviewOutcome({
        profile,
        recordingId: activeRecordingIdRef.current,
        storeId: st?.id,
        storeName: st?.name,
        outcome,
        followUpDate: outcome === "再対応" ? followUpDate : undefined,
        followUpTime: outcome === "再対応" ? followUpTime : undefined,
      });

      setIsSessionActive(false);
      setStatusMsg(
        st
          ? `「${st.name}」の取材結果（${outcome}）を保存し、店舗タブへ反映しました。`
          : `取材結果（${outcome}）を保存しました。`
      );
      void reloadAppts();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "取材結果の保存に失敗しました。");
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const cancelSession = () => {
    if (isRecording) {
      stopRecordingAndSave();
    }
    setIsSessionActive(false);
  };

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
      if (selectedDetailId === recId) setSelectedDetailId(null);
      setConfirmDeleteId(null);
      setStatusMsg("取材記録を削除しました。");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "削除に失敗しました。");
    } finally {
      setDeleting(false);
    }
  };

  const filteredRecordings = useMemo(() => {
    if (outcomeFilter === "すべて") return recordings;
    return recordings.filter((r) => r.outcome === outcomeFilter);
  }, [recordings, outcomeFilter]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, RecordingRecord[]>();
    for (const r of filteredRecordings) {
      const key = r.interviewDate || getLocalTodayYmd();
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredRecordings]);

  const selectedDetail = recordings.find((r) => r.id === selectedDetailId) ?? null;

  // 1. 取材進行画面（固定5ステップ）
  if (isSessionActive) {
    const st = sessionStoreRef.current;
    return (
      <div className="space-y-4">
        {/* 画面上部の緑の録音中ボタン（ステップ3・4など録音中に強調表示） */}
        {isRecording && (
          <div className="flex items-center justify-between rounded-2xl border-2 border-emerald-700 bg-emerald-600 px-4 py-2.5 text-white shadow-md">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-200" />
              <Mic className="h-4 w-4" />
              <span className="text-xs font-extrabold">録音中</span>
              <span className="rounded-lg bg-emerald-800/70 px-2 py-0.5 text-xs font-extrabold tabular-nums">
                {formatDuration(elapsedSec)}
              </span>
            </div>
            <button
              type="button"
              onClick={stopRecordingAndSave}
              className="rounded-xl bg-white px-3 py-1 text-[11px] font-extrabold text-emerald-800 active:scale-[0.97]"
            >
              録音停止
            </button>
          </div>
        )}

        {uploadingAudio && !isRecording && (
          <div className="flex items-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-extrabold text-amber-950">
            <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
            <span>音声を保存中...（そのまま次の操作へ進めます）</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-extrabold text-[#B93818]">取材進行中</p>
            <h1 className="text-lg font-extrabold text-[#1C1A16]">
              {st ? st.name : "取材セッション"}
            </h1>
          </div>
          <button
            type="button"
            onClick={cancelSession}
            className="min-h-[36px] rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-xs font-extrabold text-[#575249]"
          >
            中断して戻る
          </button>
        </div>

        {/* 固定ステップ 1〜5 ステッパー */}
        <div className="grid grid-cols-5 gap-1 rounded-2xl border-2 border-[#D5CEC0] bg-[#EFEAE0] p-1.5">
          {INTERVIEW_STEPS.map((s) => {
            const active = activeStep === s.id;
            const done = activeStep > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goToStep(s.id as 1 | 2 | 3 | 4 | 5)}
                className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl px-1 py-1 text-center transition-colors ${
                  active
                    ? "bg-[#1C1A16] text-white"
                    : done
                    ? "bg-emerald-100 text-emerald-950"
                    : "text-[#575249]"
                }`}
              >
                <span className="text-[10px] font-extrabold">{s.id}</span>
                <span className="mt-0.5 line-clamp-1 text-[9px] font-bold leading-tight">
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-2xl border-2 border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: ぐるポについて */}
        {activeStep === 1 && (
          <section className="space-y-3 rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#D94E2B] text-xs text-white">
                1
              </span>
              <span>ぐるポについて</span>
            </h2>
            <p className="text-xs font-bold leading-relaxed text-[#474239]">
              まずはご挨拶と本日の流れをお伝えします。お店の魅力をグルメ好きに届けるための取材であることを共有し、安心感を持っていただきましょう。
            </p>
            <div className="space-y-2 rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] p-3 text-xs font-bold text-[#1C1A16]">
              <p>・「本日はお時間いただきありがとうございます。グルメSNS『ぐるポ』担当の{profile.name}です。」</p>
              <p>・「本日は写真撮影と簡単なインタビュー（10分ほど）のあと、掲載についてご案内します。」</p>
            </div>
            <button
              type="button"
              onClick={() => goToStep(2)}
              className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-2xl bg-[#1C1A16] text-sm font-extrabold text-white active:scale-[0.98]"
            >
              <span>次へ（2. 撮影）</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        )}

        {/* Step 2: 撮影 */}
        {activeStep === 2 && (
          <section className="space-y-3 rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <Camera className="h-5 w-5 text-[#D94E2B]" />
              <span>2. 撮影チェックリスト</span>
            </h2>
            <p className="text-xs font-bold text-[#575249]">
              記事掲載用の写真を撮影しながらチェックしてください。次のステップで自動録音が開始されます。
            </p>
            <div className="space-y-2">
              {PHOTO_CHECKLIST.map((item, idx) => {
                const checked = Boolean(checkedPhotos[idx]);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setCheckedPhotos((prev) => ({ ...prev, [idx]: !prev[idx] }))
                    }
                    className={`flex min-h-[42px] w-full items-start gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-xs font-bold ${
                      checked
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : "border-[#D5CEC0] bg-[#FBF9F4] text-[#1C1A16]"
                    }`}
                  >
                    <CheckSquare
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        checked ? "text-emerald-600" : "text-[#8A8377]"
                      }`}
                    />
                    <span>{item}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="min-h-[44px] rounded-xl border-2 border-[#D5CEC0] bg-white text-xs font-extrabold"
              >
                前へ
              </button>
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-[#D94E2B] text-xs font-extrabold text-white active:scale-[0.98]"
              >
                <span>次へ（録音開始）</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {/* Step 3: インタビュー（自動録音開始 + 下に質問リスト） */}
        {activeStep === 3 && (
          <section className="space-y-3 rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-extrabold">
                <MessageSquareText className="h-5 w-5 text-[#D94E2B]" />
                <span>3. インタビュー</span>
              </h2>
              {!isRecording && !activeRecordingIdRef.current && (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white"
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span>録音を開始</span>
                </button>
              )}
            </div>
            <p className="text-xs font-bold text-[#575249]">
              自動で音声録音が開始されています。下の質問リストに沿ってヒアリングしてください。
            </p>

            <div className="space-y-2">
              <p className="text-xs font-extrabold text-[#1C1A16]">質問リスト</p>
              {INTERVIEW_QUESTIONS.map((q, idx) => {
                const checked = Boolean(checkedQuestions[idx]);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setCheckedQuestions((prev) => ({ ...prev, [idx]: !prev[idx] }))
                    }
                    className={`flex min-h-[44px] w-full items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-xs font-bold ${
                      checked
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : "border-[#D5CEC0] bg-[#FBF9F4] text-[#1C1A16]"
                    }`}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1C1A16] text-[10px] font-extrabold text-white">
                      Q{idx + 1}
                    </span>
                    <span className="leading-relaxed">{q}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="min-h-[44px] rounded-xl border-2 border-[#D5CEC0] bg-white text-xs font-extrabold"
              >
                前へ
              </button>
              <button
                type="button"
                onClick={() => goToStep(4)}
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-[#1C1A16] text-xs font-extrabold text-white active:scale-[0.98]"
              >
                <span>次へ（4. ぐるポの説明）</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {/* Step 4: ぐるポの説明（トークスクリプト + 次へで自動録音停止＆保存） */}
        {activeStep === 4 && (
          <section className="space-y-3 rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <FileText className="h-5 w-5 text-[#D94E2B]" />
              <span>4. ぐるポの説明（トークスクリプト）</span>
            </h2>
            <p className="text-xs font-bold text-[#575249]">
              説明資料に沿ってご案内してください。「説明を完了して次へ」を押すと録音が自動停止し、音声を保存して裏側で要約を作成します。
            </p>

            <div className="space-y-2.5">
              {EXPLANATION_SCRIPTS.map((sec) => (
                <div
                  key={sec.title}
                  className="rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] p-3"
                >
                  <p className="text-xs font-extrabold text-[#B93818]">{sec.title}</p>
                  <p className="mt-1 text-xs font-bold leading-relaxed text-[#1C1A16]">
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="min-h-[44px] rounded-xl border-2 border-[#D5CEC0] bg-white text-xs font-extrabold"
              >
                前へ
              </button>
              <button
                type="button"
                onClick={() => goToStep(5)}
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-[#D94E2B] text-xs font-extrabold text-white active:scale-[0.98]"
              >
                <span>説明を完了して次へ</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {/* Step 5: 今後について */}
        {activeStep === 5 && (
          <section className="space-y-4 rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span>5. 今後について（取材結果の登録）</span>
            </h2>
            <p className="text-xs font-bold text-[#575249]">
              本日の取材結果を選択してください。店舗タブのステータスにも自動で反映されます。
            </p>

            <div className="grid grid-cols-3 gap-2">
              {(["掲載のみ", "再対応", "契約済み"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setOutcome(opt)}
                  className={`min-h-[48px] rounded-xl border-2 text-xs font-extrabold transition-colors ${
                    outcome === opt
                      ? "border-[#1C1A16] bg-[#1C1A16] text-white"
                      : "border-[#D5CEC0] bg-[#FBF9F4] text-[#1C1A16]"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            {outcome === "再対応" && (
              <div className="space-y-2.5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3.5">
                <p className="text-xs font-extrabold text-amber-950">
                  再対応の日程（仮の日程でも可）
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900">
                      日付
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-amber-300 bg-white px-2.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900">
                      時間（任意）
                    </label>
                    <input
                      type="time"
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-amber-300 bg-white px-2.5 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submittingOutcome}
                onClick={() => goToStep(4)}
                className="min-h-[46px] rounded-xl border-2 border-[#D5CEC0] bg-white text-xs font-extrabold"
              >
                前へ
              </button>
              <button
                type="button"
                disabled={submittingOutcome}
                onClick={() => void finishInterview()}
                className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-emerald-700 text-xs font-extrabold text-white active:scale-[0.98] disabled:opacity-60"
              >
                {submittingOutcome ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : (
                  <span>取材を完了して保存</span>
                )}
              </button>
            </div>
          </section>
        )}
      </div>
    );
  }

  // 2. 取材詳細画面
  if (selectedDetail) {
    const doneCount = selectedDetail.tasks.filter((t) => t.done).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedDetailId(null)}
            className="flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-xs font-extrabold text-[#1C1A16] active:scale-[0.97]"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>取材一覧へ</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteId(selectedDetail.id)}
            aria-label="取材記録を削除"
            className="flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-red-200 bg-red-50 px-3 text-xs font-extrabold text-red-700 active:scale-[0.97]"
          >
            <Trash2 className="h-4 w-4" />
            <span>削除</span>
          </button>
        </div>

        <section className="rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-extrabold text-[#1C1A16]">{selectedDetail.title}</h2>
            <div className="flex shrink-0 items-center gap-1.5">
              {selectedDetail.outcome && (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${
                    OUTCOME_BADGE_STYLES[selectedDetail.outcome]
                  }`}
                >
                  {selectedDetail.outcome}
                </span>
              )}
              {selectedDetail.status === "processing" ? (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>処理中</span>
                </span>
              ) : selectedDetail.status === "error" ? (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-extrabold text-red-800">
                  解析エラー
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-900">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>解析完了</span>
                </span>
              )}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-bold text-[#575249]">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDateTimeJa(selectedDetail.recordedAt)}
              {selectedDetail.durationSec > 0
                ? `（${formatDuration(selectedDetail.durationSec)}）`
                : ""}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {selectedDetail.ownerName}
            </span>
            {selectedDetail.storeName && (
              <span className="flex items-center gap-1 text-[#B93818]">
                <Store className="h-3.5 w-3.5" />
                {selectedDetail.storeName}
              </span>
            )}
          </div>

          {selectedDetail.outcome === "再対応" && selectedDetail.followUpDate && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-950">
              再対応予定：{selectedDetail.followUpDate}{" "}
              {selectedDetail.followUpTime || ""}
            </p>
          )}

          {selectedDetail.audioUrl && (
            <div className="mt-3 rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-[#1C1A16]">
                <Volume2 className="h-4 w-4 text-[#D94E2B]" />
                <span>音声再生</span>
              </p>
              <audio
                controls
                src={selectedDetail.audioUrl}
                className="w-full"
                preload="metadata"
              />
            </div>
          )}
        </section>

        {selectedDetail.status === "processing" && (
          <div className="flex items-start gap-2.5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-950">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-700" />
            <div className="space-y-1">
              <p className="font-extrabold">サーバーで文字起こし・AI解析を実行中です</p>
              <p className="text-[11px] leading-relaxed text-amber-900">
                このまま他のタブや取材一覧へ移動しても処理は継続され、完了すると自動で反映されます。
              </p>
            </div>
          </div>
        )}

        {selectedDetail.analysisError && (
          <div className="flex items-start gap-2 rounded-2xl border-2 border-red-300 bg-red-50 p-3.5 text-xs font-bold text-red-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
            <span>AI解析エラー：{selectedDetail.analysisError}</span>
          </div>
        )}

        {selectedDetail.status === "completed" && (
          <>
            <section className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#1C1A16]">
                <Sparkles className="h-4 w-4 text-[#D94E2B]" />
                <span>要点サマリー（{selectedDetail.summaryPoints.length}件）</span>
              </h3>
              {selectedDetail.summaryPoints.length > 0 ? (
                <ul className="mt-2.5 space-y-2">
                  {selectedDetail.summaryPoints.map((pt, idx) => (
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
                {selectedDetail.tasks.length > 0 && (
                  <span className="rounded-full bg-[#EFEAE0] px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-[#474239]">
                    {doneCount} / {selectedDetail.tasks.length} 完了
                  </span>
                )}
              </div>
              {selectedDetail.tasks.length > 0 ? (
                <div className="mt-2.5 space-y-2">
                  {selectedDetail.tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => void toggleTaskDone(selectedDetail, task.id)}
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
                <p className="mt-2 text-xs font-bold text-[#575249]">
                  抽出されたタスクはありません。
                </p>
              )}
            </section>

            {selectedDetail.feedback && (
              <section className="space-y-3 rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
                <h3 className="text-sm font-extrabold text-[#1C1A16]">AI営業フィードバック</h3>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>良かった点</span>
                  </p>
                  <ul className="mt-1.5 space-y-1 text-xs font-bold leading-relaxed text-emerald-950">
                    {selectedDetail.feedback.goodPoints.map((g, i) => (
                      <li key={i}>・{g}</li>
                    ))}
                  </ul>
                </div>

                {selectedDetail.feedback.improvements.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                      <Lightbulb className="h-3.5 w-3.5" />
                      <span>改善のポイント</span>
                    </p>
                    <ul className="mt-1.5 space-y-1 text-xs font-bold leading-relaxed text-amber-950">
                      {selectedDetail.feedback.improvements.map((imp, i) => (
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
                    {selectedDetail.feedback.nextAdvice}
                  </p>
                </div>
              </section>
            )}
          </>
        )}

        {confirmDeleteId === selectedDetail.id && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <div className="w-full max-w-sm space-y-4 rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-xl">
              <h3 className="text-base font-extrabold">取材記録を削除しますか？</h3>
              <p className="text-xs font-bold text-[#474239]">
                「{selectedDetail.title}」を削除します。この操作は取り消せません。
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
                  onClick={() => void handleDelete(selectedDetail.id)}
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

  // 3. 取材トップ画面（取材選択 → 取材開始 ＋ 日程別・結果絞り込み付き取材一覧）
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[#1C1A16]">取材</h1>
        <span className="rounded-full bg-[#EFEAE0] px-2.5 py-1 text-[11px] font-extrabold text-[#474239]">
          予定 {scheduledStores.length}件
        </span>
      </div>

      {statusMsg && (
        <p className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-950">
          {statusMsg}
        </p>
      )}
      {errorMsg && (
        <p className="rounded-2xl border-2 border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-800">
          {errorMsg}
        </p>
      )}

      {/* 取材選択セクション（日程・時間が早いものから表示） */}
      <section className="space-y-3 rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-[#1C1A16]">
            <CalendarClock className="h-4 w-4 text-[#D94E2B]" />
            <span>取材を選択（日時が早い順）</span>
          </h2>
          <button
            type="button"
            onClick={() => void reloadAppts()}
            className="text-xs font-extrabold text-[#B93818]"
          >
            更新
          </button>
        </div>

        {loadingAppts ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-[#575249]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>アポ予定を読み込み中...</span>
          </div>
        ) : scheduledStores.length === 0 ? (
          <div className="space-y-2.5 rounded-xl border border-dashed border-[#D5CEC0] bg-[#FBF9F4] p-4 text-center">
            <p className="text-xs font-bold text-[#575249]">
              「アポ獲得」状態の取材予定がまだありません。
            </p>
            <button
              type="button"
              onClick={() => beginInterviewSession(null)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#D94E2B] px-4 text-xs font-extrabold text-white"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>店舗未指定で取材開始</span>
            </button>
          </div>
        ) : (
          <>
            <div className="max-h-60 space-y-2 overflow-y-auto pr-0.5">
              {scheduledStores.map((st, idx) => {
                const selected = st.id === chosenStoreId;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setChosenStoreId(st.id)}
                    className={`w-full rounded-xl border-2 p-3 text-left transition-colors ${
                      selected
                        ? "border-[#D94E2B] bg-[#FFF5F2]"
                        : "border-[#D5CEC0] bg-[#FBF9F4]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {idx === 0 && (
                          <span className="rounded bg-[#D94E2B] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                            最優先
                          </span>
                        )}
                        <span className="text-xs font-extrabold text-[#1C1A16]">
                          {st.appointmentDate || "日付未定"} {st.appointmentTime || ""}
                        </span>
                      </div>
                      {st.interviewerName && (
                        <span className="text-[11px] font-bold text-[#575249]">
                          担当：{st.interviewerName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-extrabold text-[#1C1A16]">{st.name}</p>
                    {st.address && (
                      <p className="mt-0.5 truncate text-[11px] font-bold text-[#575249]">
                        {st.address}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!chosenStore}
              onClick={() => beginInterviewSession(chosenStore)}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#D94E2B] text-sm font-extrabold text-white shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>
                {chosenStore ? `「${chosenStore.name}」の取材開始` : "取材開始"}
              </span>
            </button>
          </>
        )}
      </section>

      {/* 取材終了後：日程別・ステータス絞り込み付き取材一覧 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#1C1A16]">取材一覧（日程別）</h2>
          <span className="text-xs font-bold text-[#575249]">
            {filteredRecordings.length}件
          </span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(["すべて", "掲載のみ", "再対応", "契約済み"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setOutcomeFilter(tab)}
              className={`min-h-[34px] shrink-0 rounded-full border-2 px-3 text-xs font-extrabold ${
                outcomeFilter === tab
                  ? "border-[#1C1A16] bg-[#1C1A16] text-white"
                  : "border-[#D5CEC0] bg-white text-[#474239]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#D5CEC0] bg-white py-8 text-xs font-bold text-[#575249]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>読み込み中...</span>
          </div>
        ) : groupedByDate.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#D5CEC0] bg-white p-6 text-center text-xs font-bold text-[#575249]">
            該当する取材記録はありません。
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map(([ymd, items]) => (
              <div key={ymd} className="space-y-2">
                <p className="text-xs font-extrabold text-[#575249]">
                  {formatDateSectionJa(ymd)}（{items.length}件）
                </p>
                {items.map((rec) => {
                  const doneCount = rec.tasks.filter((t) => t.done).length;
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setSelectedDetailId(rec.id)}
                      className="w-full rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5 text-left transition-transform duration-100 active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-extrabold text-[#1C1A16]">{rec.title}</p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {rec.outcome && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${
                                OUTCOME_BADGE_STYLES[rec.outcome]
                              }`}
                            >
                              {rec.outcome}
                            </span>
                          )}
                          {rec.status === "processing" && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>処理中</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#575249]">
                        <span>{formatDateTimeJa(rec.recordedAt)}</span>
                        <span>・担当：{rec.ownerName}</span>
                        {rec.outcome === "再対応" && rec.followUpDate && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-950">
                            再対応：{rec.followUpDate}
                          </span>
                        )}
                        {rec.tasks.length > 0 && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-950">
                            タスク {doneCount}/{rec.tasks.length}
                          </span>
                        )}
                      </div>
                      {rec.status === "processing" ? (
                        <p className="mt-2 text-xs font-bold text-amber-800">
                          サーバーで要約・タスク・フィードバックを生成中です...
                        </p>
                      ) : (
                        rec.summaryPoints[0] && (
                          <p className="mt-2 line-clamp-2 text-xs font-medium text-[#474239]">
                            {rec.summaryPoints[0]}
                          </p>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

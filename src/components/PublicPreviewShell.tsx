import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  Home,
  Store,
  ClipboardCheck,
  BookOpen,
  Menu,
  CheckCircle2,
  RefreshCw,
  Calendar,
  MapPin,
  Phone,
  TrendingUp,
  Award,
  X,
  Bell,
  ChevronRight,
  ChevronLeft,
  LocateFixed,
  UserPlus,
  Check,
  Lock,
  Sparkles,
  Globe,
  Instagram,
  Copy,
  Loader2,
  PhoneCall,
  Trash2,
  Mail,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Mic,
  Square,
  Play,
  Pause,
  CheckSquare,
  ListChecks,
  ThumbsUp,
  Lightbulb,
  ArrowRight,
  Volume2,
  Clock,
  User,
  CalendarClock,
} from "lucide-react";

const INITIAL_ANNOUNCEMENTS = [
  {
    id: "ann-1",
    title: "【重要】今月末までの訪問記録入力ルールについて",
    date: "2026-11-24",
    body: "商談後の訪問記録は当日中に入力し、同期待ちが残らないようご確認ください（プレビュー用データ）。",
    important: true,
    read: false,
  },
  {
    id: "ann-2",
    title: "営業定例ミーティングの時間変更",
    date: "2026-11-22",
    body: "今週のチーム定例は11:00開始に変更となりました（プレビュー用データ）。",
    important: false,
    read: true,
  },
];

const SAMPLE_SCHEDULES = [
  { id: "sch-1", time: "10:30", storeName: "サンプル店舗A", purpose: "訪問", ownerRole: "member", ownerName: "佐藤 健太" },
  { id: "sch-2", time: "13:30", storeName: "サンプル食堂B", purpose: "初回商談", ownerRole: "member", ownerName: "佐藤 健太" },
  { id: "sch-3", time: "15:00", storeName: "サンプルベーカリーC", purpose: "オンライン商談", ownerRole: "team", ownerName: "田中 翔" },
  { id: "sch-4", time: "16:30", storeName: "サンプル居酒屋D", purpose: "申込確認", ownerRole: "member", ownerName: "佐藤 健太" },
];

const SAMPLE_TODAY_STORES = [
  { id: "st-1", name: "サンプル店舗A", status: "商談中", situation: "次回対応日を4日超過", distanceKm: 0.4, scheduledTime: "10:30", phone: "000-0101-0001" },
  { id: "st-2", name: "サンプル食堂B", status: "未接触", situation: "未接触", distanceKm: 0.8, scheduledTime: "13:30", phone: "000-0101-0002" },
  { id: "st-3", name: "サンプル居酒屋D", status: "申込手続き", situation: "本日夕方の再訪約束", distanceKm: 1.2, scheduledTime: "16:30", phone: "000-0101-0003" },
];

const SAMPLE_TEAM_MEMBERS_KPI = [
  { id: "u-yamada", name: "山田 陽子", visits: 34, appointments: 12, negotiations: 9, contracts: 6 },
  { id: "u-tanaka", name: "田中 翔", visits: 31, appointments: 10, negotiations: 8, contracts: 5 },
  { id: "u-satou", name: "佐藤 健太", visits: 28, appointments: 10, negotiations: 6, contracts: 4 },
  { id: "u-kondo", name: "近藤 蓮", visits: 22, appointments: 7, negotiations: 5, contracts: 4 },
];

const SAMPLE_MAP_STORES = [
  { id: "map-1", name: "サンプル店舗A", status: "アポ獲得", genre: "居酒屋", address: "大阪府大阪市中央区1-2-3", phone: "000-0101-0001", memo: "次回対応日を4日超過", x: 28, y: 34, ownerUid: "u-satou", ownerName: "佐藤 健太" },
  { id: "map-2", name: "サンプル食堂B", status: "キック", genre: "和食", address: "大阪府大阪市北区2-8-10", phone: "000-0101-0002", memo: "新規アプローチ候補", x: 68, y: 28, ownerUid: "u-satou", ownerName: "佐藤 健太" },
  { id: "map-3", name: "サンプル手打ちそばE", status: "契約済み", genre: "和食", address: "福岡県筑紫野市天拝坂4-1-9", phone: "000-0101-0004", memo: "年間プラン契約完了", x: 74, y: 66, ownerUid: "u-tanaka", ownerName: "田中 翔" },
  { id: "map-4", name: "サンプルカフェF", status: "掲載のみ", genre: "カフェ", address: "福岡県福岡市博多区3-4-5", phone: "000-0101-0005", memo: "掲載プラン比較資料を送付済み", x: 38, y: 72, ownerUid: "u-yamada", ownerName: "山田 陽子" },
];

const SAMPLE_PLACE_CANDIDATES = [
  { id: "cand-1", name: "サンプル和食 葵", status: "キック", genre: "和食", address: "架空市中央1-5-2", phone: "000-0202-0001", memo: "周辺検索候補（未登録）", x: 52, y: 42, ownerUid: "u-satou", ownerName: "佐藤 健太" },
  { id: "cand-2", name: "サンプル餃子 龍", status: "キック", genre: "和食", address: "架空市中央2-1-8", phone: "000-0202-0002", memo: "周辺検索候補（未登録）", x: 20, y: 62, ownerUid: "u-satou", ownerName: "佐藤 健太" },
];

const PREVIEW_STORE_STATUSES = ["キック", "アポ獲得", "掲載のみ", "契約済み"] as const;
const PREVIEW_GENRES = ["すべて", "カフェ", "焼肉", "居酒屋", "ラーメン", "イタリアン", "和食"] as const;

const PIN_STYLES: Record<string, { bg: string; badge: string; dot: string }> = {
  契約済み: { bg: "#059669", badge: "border-emerald-700 bg-emerald-100 text-emerald-950", dot: "bg-emerald-600" },
  アポ獲得: { bg: "#2563EB", badge: "border-blue-700 bg-blue-100 text-blue-950", dot: "bg-blue-600" },
  掲載のみ: { bg: "#7C3AED", badge: "border-purple-700 bg-purple-100 text-purple-950", dot: "bg-purple-600" },
  キック: { bg: "#6B7280", badge: "border-stone-500 bg-stone-200 text-stone-900", dot: "bg-stone-500" },
};

function parsePreviewAddress(address: string): { prefecture: string; city: string } {
  const prefMatch = address.match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/);
  const prefecture = prefMatch ? prefMatch[1] : "";
  const rest = prefecture ? address.slice(prefecture.length).trim() : address;
  const cityMatch = rest.match(/^([^\s\d丁目番地号]+?(?:市[^\s\d丁目番地号]+?区|[市区町村]))/);
  const city = cityMatch ? cityMatch[1] : "";
  return { prefecture, city };
}

type PreviewInsight = {
  website?: string;
  rating: string;
  attributes: string[];
  strengths: string[];
  instagramDm: string;
  emailSubject: string;
  emailBody: string;
  teleapoScript: string;
};

const SAMPLE_SALES_INSIGHTS: Record<string, PreviewInsight> = {
  "map-1": {
    website: "https://example.com/sample-store-a",
    rating: "★4.3（86件）",
    attributes: ["予約可", "ディナー営業", "アルコール提供"],
    strengths: [
      "駅近かつ予約対応で接待・会食需要を取り込みやすい立地と運用体制",
      "口コミで料理の盛り付けと接客の丁寧さが高評価（★4.3）",
      "ディナー中心の単価帯で、SNS経由のリピーター獲得と相性が良い",
    ],
    instagramDm: "はじめまして！グルメSNS『ぐるポ』の佐藤です。\nサンプル店舗A様の丁寧な接客と会食向けのお料理が素敵でDMしました！\n近隣の飲食店好きへ自然にお店を届けられるので、よければ事例お送りしましょうか？",
    emailSubject: "【ぐるポ】サンプル店舗A様の新規集客のご提案",
    emailBody: "サンプル店舗A ご担当者様\n\nグルメSNS『ぐるポ』の佐藤と申します。\n駅近・予約対応で評価★4.3の強みを活かし、近隣ユーザーの来店を増やす掲載事例がございます。\n5分ほどご説明できれば幸いです。\n\n佐藤 健太",
    teleapoScript: "①挨拶：お忙しいところ恐れ入ります。グルメSNS『ぐるポ』の佐藤と申します。\n②フック：駅近で予約対応もしっかりされていて、口コミ★4.3と非常に評判が良いのを拝見しお電話しました。\n③提案：会食・ディナー利用の新しいお客様に写真でお店の雰囲気を届ける掲載枠のご案内です。\n④打診：10分ほどオンラインかお伺いで事例をお見せできればと思うのですが、今週ご都合いかがでしょうか？",
  },
};

function getPreviewInsight(store: { id: string; name: string }): PreviewInsight {
  const hit = SAMPLE_SALES_INSIGHTS[store.id];
  if (hit) return hit;
  return {
    website: "https://example.com/" + encodeURIComponent(store.id),
    rating: "★4.2（68件）",
    attributes: ["イートイン可", "ディナー営業"],
    strengths: [
      `${store.name}ならではの看板メニューと安定した口コミ評価`,
      "近隣エリアでの認知拡大により新規・再来の両面で伸びしろが大きい",
      "料理のビジュアルを活かしたInstagram・SNS訴求と相性が良い業態",
    ],
    instagramDm: `はじめまして！グルメSNS『ぐるポ』の佐藤です。\n${store.name}様の看板メニューと雰囲気が素敵でDMしました！\n近隣のグルメ好きにお店を広める事例があるので、よければ少しご紹介してもよいでしょうか？`,
    emailSubject: `【ぐるポ】${store.name}様の集客ご提案`,
    emailBody: `${store.name} ご担当者様\n\nグルメSNS『ぐるポ』の佐藤と申します。\n地域の高評価と看板メニューの強みを活かし、新規来店につなげる掲載事例がございます。\nよろしければ一度資料をお送りさせてください。\n\n佐藤 健太`,
    teleapoScript: `①挨拶：お忙しいところ恐れ入ります。グルメSNS『ぐるポ』担当の佐藤と申します。\n②フック：${store.name}様の口コミ評価やお店の雰囲気を拝見し、ぜひご紹介したくお電話いたしました。\n③提案：エリア内で飲食店を探しているユーザーに、看板メニューの魅力を直接届けられるサービスです。\n④打診：5〜10分ほどご説明の機会をいただけますと幸いです。`,
  };
}

function formatRateWithCount(numerator: number, denominator: number) {
  if (denominator <= 0) return "—";
  const pct = Math.round((numerator / denominator) * 100);
  return `${pct}% (${numerator}/${denominator})`;
}

function calculateKpiRates(counts: { visits: number; appointments: number; contracts: number }) {
  return {
    appointmentRateText: formatRateWithCount(counts.appointments, counts.visits),
    contractRateText: formatRateWithCount(counts.contracts, counts.appointments),
  };
}

function computeRankByContracts(rows: { id: string; contracts: number }[], targetId: string) {
  const target = rows.find((r) => r.id === targetId);
  if (!target) return 1;
  return rows.filter((r) => r.contracts > target.contracts).length + 1;
}


const INITIAL_PREVIEW_RECORDINGS = [
  {
    id: "rec-1",
    title: "サンプル店舗A 初回商談",
    storeName: "サンプル店舗A",
    status: "completed",
    ownerName: "佐藤 健太",
    recordedAt: "11/26 10:45",
    durationSec: 412,
    summaryPoints: [
      "店舗側はInstagramでの新規集客と週末の予約数増加を特に重視している",
      "ぐるポの店舗ページ作成と料理写真撮影のサポートに強い関心を示した",
      "掲載プランの月額費用と初月キャンペーンについてオーナーへ確認する流れになった",
      "来週火曜日の14:00に再度オンラインで最終回答をもらう約束をした",
    ],
    tasks: [
      { id: "t-1", text: "掲載プラン比較資料と事例URLをメールで送付する", done: true },
      { id: "t-2", text: "12月2日(火) 14:00のオンライン再商談をカレンダー登録する", done: false },
      { id: "t-3", text: "撮影希望メニュー3品の事前ヒアリングシートを送る", done: false },
    ],
    feedback: {
      goodPoints: [
        "店舗の課題（週末の空き席）を冒頭で丁寧に引き出せていました。",
        "同業態の導入事例を具体的な数字とあわせて提示できていました。",
      ],
      improvements: [
        "料金説明の後にもう1ステップ質問を挟むと、懸念点をその場で解消しやすくなります。",
      ],
      nextAdvice: "次回はオーナー同席の前提で、初月の掲載スケジュール案を1枚用意して臨みましょう。",
    },
  },
  {
    id: "rec-2",
    title: "サンプル食堂B フォロー架電",
    storeName: "サンプル食堂B",
    status: "completed",
    ownerName: "佐藤 健太",
    recordedAt: "11/25 16:20",
    durationSec: 185,
    summaryPoints: [
      "先週お渡ししたパンフレットを店長が確認済みだった",
      "ランチ帯の認知拡大に関心があり、取材日時の調整を希望",
      "木曜日の15時以降なら店舗でゆっくり話せるとのこと",
    ],
    tasks: [
      { id: "t-4", text: "木曜15:00の訪問アポを店舗画面で登録する", done: false },
    ],
    feedback: {
      goodPoints: [
        "明るいトーンで手短に要点を伝え、次のアポ候補日を引き出せていました。",
      ],
      improvements: [
        "電話を切る前に当日の所要時間（約20分）も一言添えるとより安心感が高まります。",
      ],
      nextAdvice: "訪問前にサンプル食堂Bの最新口コミを2〜3件確認し、会話のフックにしましょう。",
    },
  },
];

const NAV_ITEMS = [
  { id: "today", label: "ホーム", icon: Home },
  { id: "stores", label: "店舗", icon: Store },
  { id: "visit", label: "予定", icon: Calendar },
  { id: "recording", label: "取材", icon: Mic },
  { id: "training", label: "研修", icon: BookOpen },
  { id: "menu", label: "メニュー", icon: Menu },
];

export function PublicPreviewShell() {
  const [rolePreview, setRolePreview] = useState("member");
  const [activeTab, setActiveTab] = useState("today");
  const [previewDayOffset, setPreviewDayOffset] = useState(0);
  const [previewCalView, setPreviewCalView] = useState<"week" | "month">("week");
  const [previewCalScope, setPreviewCalScope] = useState<"mine" | "team">("mine");
  const [previewGcalOn, setPreviewGcalOn] = useState(true);
  const [previewChartMode, setPreviewChartMode] = useState<"weekly" | "monthly">("weekly");
  const [announcements, setAnnouncements] = useState(INITIAL_ANNOUNCEMENTS);
  const [showAnnouncementList, setShowAnnouncementList] = useState(false);
  const [phoneModalStore, setPhoneModalStore] = useState<{ name: string; phone: string } | null>(null);
  const [toast, setToast] = useState("");
  const todayAnimatedRef = useRef(false);

  // 店舗タブ状態
  const [storeViewMode, setStoreViewMode] = useState("map");
  const [storeScope, setStoreScope] = useState<"mine" | "team">("mine");
  const [storeKeyword, setStoreKeyword] = useState("");
  const [storeFilter, setStoreFilter] = useState("すべて");
  const [selectedListStoreId, setSelectedListStoreId] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [storeGenre, setStoreGenre] = useState("すべて");
  const [candidateRegStatus, setCandidateRegStatus] = useState("キック");
  const [insightCopiedMode, setInsightCopiedMode] = useState<"dm" | "email" | "teleapo" | null>(null);
  const [previewPref, setPreviewPref] = useState("すべて");
  const [previewCity, setPreviewCity] = useState("すべて");
  const [previewDeletingStore, setPreviewDeletingStore] = useState<{ id: string; name: string } | null>(null);
  const [previewScriptTab, setPreviewScriptTab] = useState<"dm" | "email" | "teleapo">("dm");
  const [previewZoomedPinId, setPreviewZoomedPinId] = useState<string | null>(null);
  const [mapStores, setMapStores] = useState(SAMPLE_MAP_STORES);
  const [placeSearchText, setPlaceSearchText] = useState("");
  const [showPlaceCandidates, setShowPlaceCandidates] = useState(true);
  const [selectedPinId, setSelectedPinId] = useState<string | null>("map-1");
  const [previewSectionTab, setPreviewSectionTab] = useState<"customers" | "prospects">("customers");
  const [expandedPreviewCandIds, setExpandedPreviewCandIds] = useState<Record<string, boolean>>({});
  const [candApptDate, setCandApptDate] = useState("");
  const [candApptTime, setCandApptTime] = useState("");
  const [candApptErr, setCandApptErr] = useState("");
  const [candInterviewer, setCandInterviewer] = useState("佐藤 健太");
  const [previewRecordings, setPreviewRecordings] = useState(INITIAL_PREVIEW_RECORDINGS);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [recTitleInput, setRecTitleInput] = useState("");
  const [selectedRecStore, setSelectedRecStore] = useState("サンプル食堂B");
  const [isPreviewRecording, setIsPreviewRecording] = useState(false);
  const [previewRecSec, setPreviewRecSec] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);


  const isLeader = rolePreview === "manager" || rolePreview === "admin";
  const unreadCount = announcements.filter((a) => !a.read).length;
  const hasImportantUnread = announcements.some((a) => !a.read && a.important);
  const latestAnnouncement = announcements[0];

  const notify = (msg: string) => setToast(msg);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!isPreviewRecording) return;
    const iv = setInterval(() => setPreviewRecSec((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [isPreviewRecording]);

  useEffect(() => {
    if (!selectedPinId && !selectedListStoreId) return;
    setInsightLoading(true);
    setInsightCopiedMode(null);
    const t = setTimeout(() => setInsightLoading(false), 380);
    return () => clearTimeout(t);
  }, [selectedPinId, selectedListStoreId]);

  useEffect(() => {
    if (activeTab === "today" && !todayAnimatedRef.current) {
      todayAnimatedRef.current = true;
    }
  }, [activeTab]);

  const selfKpi = SAMPLE_TEAM_MEMBERS_KPI.find((m) => m.id === "u-satou") ?? SAMPLE_TEAM_MEMBERS_KPI[0];
  const selfRank = computeRankByContracts(SAMPLE_TEAM_MEMBERS_KPI, "u-satou");
  const teamTotals = useMemo(
    () =>
      SAMPLE_TEAM_MEMBERS_KPI.reduce(
        (acc, cur) => ({
          visits: acc.visits + cur.visits,
          appointments: acc.appointments + cur.appointments,
          negotiations: acc.negotiations + cur.negotiations,
          contracts: acc.contracts + cur.contracts,
        }),
        { visits: 0, appointments: 0, negotiations: 0, contracts: 0 }
      ),
    []
  );
  const displayCounts = isLeader ? teamTotals : selfKpi;
  const displayRates = calculateKpiRates(displayCounts);
  const rankedTeam = useMemo(
    () =>
      [...SAMPLE_TEAM_MEMBERS_KPI]
        .sort((a, b) => b.contracts - a.contracts)
        .map((row) => ({ ...row, rank: computeRankByContracts(SAMPLE_TEAM_MEMBERS_KPI, row.id) })),
    []
  );

  const visibleSchedules = isLeader
    ? SAMPLE_SCHEDULES
    : SAMPLE_SCHEDULES.filter((s) => s.ownerRole === "member");
  const shouldAnimateToday = !todayAnimatedRef.current;

  return (
    <div className="min-h-screen bg-[#E9E3D7] text-[#1C1A16] font-sans antialiased">
      <style>{`
        @keyframes gurupoFadeSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gurupoCardStagger { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gurupoCheckPop { 0% { opacity: 0; transform: scale(0.92); } 100% { opacity: 1; transform: scale(1); } }
        .gurupo-screen-enter { animation: gurupoFadeSlide 220ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .gurupo-card-stagger { animation: gurupoCardStagger 220ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .gurupo-toast-pop { animation: gurupoCheckPop 180ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .gurupo-screen-enter, .gurupo-card-stagger, .gurupo-toast-pop { animation: none !important; transition: none !important; }
          * { transition-duration: 0ms !important; }
        }
      `}</style>

      {toast && (
        <div
          role="status"
          className="gurupo-toast-pop fixed left-1/2 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-900 px-4 py-3 text-xs font-extrabold text-white shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>{toast}</span>
        </div>
      )}

      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#F7F4ED] shadow-xl">
        <header className="sticky top-0 z-30 border-b-2 border-[#D5CEC0] bg-[#FBF9F4]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-extrabold">ぐるポ 営業ポータル</p>
                <span className="rounded bg-[#1C1A16] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  PREVIEW
                </span>
              </div>
              <p className="text-xs font-bold text-[#575249]">ログイン不要プレビュー（架空データ）</p>
            </div>
          </div>
          <div className="mt-2">
            <p className="mb-1 text-[10px] font-bold text-[#575249]">表示確認用（役割別の見え方切替）</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#D5CEC0] bg-[#EFEAE0] p-1">
              {[
                { id: "member", label: "メンバー" },
                { id: "manager", label: "マネージャー" },
                { id: "admin", label: "管理者" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRolePreview(r.id)}
                  className={`min-h-[34px] rounded-lg text-xs font-extrabold transition-transform duration-100 active:scale-[0.97] ${
                    rolePreview === r.id ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4">
          {activeTab === "today" && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-extrabold text-[#1C1A16]">ホーム</h1>
                  {previewDayOffset !== 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewDayOffset(0)}
                      className="rounded-lg border border-[#D94E2B] bg-[#FFF5F2] px-2.5 py-1 text-[11px] font-extrabold text-[#B93818]"
                    >
                      今日に戻る
                    </button>
                  )}
                </div>
                {(() => {
                  const base = new Date();
                  base.setDate(base.getDate() + previewDayOffset);
                  const wdays = ["日", "月", "火", "水", "木", "金", "土"];
                  const label = `${base.getMonth() + 1}月${base.getDate()}日（${wdays[base.getDay()]}）`;
                  const dayKick = Math.max(0, (isLeader ? 5 : 2) + (previewDayOffset % 3));
                  const dayAppt = Math.max(0, (isLeader ? 3 : 1) + ((previewDayOffset + 1) % 2));
                  const dayList = isLeader ? 2 : 1;
                  const dayContract = previewDayOffset === 0 ? (isLeader ? 2 : 1) : 0;
                  const pts = previewChartMode === "weekly"
                    ? [
                        { label: "10/19", kick: 6, appt: 3, con: 1 },
                        { label: "10/26", kick: 8, appt: 4, con: 2 },
                        { label: "11/2", kick: 7, appt: 5, con: 2 },
                        { label: "11/9", kick: 10, appt: 6, con: 3 },
                        { label: "11/16", kick: 9, appt: 5, con: 2 },
                        { label: "11/23", kick: 12, appt: 7, con: 4 },
                      ]
                    : [
                        { label: "6月", kick: 18, appt: 8, con: 3 },
                        { label: "7月", kick: 22, appt: 10, con: 4 },
                        { label: "8月", kick: 20, appt: 11, con: 5 },
                        { label: "9月", kick: 26, appt: 13, con: 6 },
                        { label: "10月", kick: 29, appt: 15, con: 7 },
                        { label: "11月", kick: 34, appt: 18, con: 9 },
                      ];
                  const maxV = Math.max(...pts.flatMap((pt) => [pt.kick, pt.appt, pt.con]));
                  const gx = (i: number) => 24 + (i / (pts.length - 1)) * 280;
                  const gy = (v: number) => 14 + 98 - (v / maxV) * 98;
                  const pathFor = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${gx(i).toFixed(1)},${gy(v).toFixed(1)}`).join(" ");
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-2xl border-2 border-[#1C1A16] bg-white px-2 py-1.5">
                        <button
                          type="button"
                          aria-label="前日へ"
                          onClick={() => setPreviewDayOffset((v) => v - 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFEAE0]"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold">{label}</span>
                          {previewDayOffset === 0 && (
                            <span className="rounded-md bg-[#D94E2B] px-1.5 py-0.5 text-[10px] font-extrabold text-white">今日</span>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label="翌日へ"
                          onClick={() => setPreviewDayOffset((v) => v + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFEAE0]"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="rounded-2xl border-2 border-[#1C1A16] bg-[#1C1A16] p-4 text-white">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-extrabold">{label} の実績</p>
                          <span className="rounded-md bg-[#D94E2B] px-2 py-0.5 text-[11px] font-extrabold">当日</span>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                          <div className="rounded-xl bg-white/10 py-2">
                            <p className="text-[10px] text-stone-300">キック</p>
                            <p className="text-lg font-extrabold tabular-nums">{dayKick}</p>
                          </div>
                          <div className="rounded-xl bg-[#2563EB]/35 py-2">
                            <p className="text-[10px] text-blue-200">アポ獲得</p>
                            <p className="text-lg font-extrabold tabular-nums">{dayAppt}</p>
                          </div>
                          <div className="rounded-xl bg-white/10 py-2">
                            <p className="text-[10px] text-stone-300">掲載のみ</p>
                            <p className="text-lg font-extrabold tabular-nums">{dayList}</p>
                          </div>
                          <div className="rounded-xl bg-emerald-600/35 py-2">
                            <p className="text-[10px] text-emerald-200">契約済み</p>
                            <p className="text-lg font-extrabold tabular-nums">{dayContract}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3">
                          <p className="text-xs font-extrabold">週間トータル</p>
                          <p className="mt-1 text-xs font-bold text-[#474239] tabular-nums">
                            キック {isLeader ? 12 : 4} ・ アポ {isLeader ? 7 : 3} ・ 契約 {isLeader ? 4 : 1}
                          </p>
                        </div>
                        <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3">
                          <p className="text-xs font-extrabold">月間トータル</p>
                          <p className="mt-1 text-xs font-bold text-[#474239] tabular-nums">
                            キック {isLeader ? 34 : 11} ・ アポ {isLeader ? 18 : 6} ・ 契約 {isLeader ? 9 : 3}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold">KPI推移（折れ線グラフ）</p>
                          <div className="inline-flex rounded-xl border border-[#D5CEC0] bg-[#EFEAE0] p-0.5 text-[10px] font-extrabold">
                            <button
                              type="button"
                              onClick={() => setPreviewChartMode("weekly")}
                              className={`rounded-lg px-2 py-1 ${previewChartMode === "weekly" ? "bg-[#1C1A16] text-white" : ""}`}
                            >
                              1週間おき
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewChartMode("monthly")}
                              className={`rounded-lg px-2 py-1 ${previewChartMode === "monthly" ? "bg-[#1C1A16] text-white" : ""}`}
                            >
                              1ヶ月おき
                            </button>
                          </div>
                        </div>
                        <svg viewBox="0 0 320 135" className="h-36 w-full">
                          <path d={pathFor(pts.map((x) => x.kick))} fill="none" stroke="#D94E2B" strokeWidth="2.2" />
                          <path d={pathFor(pts.map((x) => x.appt))} fill="none" stroke="#2563EB" strokeWidth="2.2" />
                          <path d={pathFor(pts.map((x) => x.con))} fill="none" stroke="#059669" strokeWidth="2.2" />
                          {pts.map((pt, i) => (
                            <g key={pt.label}>
                              <circle cx={gx(i)} cy={gy(pt.kick)} r="3.2" fill="#D94E2B" />
                              <circle cx={gx(i)} cy={gy(pt.appt)} r="3.2" fill="#2563EB" />
                              <circle cx={gx(i)} cy={gy(pt.con)} r="3.2" fill="#059669" />
                              <text x={gx(i)} y="128" textAnchor="middle" fontSize="9" fill="#575249">{pt.label}</text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={() => setShowAnnouncementList(true)}
                style={shouldAnimateToday ? { animationDelay: "0ms" } : undefined}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-[#D5CEC0] bg-white px-4 py-3 text-left transition-transform duration-100 active:scale-[0.98] ${
                  shouldAnimateToday ? "gurupo-card-stagger" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Bell className="h-4 w-4 text-[#D94E2B]" />
                    <span className="text-xs font-extrabold">お知らせ</span>
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
                      {unreadCount > 0 ? `未読 ${unreadCount}件` : "すべて既読"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs font-bold text-[#474239]">
                    {latestAnnouncement?.title}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#575249]" />
              </button>

              <div
                style={shouldAnimateToday ? { animationDelay: "35ms" } : undefined}
                className={`flex items-center justify-between rounded-2xl border-2 border-[#D5CEC0] bg-white px-4 py-3 ${
                  shouldAnimateToday ? "gurupo-card-stagger" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFEAE0]">
                    <RefreshCw className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#575249]">同期待ちの記録</p>
                    <p className="text-sm font-extrabold">2 件</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("visit")}
                  className="min-h-[40px] rounded-xl border-2 border-[#1C1A16] bg-[#FBF9F4] px-3 text-xs font-extrabold transition-transform duration-100 active:scale-[0.97]"
                >
                  訪問タブへ
                </button>
              </div>

              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-extrabold">
                    <Calendar className="h-5 w-5 text-[#D94E2B]" />
                    <span>今日の予定</span>
                  </h2>
                  <span className="text-xs font-bold text-[#575249]">{visibleSchedules.length}件</span>
                </div>
                <div className="space-y-2">
                  {visibleSchedules.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                      <span className="rounded-lg bg-[#1C1A16] px-2.5 py-1 text-xs font-extrabold tabular-nums text-white">
                        {item.time}
                      </span>
                      <div>
                        <p className="text-sm font-extrabold">
                          {item.storeName} {item.purpose}
                        </p>
                        {isLeader && (
                          <p className="mt-0.5 text-[11px] font-bold text-[#575249]">
                            担当：{item.ownerName}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-extrabold">
                    <TrendingUp className="h-5 w-5 text-[#D94E2B]" />
                    <span>{isLeader ? "チーム全体の今月KPI" : "あなたの今月KPI"}</span>
                  </h2>
                  <span className="text-xs font-bold text-[#575249]">今月</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                    <p className="text-xs font-bold text-[#575249]">訪問件数</p>
                    <p className="mt-1 text-xl font-extrabold tabular-nums">{displayCounts.visits}件</p>
                  </div>
                  <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                    <p className="text-xs font-bold text-[#575249]">アポ獲得件数</p>
                    <p className="mt-1 text-xl font-extrabold tabular-nums">{displayCounts.appointments}件</p>
                  </div>
                  <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                    <p className="text-xs font-bold text-[#575249]">商談件数</p>
                    <p className="mt-1 text-xl font-extrabold tabular-nums">{displayCounts.negotiations}件</p>
                  </div>
                  <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                    <p className="text-xs font-bold text-[#575249]">契約件数</p>
                    <p className="mt-1 text-xl font-extrabold tabular-nums">{displayCounts.contracts}件</p>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                    <p className="text-xs font-bold text-[#575249]">アポ率</p>
                    <p className="mt-1 text-base font-extrabold tabular-nums">{displayRates.appointmentRateText}</p>
                  </div>
                  <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                    <p className="text-xs font-bold text-[#575249]">契約率</p>
                    <p className="mt-1 text-base font-extrabold tabular-nums">{displayRates.contractRateText}</p>
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
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold">
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
            </div>
          )}

          {activeTab === "stores" && (() => {
            const effectiveStoreScope = isLeader ? storeScope : "mine";
            const qStore = storeKeyword.trim().toLowerCase();
            const scopedPreviewStores = mapStores.filter(
              (st) => effectiveStoreScope === "team" || st.ownerUid === "u-satou"
            );
            const prefOpts = ["すべて", ...Array.from(new Set(scopedPreviewStores.map((s) => parsePreviewAddress(s.address).prefecture).filter(Boolean)))];
            const cityOpts = previewPref === "すべて"
              ? ["すべて"]
              : ["すべて", ...Array.from(new Set(scopedPreviewStores.filter((s) => parsePreviewAddress(s.address).prefecture === previewPref).map((s) => parsePreviewAddress(s.address).city).filter(Boolean)))];
            const filteredPins = scopedPreviewStores.filter((st) => {
              const matchStatus = storeFilter === "すべて" || st.status === storeFilter;
              const matchQuery =
                !qStore ||
                st.name.toLowerCase().includes(qStore) ||
                st.address.toLowerCase().includes(qStore);
              const parsed = parsePreviewAddress(st.address);
              const matchPref = previewPref === "すべて" || parsed.prefecture === previewPref;
              const matchCity = previewCity === "すべて" || parsed.city === previewCity;
              return matchStatus && matchQuery && matchPref && matchCity;
            });
            const activeCandidates = showPlaceCandidates
              ? SAMPLE_PLACE_CANDIDATES.filter((c) => !mapStores.some((m) => m.id === c.id))
              : [];
            const selectedPin =
              filteredPins.find((st) => st.id === selectedPinId) ||
              activeCandidates.find((c) => c.id === selectedPinId) ||
              null;
            const isSelectedCandidate = activeCandidates.some((c) => c.id === selectedPin?.id);

            const registerCandidateOneClick = (cand: typeof SAMPLE_PLACE_CANDIDATES[number], chosenStatus = candidateRegStatus) => {
              if (mapStores.some((m) => m.id === cand.id)) return;
              setMapStores((prev) => [
                { ...cand, status: chosenStatus, memo: `周辺検索から「${chosenStatus}」で登録` },
                ...prev,
              ]);
              setSelectedPinId(cand.id);
              notify(`${cand.name} を「${chosenStatus}」で登録しました`);
            };

            return (
              <div className="gurupo-screen-enter space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h1 className="text-xl font-extrabold">顧客・店舗</h1>
                  <div className="flex rounded-xl border-2 border-[#D5CEC0] bg-[#EFEAE0] p-0.5 text-xs font-extrabold">
                    <button
                      type="button"
                      onClick={() => setStoreViewMode("map")}
                      className={`min-h-[36px] rounded-lg px-3 ${storeViewMode === "map" ? "bg-[#1C1A16] text-white" : "text-[#474239]"}`}
                    >
                      地図
                    </button>
                    <button
                      type="button"
                      onClick={() => setStoreViewMode("list")}
                      className={`min-h-[36px] rounded-lg px-3 ${storeViewMode === "list" ? "bg-[#1C1A16] text-white" : "text-[#474239]"}`}
                    >
                      一覧
                    </button>
                  </div>
                </div>

                <div
                  role="tablist"
                  aria-label="顧客と店舗の切り替え"
                  className="grid grid-cols-2 gap-1.5 rounded-2xl border-2 border-[#1C1A16] bg-[#EFEAE0] p-1"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewSectionTab("customers")}
                    className={`min-h-[38px] rounded-xl text-xs font-extrabold ${
                      previewSectionTab === "customers" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                    }`}
                  >
                    顧客（登録済み {filteredPins.length}）
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSectionTab("prospects")}
                    className={`min-h-[38px] rounded-xl text-xs font-extrabold ${
                      previewSectionTab === "prospects" ? "bg-[#D94E2B] text-white" : "text-[#474239]"
                    }`}
                  >
                    店舗（候補 {activeCandidates.length}）
                  </button>
                </div>

                <div
                  role="group"
                  aria-label="店舗の表示範囲"
                  className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-[#D5CEC0] bg-[#EFEAE0] p-1"
                >
                  <button
                    type="button"
                    onClick={() => setStoreScope("mine")}
                    className={`min-h-[38px] rounded-xl text-xs font-extrabold transition-transform duration-100 active:scale-[0.97] ${
                      effectiveStoreScope === "mine" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                    }`}
                  >
                    自分の店舗
                  </button>
                  <button
                    type="button"
                    disabled={!isLeader}
                    onClick={() => {
                      if (isLeader) setStoreScope("team");
                    }}
                    className={`flex min-h-[38px] items-center justify-center gap-1 rounded-xl text-xs font-extrabold transition-transform duration-100 ${
                      !isLeader
                        ? "cursor-not-allowed text-[#8A8377] opacity-65"
                        : effectiveStoreScope === "team"
                        ? "bg-[#1C1A16] text-white active:scale-[0.97]"
                        : "text-[#474239] active:scale-[0.97]"
                    }`}
                  >
                    {!isLeader && <Lock className="h-3.5 w-3.5 shrink-0" />}
                    <span>チーム全体</span>
                  </button>
                </div>

                <div className="space-y-2 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                  <p className="text-xs font-extrabold">周辺の飲食店を探す（Places API）</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {PREVIEW_GENRES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setStoreGenre(g)}
                        className={`min-h-[30px] shrink-0 rounded-full border-2 px-2.5 text-[11px] font-extrabold ${
                          storeGenre === g ? "border-[#D94E2B] bg-[#D94E2B] text-white" : "border-[#D5CEC0] bg-[#FBF9F4] text-[#3D3932]"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={placeSearchText}
                      onChange={(e) => setPlaceSearchText(e.target.value)}
                      placeholder="駅名やエリア（例：難波駅）"
                      className="min-h-[40px] flex-1 rounded-xl border-2 border-[#D5CEC0] bg-[#FBF9F4] px-3 text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlaceCandidates(true);
                        notify(`${placeSearchText.trim() || "指定エリア"}周辺の飲食店を表示しました`);
                      }}
                      className="min-h-[40px] rounded-xl bg-[#1C1A16] px-3.5 text-xs font-extrabold text-white"
                    >
                      検索
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlaceCandidates(true);
                      notify("現在地周辺の飲食店を表示しました");
                    }}
                    className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[#1C1A16] bg-[#F7F4ED] text-xs font-extrabold"
                  >
                    <LocateFixed className="h-4 w-4 text-[#D94E2B]" />
                    <span>現在地周辺の飲食店を検索</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={storeKeyword}
                  onChange={(e) => setStoreKeyword(e.target.value)}
                  placeholder="登録済み店舗を絞り込み"
                  className="min-h-[42px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-xs font-medium focus:border-[#D94E2B] focus:outline-none"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="都道府県で絞り込み"
                    value={previewPref}
                    onChange={(e) => {
                      setPreviewPref(e.target.value);
                      setPreviewCity("すべて");
                    }}
                    className="min-h-[38px] rounded-xl border-2 border-[#D5CEC0] bg-white px-2 text-xs font-extrabold"
                  >
                    {prefOpts.map((p) => (
                      <option key={p} value={p}>{p === "すべて" ? "都道府県：すべて" : p}</option>
                    ))}
                  </select>
                  <select
                    aria-label="市区町村で絞り込み"
                    value={previewCity}
                    disabled={previewPref === "すべて"}
                    onChange={(e) => setPreviewCity(e.target.value)}
                    className="min-h-[38px] rounded-xl border-2 border-[#D5CEC0] bg-white px-2 text-xs font-extrabold disabled:bg-[#EFEAE0] disabled:text-[#8A8377]"
                  >
                    {cityOpts.map((c) => (
                      <option key={c} value={c}>{c === "すべて" ? "市区町村：すべて" : c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {["すべて", ...PREVIEW_STORE_STATUSES].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStoreFilter(st)}
                      className={`min-h-[36px] shrink-0 rounded-full border-2 px-3 text-xs font-extrabold ${
                        storeFilter === st ? "border-[#1C1A16] bg-[#1C1A16] text-white" : "border-[#D5CEC0] bg-white text-[#3D3932]"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {storeViewMode === "map" ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[#D5CEC0] bg-white px-3.5 py-2.5 text-xs font-extrabold">
                      {PREVIEW_STORE_STATUSES.map((st) => (
                        <span key={st} className="inline-flex items-center gap-1.5">
                          <span className={`h-3 w-3 rounded-full ${PIN_STYLES[st].dot}`} />
                          <span>{st}</span>
                        </span>
                      ))}
                      {activeCandidates.length > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-[#9A3412]">
                          <span className="h-3 w-3 rounded-full bg-orange-600" />
                          <span>検索候補</span>
                        </span>
                      )}
                    </div>

                    <div className={`relative h-72 w-full overflow-hidden rounded-2xl border-2 bg-[#EAE4D7] transition-all ${previewZoomedPinId ? "border-[#D94E2B]" : "border-[#C7BFB0]"}`}>
                      <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 bg-[#FBF9F4] opacity-85" />
                      <div className="absolute inset-y-0 left-[46%] w-3 bg-[#FBF9F4] opacity-85" />
                      {filteredPins.map((pin) => {
                        const isSel = selectedPin?.id === pin.id;
                        const isMinePin = pin.ownerUid === "u-satou";
                        return (
                          <button
                            key={pin.id}
                            type="button"
                            onClick={() => setSelectedPinId(pin.id)}
                            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-150 ${
                              isSel ? "z-20 scale-125" : isMinePin ? "z-15" : "z-10"
                            }`}
                          >
                            <span
                              style={{ backgroundColor: PIN_STYLES[pin.status].bg }}
                              className={`flex items-center justify-center rounded-full border-2 border-white font-extrabold text-white shadow-md ${
                                isMinePin ? "h-10 w-10 text-xs opacity-100" : "h-7 w-7 text-[10px] opacity-55"
                              } ${isSel ? "ring-4 ring-[#1C1A16]/30 opacity-100" : ""}`}
                            >
                              {pin.name.replace("サンプル", "").slice(0, 1)}
                            </span>
                          </button>
                        );
                      })}
                      {activeCandidates.map((cand) => {
                        const isSel = selectedPin?.id === cand.id;
                        return (
                          <button
                            key={cand.id}
                            type="button"
                            onClick={() => setSelectedPinId(cand.id)}
                            style={{ left: `${cand.x}%`, top: `${cand.y}%` }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 ${isSel ? "z-20 scale-125" : "z-10"}`}
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-orange-600 text-xs font-extrabold text-white shadow-md">
                              ＋
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedPin && (
                      <article className="gurupo-toast-pop rounded-2xl border-2 border-[#1C1A16] bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 text-xs font-extrabold ${
                                isSelectedCandidate
                                  ? "border-orange-600 bg-orange-600 text-white"
                                  : PIN_STYLES[selectedPin.status].badge
                              }`}
                            >
                              {isSelectedCandidate ? "飲食店候補（未登録）" : selectedPin.status}
                            </span>
                            {!isSelectedCandidate && "ownerName" in selectedPin && selectedPin.ownerName && (
                              <span className="ml-1.5 text-xs font-bold text-[#575249]">
                                登録者：{selectedPin.ownerName}
                              </span>
                            )}
                            <h3 className="mt-1.5 text-base font-extrabold">{selectedPin.name}</h3>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {!isSelectedCandidate && (
                              <button
                                type="button"
                                onClick={() => setPreviewDeletingStore({ id: selectedPin.id, name: selectedPin.name })}
                                aria-label="店舗を削除"
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedPinId(null)}
                              aria-label="閉じる"
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFEAE0]"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-1.5 text-xs font-bold text-[#474239]">{selectedPin.address}</p>
                        <p className="mt-2 rounded-xl bg-[#F7F4ED] px-3 py-2 text-xs text-[#3D3932]">{selectedPin.memo}</p>
                        {isSelectedCandidate ? (
                          <div className="mt-3 space-y-2">
                            <div className="grid grid-cols-4 gap-1.5">
                              {PREVIEW_STORE_STATUSES.map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => {
                                    setCandidateRegStatus(st);
                                    setCandApptErr("");
                                  }}
                                  className={`min-h-[32px] rounded-lg border-2 text-[11px] font-extrabold ${
                                    candidateRegStatus === st ? "border-[#1C1A16] bg-[#1C1A16] text-white" : "border-[#D5CEC0] bg-[#FBF9F4]"
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                            {candidateRegStatus === "アポ獲得" && (
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input
                                    type="date"
                                    aria-label="アポ日付"
                                    value={candApptDate}
                                    onChange={(e) => { setCandApptDate(e.target.value); setCandApptErr(""); }}
                                    className="min-h-[36px] rounded-lg border-2 border-[#1C1A16] bg-white px-2 text-xs font-bold"
                                  />
                                  <input
                                    type="time"
                                    aria-label="アポ時間"
                                    value={candApptTime}
                                    onChange={(e) => { setCandApptTime(e.target.value); setCandApptErr(""); }}
                                    className="min-h-[36px] rounded-lg border-2 border-[#1C1A16] bg-white px-2 text-xs font-bold"
                                  />
                                </div>
                                <select
                                  aria-label="取材担当"
                                  value={candInterviewer}
                                  onChange={(e) => setCandInterviewer(e.target.value)}
                                  className="min-h-[36px] w-full rounded-lg border-2 border-[#D5CEC0] bg-white px-2 text-xs font-bold"
                                >
                                  {SAMPLE_TEAM_MEMBERS_KPI.map((m) => (
                                    <option key={m.id} value={m.name}>
                                      取材担当：{m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {candidateRegStatus === "アポ獲得" && candApptDate && candApptTime && (
                              <div role="alert" className="space-y-1 rounded-xl border-2 border-amber-500 bg-amber-50 p-2.5 text-xs text-amber-950">
                                <p className="flex items-start gap-1.5 font-extrabold">
                                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                  <span>前の取材終了後の移動を考慮すると、次の取材まで30分以下です。時間に余裕を持たせることをおすすめします。</span>
                                </p>
                                <p className="pl-5 text-[11px] font-bold text-amber-900">
                                  （プレビュー：取材目安1.5〜2時間＋移動約15分で判定。警告が出ても登録は可能です）
                                </p>
                              </div>
                            )}
                            {candApptErr && <p className="text-xs font-extrabold text-red-900">{candApptErr}</p>}
                            <button
                              type="button"
                              onClick={() => {
                                if (candidateRegStatus === "アポ獲得" && (!candApptDate || !candApptTime)) {
                                  setCandApptErr("「アポ獲得」は日付と時間の入力が必須です");
                                  return;
                                }
                                registerCandidateOneClick(selectedPin, candidateRegStatus);
                              }}
                              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#D94E2B] text-xs font-extrabold text-white"
                            >
                              <UserPlus className="h-4 w-4" />
                              <span>「{candidateRegStatus}」で顧客登録</span>
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => notify(`${selectedPin.name} の経路案内を開きます`)}
                              className="min-h-[42px] rounded-xl bg-[#D94E2B] text-xs font-extrabold text-white"
                            >
                              経路を開く
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhoneModalStore(selectedPin)}
                              className="min-h-[42px] rounded-xl border-2 border-[#1C1A16] bg-white text-xs font-extrabold"
                            >
                              電話する
                            </button>
                          </div>
                        )}
                      </article>
                    )}

                    {selectedPin && (() => {
                      const previewInsight = getPreviewInsight(selectedPin);
                      const igSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
                        `${selectedPin.name} Instagram`
                      )}`;
                      return (
                        <section
                          aria-label="営業情報パネル"
                          className="gurupo-toast-pop space-y-3 rounded-2xl border-2 border-[#D5CEC0] bg-[#FBF9F4] p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="h-4 w-4 text-[#D94E2B]" />
                              <h4 className="text-sm font-extrabold">営業情報パネル（プレビュー）</h4>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setInsightLoading(true);
                                setTimeout(() => setInsightLoading(false), 380);
                              }}
                              className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-[#D5CEC0] bg-white px-2 text-[11px] font-extrabold text-[#474239]"
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>再分析</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {previewInsight.website && (
                              <a
                                href={previewInsight.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border-2 border-[#1C1A16] bg-white px-3 text-xs font-extrabold"
                              >
                                <Globe className="h-3.5 w-3.5 text-[#D94E2B]" />
                                <span>Webサイトを開く</span>
                              </a>
                            )}
                            <a
                              href={igSearchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-xs font-extrabold"
                            >
                              <Instagram className="h-3.5 w-3.5 text-[#D94E2B]" />
                              <span>Instagram候補を検索</span>
                            </a>
                          </div>

                          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-[#474239]">
                            <span className="rounded-md border border-[#EAE3D5] bg-white px-2 py-0.5">
                              {previewInsight.rating}
                            </span>
                            {previewInsight.attributes.map((attr) => (
                              <span key={attr} className="rounded-md border border-[#EAE3D5] bg-white px-2 py-0.5">
                                {attr}
                              </span>
                            ))}
                          </div>

                          {insightLoading ? (
                            <div className="flex items-center justify-center gap-2 rounded-xl border border-[#EAE3D5] bg-white py-5 text-xs font-bold text-[#575249]">
                              <Loader2 className="h-4 w-4 animate-spin text-[#D94E2B]" />
                              <span>公開情報から強みと営業メールを分析中...</span>
                            </div>
                          ) : (
                            <>
                              <div className="rounded-xl border border-[#EAE3D5] bg-white p-3">
                                <p className="text-xs font-extrabold">抽出された店舗の強み</p>
                                <ul className="mt-2 space-y-1.5">
                                  {previewInsight.strengths.map((s, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-xs text-[#3D3932]">
                                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D94E2B]" />
                                      <span>{s}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="space-y-2 rounded-xl border border-[#EAE3D5] bg-white p-3">
                                <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#D5CEC0] bg-[#EFEAE0] p-1">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewScriptTab("dm")}
                                    className={`flex min-h-[32px] items-center justify-center gap-1 rounded-lg text-[11px] font-extrabold ${
                                      previewScriptTab === "dm" ? "bg-[#D94E2B] text-white" : "text-[#474239]"
                                    }`}
                                  >
                                    <Instagram className="h-3 w-3" />
                                    <span>DM</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewScriptTab("email")}
                                    className={`flex min-h-[32px] items-center justify-center gap-1 rounded-lg text-[11px] font-extrabold ${
                                      previewScriptTab === "email" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                                    }`}
                                  >
                                    <Mail className="h-3 w-3" />
                                    <span>メール</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewScriptTab("teleapo")}
                                    className={`flex min-h-[32px] items-center justify-center gap-1 rounded-lg text-[11px] font-extrabold ${
                                      previewScriptTab === "teleapo" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                                    }`}
                                  >
                                    <PhoneCall className="h-3 w-3" />
                                    <span>テレアポ</span>
                                  </button>
                                </div>

                                {previewScriptTab === "dm" && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-extrabold">Instagram DM用スクリプト</p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (navigator.clipboard?.writeText) navigator.clipboard.writeText(previewInsight.instagramDm).catch(() => {});
                                          setInsightCopiedMode("dm");
                                          notify("Instagram DMをコピーしました");
                                          setTimeout(() => setInsightCopiedMode(null), 1800);
                                        }}
                                        className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2 text-xs font-extrabold text-white ${
                                          insightCopiedMode === "dm" ? "bg-emerald-700" : "bg-[#D94E2B]"
                                        }`}
                                      >
                                        {insightCopiedMode === "dm" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                        <span>{insightCopiedMode === "dm" ? "コピー済み" : "コピー"}</span>
                                      </button>
                                    </div>
                                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#3D3932]">
                                      {previewInsight.instagramDm}
                                    </pre>
                                  </div>
                                )}

                                {previewScriptTab === "email" && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-extrabold">メール営業用スクリプト</p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const full = `件名: ${previewInsight.emailSubject}\n\n${previewInsight.emailBody}`;
                                          if (navigator.clipboard?.writeText) navigator.clipboard.writeText(full).catch(() => {});
                                          setInsightCopiedMode("email");
                                          notify("営業メールをコピーしました");
                                          setTimeout(() => setInsightCopiedMode(null), 1800);
                                        }}
                                        className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2 text-xs font-extrabold text-white ${
                                          insightCopiedMode === "email" ? "bg-emerald-700" : "bg-[#1C1A16]"
                                        }`}
                                      >
                                        {insightCopiedMode === "email" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                        <span>{insightCopiedMode === "email" ? "コピー済み" : "コピー"}</span>
                                      </button>
                                    </div>
                                    <div className="rounded-lg bg-[#F7F4ED] px-2.5 py-1 text-xs font-extrabold">
                                      件名：{previewInsight.emailSubject}
                                    </div>
                                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#3D3932]">
                                      {previewInsight.emailBody}
                                    </pre>
                                  </div>
                                )}

                                {previewScriptTab === "teleapo" && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-extrabold">テレアポ用スクリプト</p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (navigator.clipboard?.writeText) navigator.clipboard.writeText(previewInsight.teleapoScript).catch(() => {});
                                          setInsightCopiedMode("teleapo");
                                          notify("テレアポスクリプトをコピーしました");
                                          setTimeout(() => setInsightCopiedMode(null), 1800);
                                        }}
                                        className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2 text-xs font-extrabold text-white ${
                                          insightCopiedMode === "teleapo" ? "bg-emerald-700" : "bg-[#1C1A16]"
                                        }`}
                                      >
                                        {insightCopiedMode === "teleapo" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                        <span>{insightCopiedMode === "teleapo" ? "コピー済み" : "コピー"}</span>
                                      </button>
                                    </div>
                                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#3D3932]">
                                      {previewInsight.teleapoScript}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </section>
                      );
                    })()}

                    {showPlaceCandidates && (
                      <div className="space-y-2">
                        <p className="text-xs font-extrabold">検索結果（ワンクリックで見込み登録）</p>
                        {SAMPLE_PLACE_CANDIDATES.map((cand) => {
                          const isReg = mapStores.some((m) => m.id === cand.id);
                          return (
                            <div key={cand.id} className="space-y-2 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-extrabold">{cand.name}</p>
                                  <p className="truncate text-xs text-[#575249]">{cand.address}</p>
                                </div>
                                <button
                                  type="button"
                                  disabled={isReg}
                                  onClick={() => registerCandidateOneClick(cand)}
                                  className={`flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-extrabold ${
                                    isReg ? "border-2 border-emerald-700 bg-emerald-50 text-emerald-950" : "bg-[#D94E2B] text-white"
                                  }`}
                                >
                                  {isReg ? <><Check className="h-3.5 w-3.5" /><span>登録済み</span></> : <><UserPlus className="h-3.5 w-3.5" /><span>顧客登録</span></>}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedPreviewCandIds((prev) => ({ ...prev, [cand.id]: !prev[cand.id] }))}
                                className="flex min-h-[34px] w-full items-center justify-center gap-1 rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] text-xs font-extrabold text-[#474239]"
                              >
                                <span>{expandedPreviewCandIds[cand.id] ? "営業情報を閉じる" : "営業情報・スクリプトを見る"}</span>
                                {expandedPreviewCandIds[cand.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                              {expandedPreviewCandIds[cand.id] && (() => {
                                const info = getPreviewInsight(cand);
                                return (
                                  <div className="space-y-2 rounded-xl border border-[#EAE3D5] bg-[#FBF9F4] p-3 text-xs">
                                    <div className="flex flex-wrap gap-1.5">
                                      {info.website && (
                                        <a href={info.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#1C1A16] bg-white px-2.5 py-1 font-extrabold">
                                          <Globe className="h-3 w-3 text-[#D94E2B]" /><span>Webサイト</span>
                                        </a>
                                      )}
                                      <a href={`https://www.google.com/search?q=${encodeURIComponent(cand.name + " Instagram")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#D5CEC0] bg-white px-2.5 py-1 font-extrabold">
                                        <Instagram className="h-3 w-3 text-[#D94E2B]" /><span>Instagram</span>
                                      </a>
                                    </div>
                                    <ul className="space-y-1 text-[#3D3932]">
                                      {info.strengths.map((s, i) => <li key={i}>・{s}</li>)}
                                    </ul>
                                    <p className="rounded-lg bg-white p-2 font-medium text-[#3D3932]">{info.instagramDm}</p>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredPins.map((st) => (
                      <div key={st.id} className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-extrabold ${PIN_STYLES[st.status].badge}`}>
                            {st.status}
                          </span>
                          {st.ownerName && (
                            <span className="text-xs font-bold text-[#575249]">登録者：{st.ownerName}</span>
                          )}
                        </div>
                        <h3 className="mt-1.5 text-base font-extrabold">{st.name}</h3>
                        <p className="mt-1 text-xs text-[#575249]">{st.address}</p>
                        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPinId(st.id);
                              setPreviewZoomedPinId(st.id);
                              setStoreViewMode("map");
                              notify(`${st.name} に地図を移動しました`);
                            }}
                            className="flex min-h-[38px] items-center justify-center gap-1 rounded-xl border-2 border-[#D5CEC0] bg-white text-xs font-extrabold"
                          >
                            <MapPin className="h-3.5 w-3.5 text-[#D94E2B]" />
                            <span>地図</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedListStoreId((prev) => (prev === st.id ? null : st.id))}
                            className="flex min-h-[38px] items-center justify-center gap-1 rounded-xl border-2 border-[#D5CEC0] bg-[#FBF9F4] text-xs font-extrabold"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-[#D94E2B]" />
                            <span>営業情報</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewDeletingStore({ id: st.id, name: st.name })}
                            className="flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 text-xs font-extrabold text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>削除</span>
                          </button>
                        </div>
                        {selectedListStoreId === st.id && (
                          <div className="mt-3 rounded-xl border border-[#EAE3D5] bg-[#FBF9F4] p-3 text-xs space-y-2">
                            <p className="font-extrabold text-[#1C1A16]">抽出された強み（サンプル）</p>
                            <ul className="space-y-1">
                              {getPreviewInsight(st).strengths.map((s, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 text-[#3D3932]">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D94E2B]" />
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === "visit" && (() => {
            const effCalScope = isLeader ? previewCalScope : "mine";
            const calEvents = SAMPLE_SCHEDULES.filter(
              (ev) => effCalScope === "team" || ev.ownerRole === "member"
            );
            return (
              <div className="gurupo-screen-enter space-y-4">
                <h1 className="text-xl font-extrabold">予定</h1>

                <div className="rounded-2xl border-2 border-[#D94E2B] bg-[#FFF5F2] p-3.5 text-xs">
                  <p className="flex items-center gap-1.5 font-extrabold text-[#9A3412]">
                    <Bell className="h-4 w-4 text-[#D94E2B]" />
                    <span>明日の予定リマインド（1件）</span>
                  </p>
                  <p className="mt-1 font-bold text-[#1C1A16]">
                    ・13:30 サンプル食堂B（担当：佐藤 健太）
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-[#D5CEC0] bg-[#EFEAE0] p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewCalScope("mine")}
                    className={`min-h-[36px] rounded-xl text-xs font-extrabold ${
                      effCalScope === "mine" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                    }`}
                  >
                    自分の予定
                  </button>
                  <button
                    type="button"
                    disabled={!isLeader}
                    onClick={() => isLeader && setPreviewCalScope("team")}
                    className={`flex min-h-[36px] items-center justify-center gap-1 rounded-xl text-xs font-extrabold ${
                      !isLeader
                        ? "cursor-not-allowed text-[#8A8377] opacity-60"
                        : effCalScope === "team"
                        ? "bg-[#1C1A16] text-white"
                        : "text-[#474239]"
                    }`}
                  >
                    {!isLeader && <Lock className="h-3.5 w-3.5" />}
                    <span>チーム予定</span>
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-2xl border-2 border-[#D5CEC0] bg-white px-3.5 py-2.5">
                  <div>
                    <p className="text-xs font-extrabold">Googleカレンダー連携</p>
                    <p className="text-[10px] font-bold text-[#575249]">
                      {previewGcalOn ? "オン（同期可能）" : "オフ"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewGcalOn((v) => !v);
                      notify(!previewGcalOn ? "Googleカレンダー連携をオンにしました" : "オフにしました");
                    }}
                    className={`min-h-[30px] rounded-full px-3 text-[11px] font-extrabold ${
                      previewGcalOn ? "bg-emerald-700 text-white" : "bg-[#EFEAE0] text-[#474239]"
                    }`}
                  >
                    {previewGcalOn ? "ON" : "OFF"}
                  </button>
                </div>

                <div className="space-y-2.5 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold">2026年11月</p>
                    <div className="inline-flex rounded-xl border border-[#D5CEC0] bg-[#EFEAE0] p-0.5 text-[11px] font-extrabold">
                      <button
                        type="button"
                        onClick={() => setPreviewCalView("week")}
                        className={`rounded-lg px-2.5 py-1 ${previewCalView === "week" ? "bg-[#1C1A16] text-white" : ""}`}
                      >
                        週
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewCalView("month")}
                        className={`rounded-lg px-2.5 py-1 ${previewCalView === "month" ? "bg-[#1C1A16] text-white" : ""}`}
                      >
                        月
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-[#575249]">
                    {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
                      <div key={w}>{w}</div>
                    ))}
                    {(previewCalView === "week" ? [23, 24, 25, 26, 27, 28, 29] : Array.from({ length: 28 }, (_, i) => i + 1)).map((d) => (
                      <div
                        key={d}
                        className={`rounded-lg border py-2 text-xs font-extrabold ${
                          d === 26 ? "border-[#1C1A16] bg-[#1C1A16] text-white" : "border-[#EAE3D5] bg-[#FBF9F4]"
                        }`}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-extrabold text-[#575249]">今日の予定（店舗アポ連動）</p>
                  {calEvents.map((ev) => (
                    <div key={ev.id} className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-[#1C1A16] px-2 py-0.5 text-xs font-extrabold text-white">{ev.time}</span>
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-950">店舗アポ連動</span>
                      </div>
                      <p className="mt-1.5 text-sm font-extrabold">{ev.storeName}</p>
                      <p className="text-xs font-bold text-[#575249]">取材担当：{ev.ownerName}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {activeTab === "recording" && (() => {
            const selectedRec = previewRecordings.find((r) => r.id === selectedRecId) || null;
            const fmtSec = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
            const todayApptOptions = [
              { id: "ap-1", time: "13:30", name: "サンプル食堂B", address: "大阪府大阪市北区2-8-10" },
              { id: "ap-2", time: "16:30", name: "サンプル居酒屋D", address: "大阪府大阪市中央区1-9-4" },
            ];
            const nextAppt = todayApptOptions[0];

            if (selectedRec) {
              const doneCount = selectedRec.tasks.filter((t) => t.done).length;
              return (
                <div className="gurupo-screen-enter space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecId(null);
                      setIsAudioPlaying(false);
                    }}
                    className="flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-xs font-extrabold text-[#1C1A16]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>録音一覧へ</span>
                  </button>

                  <section className="rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-extrabold">{selectedRec.title}</h2>
                      {selectedRec.status === "processing" ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>処理中</span>
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-900">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>解析完了</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-bold text-[#575249]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {selectedRec.recordedAt}（{fmtSec(selectedRec.durationSec)}）
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {selectedRec.ownerName}
                      </span>
                      {selectedRec.storeName && (
                        <span className="flex items-center gap-1 text-[#B93818]">
                          <Store className="h-3.5 w-3.5" />
                          {selectedRec.storeName}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setIsAudioPlaying((v) => !v)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C1A16] text-white"
                        >
                          {isAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <div className="flex-1">
                          <p className="flex items-center gap-1 text-[11px] font-extrabold text-[#1C1A16]">
                            <Volume2 className="h-3.5 w-3.5 text-[#D94E2B]" />
                            <span>{isAudioPlaying ? "再生中（プレビュー）" : "音声再生（プレビュー）"}</span>
                          </p>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#E5DFD3]">
                            <div className={`h-full rounded-full bg-[#D94E2B] transition-all ${isAudioPlaying ? "w-2/3" : "w-1/4"}`} />
                          </div>
                        </div>
                        <span className="text-[11px] font-extrabold tabular-nums text-[#575249]">
                          {fmtSec(selectedRec.durationSec)}
                        </span>
                      </div>
                    </div>
                  </section>

                  {selectedRec.status === "processing" ? (
                    <div className="flex items-start gap-2.5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-950">
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-700" />
                      <div>
                        <p className="font-extrabold">サーバー（Cloud Functions）で解析中です</p>
                        <p className="mt-0.5 text-[11px] text-amber-900">このまま他画面へ移動しても処理は継続され、完了すると自動反映されます。</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <section className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
                        <h3 className="flex items-center gap-1.5 text-sm font-extrabold">
                          <Sparkles className="h-4 w-4 text-[#D94E2B]" />
                          <span>要点サマリー（{selectedRec.summaryPoints.length}件）</span>
                        </h3>
                        <ul className="mt-2.5 space-y-2">
                          {selectedRec.summaryPoints.map((pt, i) => (
                            <li key={i} className="flex items-start gap-2 rounded-xl bg-[#FBF9F4] px-3 py-2 text-xs font-bold leading-relaxed">
                              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1C1A16] text-[10px] font-extrabold text-white">
                                {i + 1}
                              </span>
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="flex items-center gap-1.5 text-sm font-extrabold">
                            <ListChecks className="h-4 w-4 text-[#2563EB]" />
                            <span>抽出タスク（やるべきこと）</span>
                          </h3>
                          <span className="rounded-full bg-[#EFEAE0] px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-[#474239]">
                            {doneCount} / {selectedRec.tasks.length} 完了
                          </span>
                        </div>
                        <div className="mt-2.5 space-y-2">
                          {selectedRec.tasks.map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => {
                                setPreviewRecordings((prev) =>
                                  prev.map((r) =>
                                    r.id === selectedRec.id
                                      ? {
                                          ...r,
                                          tasks: r.tasks.map((t) =>
                                            t.id === task.id ? { ...t, done: !t.done } : t
                                          ),
                                        }
                                      : r
                                  )
                                );
                              }}
                              className={`flex min-h-[42px] w-full items-start gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-xs font-bold ${
                                task.done
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-950 line-through opacity-75"
                                  : "border-[#D5CEC0] bg-[#FBF9F4] text-[#1C1A16]"
                              }`}
                            >
                              <CheckSquare className={`mt-0.5 h-4 w-4 shrink-0 ${task.done ? "text-emerald-600" : "text-[#8A8377]"}`} />
                              <span>{task.text}</span>
                            </button>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-2.5 rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
                        <h3 className="text-sm font-extrabold">AI営業フィードバック</h3>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                          <p className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span>良かった点</span>
                          </p>
                          <ul className="mt-1 space-y-1 text-xs font-bold text-emerald-950">
                            {selectedRec.feedback.goodPoints.map((g, i) => (
                              <li key={i}>・{g}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                          <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                            <Lightbulb className="h-3.5 w-3.5" />
                            <span>改善のポイント</span>
                          </p>
                          <ul className="mt-1 space-y-1 text-xs font-bold text-amber-950">
                            {selectedRec.feedback.improvements.map((imp, i) => (
                              <li key={i}>・{imp}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-[#D94E2B]/30 bg-[#FFF5F2] p-3">
                          <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#9A3412]">
                            <ArrowRight className="h-3.5 w-3.5" />
                            <span>次回への提案</span>
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#1C1A16]">{selectedRec.feedback.nextAdvice}</p>
                        </div>
                      </section>
                    </>
                  )}
                </div>
              );
            }

            return (
              <div className="gurupo-screen-enter space-y-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-extrabold">取材</h1>
                  <span className="rounded-full bg-[#EFEAE0] px-2.5 py-1 text-[11px] font-extrabold text-[#474239]">
                    {previewRecordings.length}件
                  </span>
                </div>

                <section className="rounded-2xl border-2 border-[#D94E2B] bg-[#FFF5F2] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#9A3412]">
                      <CalendarClock className="h-4 w-4 text-[#D94E2B]" />
                      <span>次のアポ（最優先）</span>
                    </span>
                    <span className="rounded-lg bg-[#D94E2B] px-2 py-0.5 text-xs font-extrabold tabular-nums text-white">
                      {nextAppt.time}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-extrabold text-[#1C1A16]">{nextAppt.name}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-[#575249]">{nextAppt.address}</p>
                </section>

                <section className="space-y-3 rounded-2xl border-2 border-[#1C1A16] bg-white p-4">
                  <div>
                    <p className="text-xs font-extrabold text-[#474239]">紐づける店舗（本日のアポ）</p>
                    <select
                      value={selectedRecStore}
                      onChange={(e) => setSelectedRecStore(e.target.value)}
                      disabled={isPreviewRecording}
                      className="mt-1 min-h-[42px] w-full rounded-xl border-2 border-[#D5CEC0] bg-[#FBF9F4] px-3 text-sm font-bold"
                    >
                      <option value="">店舗を選択しない</option>
                      {todayApptOptions.map((ap) => (
                        <option key={ap.id} value={ap.name}>
                          {ap.time} {ap.name}{ap.name === nextAppt.name ? "（次のアポ）" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-[#474239]">タイトル（任意・未入力時は店舗名から自動設定）</p>
                    <input
                      type="text"
                      value={recTitleInput}
                      onChange={(e) => setRecTitleInput(e.target.value)}
                      disabled={isPreviewRecording}
                      placeholder={selectedRecStore ? `例：${selectedRecStore} 初回取材` : "例：サンプル居酒屋C 初回取材"}
                      className="mt-1 min-h-[42px] w-full rounded-xl border-2 border-[#D5CEC0] bg-[#FBF9F4] px-3 text-sm font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border-2 border-[#D5CEC0] bg-[#FBF9F4] px-4 py-3">
                    <div>
                      <p className="text-xs font-bold text-[#575249]">
                        {isPreviewRecording ? "録音中（プレビュー）" : "ボタンを押して録音を開始"}
                      </p>
                      <p className="mt-0.5 text-2xl font-extrabold tabular-nums">{fmtSec(previewRecSec)}</p>
                    </div>
                    {!isPreviewRecording ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewRecSec(0);
                          setIsPreviewRecording(true);
                        }}
                        className="flex min-h-[46px] items-center gap-2 rounded-2xl bg-[#D94E2B] px-4 text-sm font-extrabold text-white"
                      >
                        <Mic className="h-4 w-4" />
                        <span>録音開始</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPreviewRecording(false);
                          const newId = "rec-" + Date.now();
                          const storeLabel = selectedRecStore;
                          const newRec = {
                            id: newId,
                            title: recTitleInput.trim() || (storeLabel ? `${storeLabel} 取材` : "新規取材録音（プレビュー）"),
                            storeName: storeLabel,
                            ownerName: "佐藤 健太",
                            recordedAt: "たった今",
                            durationSec: Math.max(3, previewRecSec),
                            status: "processing",
                            summaryPoints: []: string[],
                            tasks: []: { id: string; text: string; done: boolean }[],
                            feedback: {
                              goodPoints: ["相手の課題に合わせて事例を分かりやすく説明できていました。"],
                              improvements: ["導入後の運用イメージを具体例で添えるとさらに説得力が増します。"],
                              nextAdvice: "次回は撮影日の候補を2つ用意して提案しましょう。",
                            },
                          };
                          setPreviewRecordings((prev) => [newRec, ...prev]);
                          setRecTitleInput("");
                          setPreviewRecSec(0);
                          notify("アップロード完了！裏側でAI解析中です（他の操作ができます）");
                          setTimeout(() => {
                            setPreviewRecordings((prev) =>
                              prev.map((r) =>
                                r.id === newId
                                  ? {
                                      ...r,
                                      status: "completed",
                                      summaryPoints: [
                                        "お店の看板メニューとターゲット客層についてヒアリングを実施",
                                        "写真撮影サポートと掲載手順について前向きな反応を得た",
                                        "来週中に導入可否の最終確認を行う流れとなった",
                                      ],
                                      tasks: [
                                        { id: "nt-1", text: "導入事例と料金プランをメール送付する", done: false },
                                        { id: "nt-2", text: "来週水曜にフォロー架電する", done: false },
                                      ],
                                    }
                                  : r
                              )
                            );
                            notify("AI解析が完了し、一覧へ自動反映されました");
                          }, 2500);
                        }}
                        className="flex min-h-[46px] items-center gap-2 rounded-2xl bg-[#1C1A16] px-4 text-sm font-extrabold text-white"
                      >
                        <Square className="h-4 w-4 fill-current text-red-400" />
                        <span>停止して保存</span>
                      </button>
                    )}
                  </div>
                </section>

                <div className="space-y-2.5">
                  <p className="text-sm font-extrabold">録音一覧（リアルタイム更新）</p>
                  {previewRecordings.map((rec) => {
                    const doneCount = rec.tasks.filter((t) => t.done).length;
                    return (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => setSelectedRecId(rec.id)}
                        className="w-full rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-extrabold">{rec.title}</p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {rec.status === "processing" && (
                              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>処理中</span>
                              </span>
                            )}
                            <span className="rounded-lg bg-[#EFEAE0] px-2 py-0.5 text-[11px] font-extrabold tabular-nums">
                              {fmtSec(rec.durationSec)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#575249]">
                          <span>{rec.recordedAt}</span>
                          <span>・担当：{rec.ownerName}</span>
                          {rec.storeName && (
                            <span className="rounded bg-[#FFF5F2] px-1.5 py-0.5 text-[10px] font-extrabold text-[#B93818]">
                              {rec.storeName}
                            </span>
                          )}
                          {rec.tasks.length > 0 && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-950">
                              タスク {doneCount}/{rec.tasks.length}
                            </span>
                          )}
                        </div>
                        {rec.status === "processing" ? (
                          <p className="mt-2 text-xs font-bold text-amber-800">サーバーで要約・タスク・フィードバックを生成中です...</p>
                        ) : (
                          rec.summaryPoints[0] && (
                            <p className="mt-2 line-clamp-2 text-xs text-[#474239]">{rec.summaryPoints[0]}</p>
                          )
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {(activeTab === "training" || activeTab === "menu") && (
            <section className="gurupo-screen-enter rounded-2xl border-2 border-[#D5CEC0] bg-white p-5">
              <p className="text-xs font-extrabold text-[#B93818]">準備中（プレビュー範囲外）</p>
              <h2 className="mt-1 text-lg font-extrabold">
                {activeTab === "training" ? "研修ライブラリ" : "メニュー"}
              </h2>
              <p className="mt-2 text-xs font-medium text-[#575249]">
                現在このプレビューでは「ホーム」「店舗」「予定」「取材」を確認できます。
              </p>
            </section>
          )}
        </main>

        <nav
          aria-label="下部ナビゲーション"
          className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t-2 border-[#D5CEC0] bg-[#FBF9F4]/98 px-2 pb-2 pt-1.5 backdrop-blur"
        >
          <div className="grid grid-cols-6 gap-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl transition-transform duration-100 active:scale-[0.97] ${
                    active ? "bg-[#D94E2B]/12 text-[#B93818]" : "text-[#474239] hover:bg-[#EFEAE0]"
                  }`}
                >
                  {active && <span aria-hidden="true" className="absolute inset-x-2.5 top-0 h-[3px] rounded-full bg-[#D94E2B]" />}
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.9} />
                  <span className={`text-[10px] leading-none ${active ? "font-extrabold" : "font-bold"}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {showAnnouncementList && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
            <div className="gurupo-toast-pop max-h-[82vh] w-full max-w-md space-y-3 overflow-y-auto rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold">お知らせ一覧</h3>
                <button type="button" onClick={() => setShowAnnouncementList(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFEAE0]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {announcements.map((a) => (
                <article key={a.id} className={`rounded-2xl border-2 p-3.5 ${a.read ? "border-[#D5CEC0] bg-white" : "border-[#D94E2B] bg-[#FFF8F6]"}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#575249]">{a.date}</span>
                    <span className="font-extrabold">{a.read ? "既読" : "未読"}</span>
                  </div>
                  <h4 className="mt-1 text-sm font-extrabold">{a.title}</h4>
                  <p className="mt-1 text-xs text-[#474239]">{a.body}</p>
                  {!a.read && (
                    <button
                      type="button"
                      onClick={() => setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? { ...x, read: true } : x)))}
                      className="mt-2.5 min-h-[38px] w-full rounded-xl bg-[#1C1A16] text-xs font-extrabold text-white"
                    >
                      既読にする
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {previewDeletingStore && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="gurupo-toast-pop w-full max-w-sm space-y-4 rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-xl">
              <h3 className="text-base font-extrabold">店舗を削除しますか？</h3>
              <p className="text-xs text-[#474239]">
                「<span className="font-extrabold text-[#1C1A16]">{previewDeletingStore.name}</span>」を削除します。この操作は取り消せません。
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewDeletingStore(null)}
                  className="min-h-[42px] rounded-xl border-2 border-[#D5CEC0] bg-white text-xs font-extrabold"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = previewDeletingStore;
                    setMapStores((prev) => prev.filter((m) => m.id !== target.id));
                    if (selectedPinId === target.id) setSelectedPinId(null);
                    setPreviewDeletingStore(null);
                    notify(`「${target.name}」を削除しました`);
                  }}
                  className="min-h-[42px] rounded-xl bg-red-700 text-xs font-extrabold text-white"
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}

        {phoneModalStore && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="gurupo-toast-pop w-full max-w-sm space-y-4 rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold">{phoneModalStore.name}</h3>
                <button type="button" onClick={() => setPhoneModalStore(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFEAE0]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="rounded-xl border border-[#D5CEC0] bg-white p-3 text-center text-lg font-extrabold tabular-nums">
                {phoneModalStore.phone}
              </p>
              <button type="button" onClick={() => setPhoneModalStore(null)} className="min-h-[44px] w-full rounded-xl bg-[#1C1A16] text-xs font-extrabold text-white">
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

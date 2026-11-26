import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Globe,
  Instagram,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
  Star,
} from "lucide-react";
import { fetchPlaceSalesDetails } from "../services/placesService";
import {
  buildInstagramSearchUrl,
  generateSalesInsight,
  type PlaceSalesDetails,
  type SalesInsightResult,
} from "../services/geminiSalesService";

export interface SalesInsightTarget {
  id: string;
  name: string;
  address: string;
  placeId?: string;
}

const insightCache = new Map<
  string,
  { details: PlaceSalesDetails; insight: SalesInsightResult | null; error?: string }
>();

export function SalesInsightPanel({
  target,
  mapsApiKey,
  geminiApiKey,
  salesRepName,
}: {
  target: SalesInsightTarget;
  mapsApiKey: string;
  geminiApiKey: string;
  salesRepName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<PlaceSalesDetails | null>(null);
  const [insight, setInsight] = useState<SalesInsightResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const cacheKey = `${target.placeId || target.id}:${target.name}`;
  const instagramUrl = buildInstagramSearchUrl(target.name, target.address);

  useEffect(() => {
    let cancelled = false;
    const cached = reloadNonce === 0 ? insightCache.get(cacheKey) : undefined;
    if (cached) {
      setDetails(cached.details);
      setInsight(cached.insight);
      setError(cached.error ?? "");
      setLoading(false);
      return;
    }

    async function run() {
      setLoading(true);
      setError("");
      setInsight(null);
      try {
        const fetchedDetails = await fetchPlaceSalesDetails({
          name: target.name,
          address: target.address,
          placeId: target.placeId,
          apiKey: mapsApiKey,
        });
        if (cancelled) return;
        setDetails(fetchedDetails);

        try {
          const generated = await generateSalesInsight({
            details: fetchedDetails,
            salesRepName,
            geminiApiKey,
          });
          if (cancelled) return;
          setInsight(generated);
          insightCache.set(cacheKey, { details: fetchedDetails, insight: generated });
        } catch (geminiErr) {
          if (cancelled) return;
          const msg =
            geminiErr instanceof Error
              ? geminiErr.message
              : "強み・メール生成に失敗しました。";
          setError(msg);
          insightCache.set(cacheKey, {
            details: fetchedDetails,
            insight: null,
            error: msg,
          });
        }
      } catch (placeErr) {
        if (cancelled) return;
        setDetails({
          placeId: target.placeId,
          name: target.name,
          address: target.address,
          types: [],
          weekdayText: [],
          reviews: [],
          attributes: [],
          photoCount: 0,
        });
        setError(
          placeErr instanceof Error
            ? placeErr.message
            : "店舗の詳細情報取得に失敗しました。"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, target.name, target.address, target.placeId, mapsApiKey, geminiApiKey, salesRepName, reloadNonce]);

  const handleCopyEmail = async () => {
    if (!insight) return;
    const fullText = `件名: ${insight.emailSubject}\n\n${insight.emailBody}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = fullText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section
      aria-label="営業情報パネル"
      className="gurupo-toast-pop space-y-3 rounded-2xl border-2 border-[#D5CEC0] bg-[#FBF9F4] p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[#D94E2B]" />
          <h4 className="text-sm font-extrabold text-[#1C1A16]">営業情報パネル</h4>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => setReloadNonce((n) => n + 1)}
          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#D5CEC0] bg-white px-2.5 text-[11px] font-extrabold text-[#474239] active:scale-[0.97] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          <span>再分析</span>
        </button>
      </div>

      {/* 外部公開情報リンク */}
      <div className="flex flex-wrap gap-2">
        {details?.website && (
          <a
            href={details.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border-2 border-[#1C1A16] bg-white px-3 text-xs font-extrabold text-[#1C1A16] active:scale-[0.97]"
          >
            <Globe className="h-3.5 w-3.5 text-[#D94E2B]" />
            <span>Webサイトを開く</span>
          </a>
        )}
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-xs font-extrabold text-[#1C1A16] active:scale-[0.97]"
        >
          <Instagram className="h-3.5 w-3.5 text-[#D94E2B]" />
          <span>Instagram候補を検索</span>
        </a>
      </div>

      {/* 取得できた評価・属性サマリー */}
      {details && (details.rating || details.attributes.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[#474239]">
          {details.rating && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 border border-[#EAE3D5]">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span>
                {details.rating}（{details.userRatingsTotal ?? 0}件）
              </span>
            </span>
          )}
          {details.attributes.slice(0, 4).map((attr) => (
            <span
              key={attr}
              className="rounded-md border border-[#EAE3D5] bg-white px-2 py-0.5"
            >
              {attr}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[#EAE3D5] bg-white py-5 text-xs font-bold text-[#575249]">
          <Loader2 className="h-4 w-4 animate-spin text-[#D94E2B]" />
          <span>公開情報から強みと営業メールを分析中...</span>
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {insight && (
            <div className="space-y-3">
              {/* 強み一覧 */}
              <div className="rounded-xl border border-[#EAE3D5] bg-white p-3">
                <p className="text-xs font-extrabold text-[#1C1A16]">
                  抽出された店舗の強み（営業切り口）
                </p>
                <ul className="mt-2 space-y-1.5">
                  {insight.strengths.map((s, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs font-medium leading-relaxed text-[#3D3932]"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D94E2B]" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* メール営業テンプレート */}
              <div className="space-y-2 rounded-xl border border-[#EAE3D5] bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-[#1C1A16]">
                    メール営業テンプレート
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCopyEmail()}
                    className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-xs font-extrabold transition-transform duration-100 active:scale-[0.97] ${
                      copied
                        ? "bg-emerald-700 text-white"
                        : "bg-[#1C1A16] text-white"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>コピー済み</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>件名＋本文をコピー</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="rounded-lg bg-[#F7F4ED] px-2.5 py-1.5 text-xs font-extrabold text-[#1C1A16]">
                  件名：{insight.emailSubject}
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs font-medium leading-relaxed text-[#3D3932]">
                  {insight.emailBody}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export interface PlaceSalesDetails {
  placeId?: string;
  name: string;
  address: string;
  website?: string;
  phone?: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types: string[];
  weekdayText: string[];
  reviews: { authorName: string; rating: number; text: string }[];
  attributes: string[];
  photoCount: number;
  editorialSummary?: string;
}

export interface SalesInsightResult {
  strengths: string[];
  emailSubject: string;
  emailBody: string;
}

function priceLevelLabel(level?: number): string {
  switch (level) {
    case 0:
      return "無料〜非常に手頃";
    case 1:
      return "リーズナブル（¥）";
    case 2:
      return "標準価格帯（¥¥）";
    case 3:
      return "やや高価格帯（¥¥¥）";
    case 4:
      return "高級・ハイエンド（¥¥¥¥）";
    default:
      return "不明";
  }
}

export function buildInstagramSearchUrl(storeName: string, address: string): string {
  const areaMatch = address.match(
    /(?:東京都|北海道|(?:京都|大阪)府|.{2,3}県)?([^\s\d丁目番地号]+?[市区町村郡])/
  );
  const area = areaMatch?.[1] ?? address.split(/[\s,、]/)[0] ?? "";
  const query = [storeName.trim(), area.trim(), "Instagram"].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export async function generateSalesInsight(params: {
  details: PlaceSalesDetails;
  salesRepName: string;
  geminiApiKey: string;
}): Promise<SalesInsightResult> {
  const { details, salesRepName, geminiApiKey } = params;
  const key = geminiApiKey.trim();
  if (!key) {
    throw new Error(
      "Gemini APIキー（VITE_GEMINI_API_KEY）が未設定です。Vercelの環境変数に設定してください。"
    );
  }

  const reviewText =
    details.reviews.length > 0
      ? details.reviews
          .slice(0, 5)
          .map((r, i) => `口コミ${i + 1}(★${r.rating}): ${r.text.slice(0, 260)}`)
          .join("\n")
      : "口コミ本文なし";

  const prompt = `あなたは飲食店向けグルメSNSサービス「ぐるポ」の優秀な法人営業アシスタントです。
以下の公開情報（Googleビジネスプロフィール情報・Webサイト有無・営業時間・属性・写真点数・口コミなど）を総合的に分析し、
この店舗ならではの「営業視点の強み」を3〜5個抽出し、その強みを自然に盛り込んだ丁寧な営業メールテンプレートを作成してください。

【店舗情報】
- 店名: ${details.name}
- 住所: ${details.address || "不明"}
- Webサイト: ${details.website || "なし"}
- 評価: ${details.rating ? `★${details.rating}（${details.userRatingsTotal ?? 0}件）` : "不明"}
- 価格帯: ${priceLevelLabel(details.priceLevel)}
- カテゴリ/業態タグ: ${details.types.length > 0 ? details.types.join(", ") : "飲食店"}
- 属性・特徴: ${details.attributes.length > 0 ? details.attributes.join("、") : "特記なし"}
- 営業時間: ${details.weekdayText.length > 0 ? details.weekdayText.join(" / ") : "不明"}
- 掲載写真数: ${details.photoCount}件
- 店舗概要: ${details.editorialSummary || "なし"}
- 口コミ抜粋:
${reviewText}

【営業担当者名】
${salesRepName || "ぐるポ営業担当"}

【ルール】
1. 強みは口コミだけでなく、Webサイト・営業時間・価格帯・属性・写真点数（ビジュアル訴求力）なども踏まえて3〜5個にまとめる。
   例：「個室や予約対応があり接待・会食利用に向いている」「ランチからディナーまで営業しており集客導線が広い」「写真点数が多くSNSとの相性が良い」など。
2. 営業メールは押しつけがましくなく、相手店舗の強みへの敬意が伝わる丁寧な日本語にする。
3. 件名は具体的で開封されやすいものにする。
4. 本文の署名は営業担当者名を使う（プレースホルダーのままにしない）。

必ず以下のJSON形式のみで出力してください:
{
  "strengths": ["強み1", "強み2", "強み3"],
  "emailSubject": "件名",
  "emailBody": "本文"
}`;

  type GeminiResp = {
    error?: { code?: number; status?: string; message?: string };
    candidates?: {
      content?: { parts?: { text?: string }[] };
    }[];
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function isTransientError(status: number, message?: string): boolean {
    if (status === 429 || status === 503 || status === 500) return true;
    const m = (message || "").toLowerCase();
    return (
      m.includes("high demand") ||
      m.includes("overloaded") ||
      m.includes("temporarily") ||
      m.includes("try again") ||
      m.includes("rate limit")
    );
  }

  async function callGenerateContent(
    modelName: string
  ): Promise<{ ok: boolean; status: number; data: GeminiResp }> {
    const cleanModel = modelName.replace(/^models\//, "");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        cleanModel
      )}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        }),
      }
    );
    const data = (await res.json()) as GeminiResp;
    return { ok: res.ok, status: res.status, data };
  }

  function rankFallbackModel(name: string): number {
    const n = name.toLowerCase();
    if (n.includes("gemini-3") && n.includes("flash")) return 1;
    if (n.includes("flash-latest") || n.includes("flash-lite")) return 2;
    if (n.includes("gemini-3") && n.includes("pro")) return 3;
    if (n.includes("pro-latest")) return 4;
    if (n.includes("gemini-2.5") || n.includes("gemini-2.0")) return 8;
    if (n.includes("flash")) return 5;
    return 9;
  }

  let json: GeminiResp = {};
  let succeeded = false;
  let sawTransient = false;
  const errors: string[] = [];

  // 1. gemini-3.8-flash をバックオフ付きで最大3回試す（初回 + 1秒後 + 2秒後）
  const retryDelays = [0, 1000, 2000];
  for (const delay of retryDelays) {
    if (delay > 0) await sleep(delay);
    const attempt = await callGenerateContent("gemini-3.8-flash");
    if (attempt.ok) {
      json = attempt.data;
      succeeded = true;
      break;
    }
    const msg = attempt.data.error?.message || "失敗";
    if (isTransientError(attempt.status, msg)) {
      sawTransient = true;
      errors.push(`gemini-3.8-flash: ${msg}`);
      continue;
    }
    errors.push(`gemini-3.8-flash: ${msg}`);
    break;
  }

  // 2. まだ失敗していれば、利用可能モデル一覧から新しい世代のFlash/Lite/Proを優先順に試す
  if (!succeeded) {
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
      );
      if (listRes.ok) {
        const listJson = (await listRes.json()) as {
          models?: { name?: string; supportedGenerationMethods?: string[] }[];
        };
        const candidates = (listJson.models ?? [])
          .filter(
            (m) =>
              m.name &&
              m.supportedGenerationMethods?.includes("generateContent") &&
              !/gemini-3\.8-flash$/i.test(m.name) &&
              !/(embedding|imagen|veo|tts|aqa)/i.test(m.name)
          )
          .map((m) => m.name as string)
          .sort((a, b) => rankFallbackModel(a) - rankFallbackModel(b));

        for (const candidateModel of candidates.slice(0, 6)) {
          const retry = await callGenerateContent(candidateModel);
          if (retry.ok) {
            json = retry.data;
            succeeded = true;
            break;
          }
          const msg = retry.data.error?.message || "失敗";
          if (isTransientError(retry.status, msg)) {
            sawTransient = true;
          }
          errors.push(`${candidateModel}: ${msg}`);
        }
      }
    } catch {
      // モデル一覧取得失敗時はそのままエラー処理へ
    }
  }

  if (!succeeded) {
    if (sawTransient) {
      throw new Error(
        "AIサーバーが一時的に混雑しています。10秒ほど待ってから「再分析」を押してください。"
      );
    }
    throw new Error(errors[0] || "Gemini API での分析に失敗しました。");
  }

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: Partial<SalesInsightResult>;
  try {
    parsed = JSON.parse(cleaned) as Partial<SalesInsightResult>;
  } catch {
    throw new Error("分析結果の解析に失敗しました。もう一度お試しください。");
  }

  const strengths = Array.isArray(parsed.strengths)
    ? parsed.strengths.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
    : [];

  if (strengths.length === 0 || !parsed.emailSubject || !parsed.emailBody) {
    throw new Error("十分な分析結果を取得できませんでした。再分析をお試しください。");
  }

  return {
    strengths,
    emailSubject: String(parsed.emailSubject).trim(),
    emailBody: String(parsed.emailBody).trim(),
  };
}

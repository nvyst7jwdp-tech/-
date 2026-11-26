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
  instagramDm: string;
  emailSubject: string;
  emailBody: string;
  teleapoScript: string;
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
          .map((r, i) => `口コミ${i + 1}(★${r.rating}): ${r.text.slice(0, 240)}`)
          .join("\n")
      : "口コミ本文なし";

  const prompt = `あなたは飲食店向けグルメSNSサービス「ぐるポ」の営業アシスタントです。
以下の公開情報から店舗の強みを3〜5個抽出し、現場でそのまま使える「短い・要点だけの自然な営業スクリプト」3種類（Instagram DM用・メール用・テレアポ用）を作成してください。

【店舗情報】
- 店名: ${details.name}
- 住所: ${details.address || "不明"}
- Webサイト: ${details.website || "なし"}
- 評価: ${details.rating ? `★${details.rating}（${details.userRatingsTotal ?? 0}件）` : "不明"}
- 価格帯: ${priceLevelLabel(details.priceLevel)}
- 属性・特徴: ${details.attributes.length > 0 ? details.attributes.join("、") : "特記なし"}
- 営業時間: ${details.weekdayText.length > 0 ? details.weekdayText.join(" / ") : "不明"}
- 掲載写真数: ${details.photoCount}件
- 口コミ抜粋:
${reviewText}

【営業担当者名】
${salesRepName || "ぐるポ営業担当"}

【ルール（すべて短く簡潔に）】
1. strengths（3〜5個）：口コミだけでなくWebサイト・営業時間・属性・写真点数なども踏まえた営業視点の強み（各1行）。
2. instagramDm（Instagram DM用・140〜200文字）：
   - 挨拶＋店の具体的な強み一言＋「ぐるポ」での送客提案＋軽い返信確認のみ。堅苦しいビジネス敬語は避け、自然で短いDMにする。
3. emailSubject / emailBody（メール営業用・200文字前後）：
   - 件名は短く具体的に。本文は要点3つ（挨拶・強みへの共感・提案と返信打診）だけの簡潔な文面。署名は担当者名。
4. teleapoScript（テレアポ用・トークポイント形式）：
   - 電話口でサッと見て話せる4行の短いトークポイント（「①名乗り」「②フック（強み）」「③メリット一言」「④アポ打診」）。

必ず以下のJSON形式のみで出力してください:
{
  "strengths": ["強み1", "強み2", "強み3"],
  "instagramDm": "短いInstagram DM文面",
  "emailSubject": "短い件名",
  "emailBody": "短いメール本文",
  "teleapoScript": "短いテレアポ用トークポイント"
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

  if (
    strengths.length === 0 ||
    !parsed.instagramDm ||
    !parsed.emailSubject ||
    !parsed.emailBody ||
    !parsed.teleapoScript
  ) {
    throw new Error("十分な分析結果を取得できませんでした。再分析をお試しください。");
  }

  return {
    strengths,
    instagramDm: String(parsed.instagramDm).trim(),
    emailSubject: String(parsed.emailSubject).trim(),
    emailBody: String(parsed.emailBody).trim(),
    teleapoScript: String(parsed.teleapoScript).trim(),
  };
}

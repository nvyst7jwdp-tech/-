const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransient(status, msg) {
  if (status === 429 || status === 503 || status === 500) return true;
  const m = String(msg || "").toLowerCase();
  return m.includes("high demand") || m.includes("overloaded") || m.includes("try again");
}

async function analyzeBufferWithGemini({
  base64Audio,
  mimeType,
  title,
  storeName,
  speakerName,
  geminiApiKey,
}) {
  const key = String(geminiApiKey || "").trim();
  if (!key) {
    throw new Error("Vercel環境変数（VITE_GEMINI_API_KEY または GEMINI_API_KEY）が未設定です。");
  }

  const cleanMime = String(mimeType || "audio/webm").split(";")[0].trim();
  const prompt = `あなたは飲食店向けグルメSNSサービス「ぐるポ」の営業コーチです。
添付の音声（取材・商談などの録音）を聞き取り、文字起こしを踏まえて以下をJSONで出力してください。

【録音メタ情報】
- タイトル: ${title}
- 店舗名: ${storeName || "未指定"}
- 担当者: ${speakerName}

【出力ルール】
1. summaryPoints（3〜5個）: 商談や取材の要点を簡潔な箇条書きで3〜5個。
2. tasks（1〜5個）: 担当者が次に行うべき具体的なアクション（やるべきこと）をリスト化。
3. feedback: 建設的で前向きなトーンの営業フィードバック。
   - goodPoints（2〜3個）: 良かった点
   - improvements（1〜3個）: 改善できる点
   - nextAdvice（1〜2文）: 次回に向けた具体的なアドバイス

必ず以下のJSON形式のみで出力してください:
{
  "summaryPoints": ["要点1", "要点2", "要点3"],
  "tasks": ["タスク1", "タスク2"],
  "feedback": {
    "goodPoints": ["良かった点1", "良かった点2"],
    "improvements": ["改善点1"],
    "nextAdvice": "次回への提案"
  }
}`;

  async function callModel(modelName) {
    const clean = modelName.replace(/^models\//, "");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        clean
      )}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: cleanMime, data: base64Audio } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      }
    );
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }

  let json = {};
  let succeeded = false;
  let lastMsg = "";

  for (const delay of [0, 1000, 2000]) {
    if (delay > 0) await sleep(delay);
    const attempt = await callModel("gemini-3.8-flash");
    if (attempt.ok) {
      json = attempt.data;
      succeeded = true;
      break;
    }
    lastMsg = attempt.data?.error?.message || "Gemini API呼び出し失敗";
    if (!isTransient(attempt.status, lastMsg)) break;
  }

  if (!succeeded) {
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
      );
      if (listRes.ok) {
        const listJson = await listRes.json();
        const fallbacks = (listJson.models || [])
          .filter(
            (m) =>
              m.name &&
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes("generateContent") &&
              /flash/i.test(m.name) &&
              !/gemini-3\.8-flash$/i.test(m.name)
          )
          .map((m) => m.name);

        for (const m of fallbacks.slice(0, 4)) {
          const retry = await callModel(m);
          if (retry.ok) {
            json = retry.data;
            succeeded = true;
            break;
          }
          lastMsg = retry.data?.error?.message || lastMsg;
        }
      }
    } catch {
      // ignore fallback discovery error
    }
  }

  if (!succeeded) {
    throw new Error(lastMsg || "音声のAI解析に失敗しました。");
  }

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  const summaryPoints = Array.isArray(parsed.summaryPoints)
    ? parsed.summaryPoints.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
    : [];
  const tasks = Array.isArray(parsed.tasks)
    ? parsed.tasks.map((x) => String(x).trim()).filter(Boolean).slice(0, 6)
    : [];

  return {
    summaryPoints:
      summaryPoints.length > 0 ? summaryPoints : ["音声から要点を抽出しました。"],
    tasks,
    feedback: {
      goodPoints: Array.isArray(parsed.feedback?.goodPoints)
        ? parsed.feedback.goodPoints.map(String).filter(Boolean)
        : ["丁寧なヒアリングができています。"],
      improvements: Array.isArray(parsed.feedback?.improvements)
        ? parsed.feedback.improvements.map(String).filter(Boolean)
        : [],
      nextAdvice: String(
        parsed.feedback?.nextAdvice ||
          "次回は具体的なスケジュール提案まで進めるとより効果的です。"
      ),
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { audioUrl, mimeType, title, storeName, speakerName } = body;

    if (!audioUrl || typeof audioUrl !== "string") {
      return res.status(400).json({ error: "audioUrl が必要です。" });
    }

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return res.status(502).json({ error: "音声ファイルの取得に失敗しました。" });
    }

    const arrayBuf = await audioRes.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuf).toString("base64");
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";

    const result = await analyzeBufferWithGemini({
      base64Audio,
      mimeType: mimeType || "audio/webm",
      title: title || "取材録音",
      storeName: storeName || "",
      speakerName: speakerName || "",
      geminiApiKey,
    });

    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "サーバー解析に失敗しました。";
    return res.status(500).json({ error: message });
  }
}

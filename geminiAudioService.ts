export interface RecordingFeedback {
  goodPoints: string[];
  improvements: string[];
  nextAdvice: string;
}

export interface RecordingAnalysisResult {
  summaryPoints: string[];
  tasks: string[];
  feedback: RecordingFeedback;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("音声データの読み込みに失敗しました。"));
    reader.readAsDataURL(blob);
  });
}

export async function analyzeRecordingWithGemini(params: {
  audioBlob: Blob;
  mimeType: string;
  title: string;
  speakerName: string;
  geminiApiKey: string;
}): Promise<RecordingAnalysisResult> {
  const key = params.geminiApiKey.trim();
  if (!key) {
    throw new Error(
      "Gemini APIキー（VITE_GEMINI_API_KEY）が未設定です。Vercelの環境変数に設定してください。"
    );
  }

  const base64Audio = await blobToBase64(params.audioBlob);
  const cleanMime = (params.mimeType || "audio/webm").split(";")[0].trim();

  const prompt = `あなたは飲食店向けグルメSNSサービス「ぐるポ」の営業コーチです。
添付の音声（商談・取材・営業電話などの録音）を聞き取り、文字起こしを踏まえて以下をJSONで出力してください。

【録音メタ情報】
- タイトル/店舗名: ${params.title}
- 担当者: ${params.speakerName}

【出力ルール】
1. summaryPoints（3〜5個）: 商談や会話の要点を簡潔な箇条書きで3〜5個。
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

  type GeminiResp = {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  function isTransient(status: number, msg?: string) {
    if (status === 429 || status === 503 || status === 500) return true;
    const m = (msg || "").toLowerCase();
    return m.includes("high demand") || m.includes("overloaded") || m.includes("try again");
  }

  async function callModel(modelName: string) {
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
    const data = (await res.json()) as GeminiResp;
    return { ok: res.ok, status: res.status, data };
  }

  let json: GeminiResp = {};
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
    lastMsg = attempt.data.error?.message || "失敗";
    if (!isTransient(attempt.status, lastMsg)) break;
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
        const fallbacks = (listJson.models ?? [])
          .filter(
            (m) =>
              m.name &&
              m.supportedGenerationMethods?.includes("generateContent") &&
              /flash/i.test(m.name) &&
              !/gemini-3\.8-flash$/i.test(m.name)
          )
          .map((m) => m.name as string);

        for (const m of fallbacks.slice(0, 4)) {
          const retry = await callModel(m);
          if (retry.ok) {
            json = retry.data;
            succeeded = true;
            break;
          }
          lastMsg = retry.data.error?.message || lastMsg;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!succeeded) {
    throw new Error(lastMsg || "音声のAI解析に失敗しました。");
  }

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<RecordingAnalysisResult>;
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
      nextAdvice: String(parsed.feedback?.nextAdvice ?? "次回は具体的なスケジュール提案まで進めるとより効果的です。"),
    },
  };
}

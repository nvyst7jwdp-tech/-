import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

initializeApp();

interface RecordingFeedback {
  goodPoints: string[];
  improvements: string[];
  nextAdvice: string;
}

interface RecordingAnalysisResult {
  summaryPoints: string[];
  tasks: string[];
  feedback: RecordingFeedback;
}

interface GeminiResp {
  error?: { message?: string };
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(status: number, msg?: string): boolean {
  if (status === 429 || status === 503 || status === 500) return true;
  const m = (msg || "").toLowerCase();
  return m.includes("high demand") || m.includes("overloaded") || m.includes("try again");
}

async function analyzeBufferWithGemini(params: {
  base64Audio: string;
  mimeType: string;
  title: string;
  storeName: string;
  speakerName: string;
  geminiApiKey: string;
}): Promise<RecordingAnalysisResult> {
  const key = params.geminiApiKey.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY シークレットが設定されていません。");
  }

  const cleanMime = (params.mimeType || "audio/webm").split(";")[0].trim();
  const prompt = `あなたは飲食店向けグルメSNSサービス「ぐるポ」の営業コーチです。
添付の音声（取材・商談などの録音）を聞き取り、文字起こしを踏まえて以下をJSONで出力してください。

【録音メタ情報】
- タイトル: ${params.title}
- 店舗名: ${params.storeName || "未指定"}
- 担当者: ${params.speakerName}

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
                { inlineData: { mimeType: cleanMime, data: params.base64Audio } },
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
    lastMsg = attempt.data.error?.message || "Gemini API呼び出し失敗";
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
      // ignore fallback discovery error
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
      nextAdvice: String(
        parsed.feedback?.nextAdvice ??
          "次回は具体的なスケジュール提案まで進めるとより効果的です。"
      ),
    },
  };
}

export const processRecordingAudio = onDocumentCreated(
  {
    document: "recordings/{recId}",
    region: "asia-northeast1",
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as Record<string, unknown>;
    if (data.status !== "processing") return;

    const storagePath = String(data.storagePath ?? "");
    const mimeType = String(data.mimeType ?? "audio/webm");
    const title = String(data.title ?? "取材録音");
    const storeName = String(data.storeName ?? "");
    const speakerName = String(data.ownerName ?? "");

    const db = getFirestore();
    const docRef = db.collection("recordings").doc(snap.id);

    try {
      if (!storagePath) {
        throw new Error("storagePath が見つかりません。");
      }

      const [buffer] = await getStorage().bucket().file(storagePath).download();
      const base64Audio = buffer.toString("base64");
      const geminiApiKey = process.env.GEMINI_API_KEY ?? "";

      const ai = await analyzeBufferWithGemini({
        base64Audio,
        mimeType,
        title,
        storeName,
        speakerName,
        geminiApiKey,
      });

      const tasks = ai.tasks.map((text, idx) => ({
        id: `t-${Date.now()}-${idx}`,
        text,
        done: false,
      }));

      await docRef.update({
        status: "completed",
        summaryPoints: ai.summaryPoints,
        tasks,
        feedback: ai.feedback,
        analysisError: "",
        processedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI解析に失敗しました。";
      await docRef.update({
        status: "error",
        analysisError: msg,
        processedAt: new Date().toISOString(),
      });
    }
  }
);

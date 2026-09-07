import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for large payload (audio base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy initialize Gemini client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Check if an error is a transient AI server error (503 high demand, 429 rate limit, 500 transient)
function isTransientAiError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.code || err.statusCode;
  const msg =
    (err.message || "") +
    " " +
    (typeof err === "string" ? err : "") +
    " " +
    (err.statusText || "");
  return (
    status === 503 ||
    status === 429 ||
    status === "UNAVAILABLE" ||
    status === "RESOURCE_EXHAUSTED" ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("high demand") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("overloaded") ||
    msg.includes("spikes in demand") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("try again later")
  );
}

// Format friendly user-facing error message
function formatAiErrorMessage(err: any, defaultMsg = "Không thể xử lý yêu cầu qua AI."): string {
  if (!err) return defaultMsg;
  if (isTransientAiError(err)) {
    return "Hệ thống AI hiện đang có lượng truy cập cao đột biến. Vui lòng bấm thử lại sau vài giây.";
  }
  return err.message || defaultMsg;
}

interface GenerateRetryOptions {
  model?: string;
  fallbackModels?: string[];
  contents: any;
  config?: any;
  maxRetries?: number;
}

// Execute generateContent with exponential backoff and fallback models
async function generateContentWithRetry(
  ai: GoogleGenAI,
  options: GenerateRetryOptions
) {
  const primaryModel = options.model || "gemini-3.1-flash-lite";
  const fallbackModels = options.fallbackModels || ["gemini-3.8-flash", "gemini-flash-latest"];
  const candidateModels = [primaryModel, ...fallbackModels.filter((m) => m !== primaryModel)];
  const maxRetries = options.maxRetries ?? 1;

  let lastError: any = null;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const currentModel = candidateModels[mIdx];
    const hasNextModel = mIdx < candidateModels.length - 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: options.contents,
          config: options.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const transient = isTransientAiError(err);

        // If high demand (503) or transient error and a fallback model is available,
        // seamlessly switch to next model immediately without waiting.
        if (transient && hasNextModel) {
          console.log(`[Gemini API] Switching from ${currentModel} to ${candidateModels[mIdx + 1]}...`);
          break;
        }

        if (transient && attempt < maxRetries) {
          const delayMs = 500 * Math.pow(2, attempt) + Math.random() * 200;
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if (!transient) {
          throw err;
        }
      }
    }
  }

  throw lastError;
}

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Transcribe Audio via Gemini
app.post("/api/transcribe-audio", async (req: Request, res: Response) => {
  try {
    const {
      audioData,
      mimeType = "audio/webm",
      language = "vi-VN",
      vocabularyHint = "",
      includeTimestamps = true,
    } = req.body;

    if (!audioData) {
      res.status(400).json({ error: "Dữ liệu âm thanh (audioData) là bắt buộc." });
      return;
    }

    const ai = getGeminiClient();

    // Clean base64 if it has data URL prefix
    const cleanBase64 = audioData.replace(/^data:audio\/[a-zA-Z0-9.+_-]+;base64,/, "");

    const vocabSection = vocabularyHint?.trim()
      ? `\nDanh sách từ vựng/thuật ngữ ưu tiên nhận diện chính xác: "${vocabularyHint.trim()}".`
      : "";

    const timestampRule = includeTimestamps
      ? `\n5. Chèn mốc thời gian định dạng [mm:ss] (ví dụ: [00:00], [00:30], [01:00]...) ở đầu các đoạn sau mỗi khoảng 30 giây hoặc khi bắt đầu lượt nói mới.`
      : "";

    const promptText = `Bạn là chuyên gia chuyển giọng nói thành văn bản (Speech-to-Text).
Nhiệm vụ: Chuyển toàn bộ đoạn ghi âm này thành văn bản một cách trung thực, chính xác từng câu chữ.
Yêu cầu:
1. Ngôn ngữ dự kiến của đoạn âm thanh: "${language}" (hoặc tự động phát hiện ngôn ngữ nếu người nói dùng ngôn ngữ khác/pha trộn).${vocabSection}
2. Thêm dấu chấm câu, viết hoa tên riêng, ngắt đoạn tự nhiên, chính xác.
3. Nếu có nhiều người nói, hãy ghi nhãn rõ ràng (ví dụ: [Người nói 1], [Người nói 2] hoặc [Speaker 1], [Speaker 2]).
4. Giữ nguyên ngữ nghĩa, không tự ý tóm tắt hoặc thêm bớt ý kiến cá nhân.${timestampRule}
${includeTimestamps ? "6" : "5"}. CHỈ trả về phần văn bản đã chuyển đổi, không chào hỏi hay giải thích thêm.`;

    const audioPart = {
      inlineData: {
        mimeType: mimeType || "audio/webm",
        data: cleanBase64,
      },
    };

    // Use gemini-3.5-transcribe with fallbacks and retries
    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-transcribe",
      fallbackModels: ["gemini-3.1-flash-lite", "gemini-3.8-flash"],
      contents: {
        parts: [audioPart, { text: promptText }],
      },
    });

    const transcribedText = response.text || "";
    const wordCount = transcribedText.trim() ? transcribedText.trim().split(/\s+/).length : 0;

    res.json({
      success: true,
      transcript: transcribedText.trim(),
      wordCount,
    });
  } catch (error: any) {
    console.error("Lỗi khi chuyển đổi âm thanh:", error?.message || error);
    res.status(isTransientAiError(error) ? 503 : 500).json({
      error: formatAiErrorMessage(error, "Không thể chuyển đổi âm thanh thành văn bản. Vui lòng thử lại."),
    });
  }
});

// Auto-detect Language of Audio via Gemini AI
app.post("/api/detect-audio-language", async (req: Request, res: Response) => {
  try {
    const { audioData, mimeType = "audio/webm" } = req.body;

    if (!audioData) {
      res.status(400).json({ error: "Dữ liệu âm thanh (audioData) là bắt buộc." });
      return;
    }

    const ai = getGeminiClient();
    const cleanBase64 = audioData.replace(/^data:audio\/[a-zA-Z0-9.+_-]+;base64,/, "");

    const promptText = `Bạn là chuyên gia ngôn ngữ học và nhận diện giọng nói.
Nhiệm vụ: Phân tích giọng nói trong đoạn âm thanh được cung cấp và phát hiện chính xác ngôn ngữ chính mà người nói đang sử dụng.

Các ngôn ngữ hệ thống hiện hỗ trợ:
- "vi-VN": Tiếng Việt (Vietnamese)
- "en-US": English (US)
- "en-GB": English (UK)
- "ja-JP": 日本語 (Japanese)
- "ko-KR": 한국어 (Korean)
- "zh-CN": 中文 (Chinese / Mandarin)
- "fr-FR": Français (French)
- "es-ES": Español (Spanish)
- "de-DE": Deutsch (German)
- "it-IT": Italiano (Italian)
- "ru-RU": Русский (Russian)
- "pt-BR": Português (Portuguese)
- "id-ID": Bahasa Indonesia (Indonesian)
- "th-TH": ไทย (Thai)
- "hi-IN": हिन्दी (Hindi)

Hãy xác định chính xác ngôn ngữ được nói trong tệp âm thanh:
1. 'languageCode': Chọn mã phù hợp nhất từ danh sách trên (ví dụ 'vi-VN', 'en-US', 'ja-JP', v.v.), hoặc mã BCP-47 nếu thuộc ngôn ngữ khác.
2. 'languageName': Tên ngôn ngữ (ưu tiên tiếng Việt hoặc tên bản địa, ví dụ: "Tiếng Việt", "English (US)", "日本語").
3. 'englishName': Tên tiếng Anh chuẩn của ngôn ngữ (ví dụ: "Vietnamese", "English (US)", "Japanese").
4. 'confidence': Số thực từ 0.0 đến 1.0 (ví dụ 0.96) thể hiện mức độ chắc chắn.
5. 'explanation': Câu giải thích ngắn gọn về căn cứ nhận diện (ngữ điệu, từ vựng nhận diện được).`;

    const audioPart = {
      inlineData: {
        mimeType: mimeType || "audio/webm",
        data: cleanBase64,
      },
    };

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      fallbackModels: ["gemini-3.8-flash", "gemini-flash-latest"],
      contents: {
        parts: [audioPart, { text: promptText }],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            languageCode: {
              type: Type.STRING,
              description: "Mã ngôn ngữ ISO / BCP-47 phù hợp nhất (ví dụ vi-VN, en-US)",
            },
            languageName: {
              type: Type.STRING,
              description: "Tên ngôn ngữ hiển thị (ví dụ Tiếng Việt, English (US))",
            },
            englishName: {
              type: Type.STRING,
              description: "Tên tiếng Anh của ngôn ngữ (ví dụ Vietnamese, English)",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Độ tin cậy từ 0.0 đến 1.0",
            },
            explanation: {
              type: Type.STRING,
              description: "Giải thích ngắn gọn căn cứ nhận diện",
            },
          },
          required: ["languageCode", "languageName"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");

    res.json({
      success: true,
      detected: {
        languageCode: parsed.languageCode || "vi-VN",
        languageName: parsed.languageName || "Tiếng Việt",
        englishName: parsed.englishName || "Vietnamese",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.95,
        explanation: parsed.explanation || "",
      },
    });
  } catch (error: any) {
    console.error("Lỗi detect-audio-language:", error?.message || error);
    res.status(isTransientAiError(error) ? 503 : 500).json({
      error: formatAiErrorMessage(error, "Không thể phát hiện ngôn ngữ của tệp âm thanh."),
    });
  }
});

// Helper to convert raw PCM Buffer to valid RIFF WAV audio
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1): Buffer {
  const wavHeader = Buffer.alloc(44);
  const dataLength = pcmBuffer.length;
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + dataLength, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // Linear PCM
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * numChannels * 2, 28);
  wavHeader.writeUInt16LE(numChannels * 2, 32);
  wavHeader.writeUInt16LE(16, 34); // 16 bits per sample
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(dataLength, 40);
  return Buffer.concat([wavHeader, pcmBuffer]);
}

// Memory cache for generated TTS audio to prevent redundant API latency
const ttsAudioCache = new Map<string, string>();

// Text-to-Speech endpoint powered by Gemini AI
app.post("/api/tts", async (req: Request, res: Response) => {
  try {
    const { text, voiceName = "Kore" } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Nội dung văn bản cần đọc không được để trống." });
      return;
    }

    const cleanText = text.trim();
    const cacheKey = `${voiceName}:${cleanText}`;
    if (ttsAudioCache.has(cacheKey)) {
      res.json({
        success: true,
        audioUrl: ttsAudioCache.get(cacheKey),
        voice: voiceName,
        cached: true,
      });
      return;
    }

    const ai = getGeminiClient();
    let response: any;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: cleanText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName || "Kore",
                },
              },
            },
          },
        });
        break;
      } catch (err: any) {
        if (isTransientAiError(err) && attempt < 2) {
          const delayMs = 1000 * Math.pow(2, attempt) + Math.random() * 300;
          console.warn(`[Gemini TTS] 503/429 high demand spike. Retrying in ${Math.round(delayMs)}ms...`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const base64Pcm = part?.inlineData?.data;
    if (!base64Pcm) {
      throw new Error("Mô hình AI không trả về dữ liệu âm thanh giọng đọc.");
    }

    const rawPcm = Buffer.from(base64Pcm, "base64");
    const wavBuffer = pcmToWav(rawPcm, 24000, 1);
    const audioDataUrl = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;

    // Manage cache size limit
    if (ttsAudioCache.size > 50) {
      const oldestKey = ttsAudioCache.keys().next().value;
      if (oldestKey) ttsAudioCache.delete(oldestKey);
    }
    ttsAudioCache.set(cacheKey, audioDataUrl);

    res.json({
      success: true,
      audioUrl: audioDataUrl,
      voice: voiceName,
    });
  } catch (error: any) {
    console.error("Lỗi API TTS:", error?.message || error);
    res.status(isTransientAiError(error) ? 503 : 500).json({
      error: formatAiErrorMessage(error, "Không thể tạo giọng đọc văn bản qua Gemini TTS."),
    });
  }
});

// Refine & format speech transcript (fix speech recognition artifacts)
app.post("/api/refine-transcript", async (req: Request, res: Response) => {
  try {
    const { transcript, language = "Tiếng Việt" } = req.body;
    if (!transcript || !transcript.trim()) {
      res.status(400).json({ error: "Nội dung văn bản không được để trống." });
      return;
    }

    const ai = getGeminiClient();
    const prompt = `Bạn là trợ lý biên tập văn bản nói thành văn bản viết chuẩn mực.
Dưới đây là bản ghi thô thu được từ tính năng nhận diện giọng nói (Web Speech API):
"""
${transcript}
"""

Hãy chỉnh sửa văn bản này theo các nguyên tắc:
1. Sửa lỗi chính tả do nhận diện sai âm vần (ngôn ngữ: ${language}).
2. Bổ sung các dấu câu (chấm, phẩy, hỏi, chấm than, hai chấm, ngoặc kép) chuẩn xác theo ngữ cảnh.
3. Viết hoa đầu câu và các danh từ riêng, địa danh, tên người.
4. Ngắt dòng và tách đoạn văn mạch lạc, dễ đọc.
5. Tuyệt đối KHÔNG thay đổi ý nghĩa, không lược bỏ thông tin hoặc tự thêm ý mới.
6. Chỉ trả về văn bản đã chỉnh sửa, không có lời mở đầu hay kết luận.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      fallbackModels: ["gemini-3.8-flash", "gemini-flash-latest"],
      contents: prompt,
    });

    res.json({
      success: true,
      refinedText: response.text?.trim() || transcript,
    });
  } catch (error: any) {
    console.error("Lỗi refine-transcript:", error?.message || error);
    res.status(isTransientAiError(error) ? 503 : 500).json({
      error: formatAiErrorMessage(error, "Không thể chuẩn hóa văn bản."),
    });
  }
});

// Summarize transcript
app.post("/api/summarize", async (req: Request, res: Response) => {
  try {
    const {
      text,
      style = "executive", // 'executive' | 'key_points' | 'action_items' | 'meeting_notes' | 'detailed'
      length = "standard", // 'concise' | 'standard' | 'detailed'
      targetLanguage = "auto", // 'auto' | 'vi' | 'en' | etc.
    } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ error: "Nội dung văn bản cần tóm tắt không được để trống." });
      return;
    }

    const ai = getGeminiClient();

    const styleInstructions: Record<string, string> = {
      executive:
        "Tập trung vào bức tranh toàn cảnh, đưa ra bản tóm tắt điều hành súc tích, ngắn gọn, nắm bắt ý chính yếu nhất.",
      key_points:
        "Trích xuất danh sách các luận điểm và ý chính quan trọng nhất dưới dạng các gạch đầu dòng rõ ràng, mạch lạc.",
      action_items:
        "Trích xuất toàn bộ các hành động cần thực hiện, nhiệm vụ được giao, thời hạn (nếu có), các bước tiếp theo cần triển khai.",
      meeting_notes:
        "Định dạng như một biên bản cuộc họp chuyên nghiệp: Mục đích cuộc họp, Các vấn đề đã thảo luận, Quyết định đạt được, Kế hoạch hành động cụ thể.",
      detailed:
        "Tóm tắt chi tiết, toàn diện, bảo tồn cả bối cảnh, các luận cứ, số liệu (nếu có) và kết luận.",
    };

    const lengthInstructions: Record<string, string> = {
      concise: "Độ dài ngắn gọn (khoảng 3-5 gạch đầu dòng hoặc 1-2 đoạn văn ngắn).",
      standard: "Độ dài tiêu chuẩn, cân đối, đầy đủ thông tin trọng tâm.",
      detailed: "Độ dài chi tiết, phân tích sâu, chia mục rõ ràng.",
    };

    const langInstruction =
      targetLanguage && targetLanguage !== "auto"
        ? `Bản tóm tắt PHẢI được viết bằng ngôn ngữ: ${targetLanguage}.`
        : "Viết bản tóm tắt bằng ngôn ngữ chính của văn bản gốc (ưu tiên Tiếng Việt nếu văn bản gốc là Tiếng Việt).";

    const systemInstruction = `Bạn là chuyên gia AI tóm tắt nội dung và xử lý thông tin hàng đầu thế giới.
Phong cách tóm tắt yêu cầu: ${styleInstructions[style] || styleInstructions.executive}
Độ dài mong muốn: ${lengthInstructions[length] || lengthInstructions.standard}
${langInstruction}

Bạn hãy phân tích kỹ văn bản được cung cấp và trả về kết quả cấu trúc JSON chính xác theo Schema.`;

    const prompt = `Văn bản cần tóm tắt:\n"""\n${text}\n"""`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      fallbackModels: ["gemini-3.8-flash", "gemini-flash-latest"],
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Tiêu đề ngắn gọn, đại diện cho chủ đề chính của văn bản",
            },
            overview: {
              type: Type.STRING,
              description: "Đoạn văn tóm tắt tổng quan nội dung chính",
            },
            keyPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  heading: { type: Type.STRING, description: "Tên luận điểm / ý chính" },
                  detail: { type: Type.STRING, description: "Chi tiết ngắn gọn giải thích luận điểm" },
                },
                required: ["heading", "detail"],
              },
              description: "Danh sách các ý chính nổi bật nhất",
            },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  task: { type: Type.STRING, description: "Hành động / Công việc cụ thể cần làm" },
                  assignee: { type: Type.STRING, description: "Người chịu trách nhiệm (nếu có đề cập, hoặc 'Không xác định')" },
                },
                required: ["task"],
              },
              description: "Danh sách hành động, quyết định hoặc việc cần làm trích xuất được",
            },
            topics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 đến 6 từ khóa / chủ đề chính được thảo luận",
            },
            sentiment: {
              type: Type.STRING,
              description: "Đánh giá tông giọng và cảm xúc của bài nói (ví dụ: 'Tích cực & Hào hứng', 'Khách quan & Xây dựng', 'Nghiêm túc', v.v.)",
            },
            formattedMarkdown: {
              type: Type.STRING,
              description: "Toàn bộ bản tóm tắt được trình bày đẹp mắt dưới dạng Markdown hoàn chỉnh để người dùng có thể sao chép nhanh",
            },
          },
          required: ["title", "overview", "keyPoints", "topics", "formattedMarkdown"],
        },
      },
    });

    const jsonStr = response.text || "{}";
    const parsed = JSON.parse(jsonStr);

    res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error("Lỗi summarize:", error?.message || error);
    res.status(isTransientAiError(error) ? 503 : 500).json({
      error: formatAiErrorMessage(error, "Không thể tạo bản tóm tắt. Vui lòng thử lại."),
    });
  }
});

// Q&A / Ask Gemini about the transcript
app.post("/api/ask-transcript", async (req: Request, res: Response) => {
  try {
    const { transcript, question, conversationHistory = [] } = req.body;
    if (!transcript || !transcript.trim()) {
      res.status(400).json({ error: "Nội dung văn bản ghi âm không được để trống." });
      return;
    }
    if (!question || !question.trim()) {
      res.status(400).json({ error: "Câu hỏi không được để trống." });
      return;
    }

    const ai = getGeminiClient();

    const systemInstruction = `Bạn là trợ lý AI phân tích nội dung ghi âm thông minh.
Nhiệm vụ của bạn là trả lời các câu hỏi dựa trên nội dung bài nói/ghi âm được cung cấp:
"""
${transcript}
"""

Nguyên tắc:
1. Trả lời trực diện, chính xác, súc tích, dựa trên sự thật có trong bản ghi âm.
2. Nếu bản ghi âm không đề cập đến thông tin được hỏi, hãy nêu rõ điều đó một cách lịch sự.
3. Trích dẫn câu nói hoặc số liệu cụ thể nếu có.
4. Trả lời bằng ngôn ngữ mà người dùng đặt câu hỏi (mặc định Tiếng Việt).`;

    const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
    let answerText = "";
    let lastError: any = null;

    for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
      const currentModel = candidateModels[mIdx];
      const hasNextModel = mIdx < candidateModels.length - 1;
      let modelSuccess = false;

      for (let attempt = 0; attempt <= 1; attempt++) {
        try {
          const chat = ai.chats.create({
            model: currentModel,
            config: {
              systemInstruction,
            },
          });

          // Replay previous history if any
          for (const msg of conversationHistory) {
            if (msg.role === "user") {
              await chat.sendMessage({ message: msg.content });
            }
          }

          const response = await chat.sendMessage({ message: question });
          answerText = response.text?.trim() || "Không có phản hồi từ AI.";
          modelSuccess = true;
          break;
        } catch (err: any) {
          lastError = err;
          const transient = isTransientAiError(err);
          if (transient && hasNextModel) {
            console.log(`[Gemini Q&A] Switching from ${currentModel} to ${candidateModels[mIdx + 1]}...`);
            break;
          }
          if (transient && attempt < 1) {
            const delayMs = 500 * Math.pow(2, attempt) + Math.random() * 200;
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          if (!transient) {
            throw err;
          }
        }
      }

      if (modelSuccess) break;
    }

    if (!answerText && lastError) {
      throw lastError;
    }

    res.json({
      success: true,
      answer: answerText || "Không có phản hồi từ AI.",
    });
  } catch (error: any) {
    console.error("Lỗi ask-transcript:", error?.message || error);
    res.status(isTransientAiError(error) ? 503 : 500).json({
      error: formatAiErrorMessage(error, "Không thể trả lời câu hỏi về bài nói."),
    });
  }
});

// Format with Speaker Diarization & Timestamps
app.post("/api/diarize-transcript", async (req: Request, res: Response) => {
  try {
    const { transcript, language = "Tiếng Việt" } = req.body;
    if (!transcript || !transcript.trim()) {
      res.status(400).json({ error: "Nội dung văn bản không được để trống." });
      return;
    }

    const ai = getGeminiClient();
    const prompt = `Bạn là trợ lý định dạng kịch bản hội thoại và biên bản họp chuyên nghiệp.
Dưới đây là văn bản bài nói/cuộc họp:
"""
${transcript}
"""

Nhiệm vụ:
1. Phân tích văn bản và phân định rõ ràng các người nói (ví dụ: [Người nói 1], [Người nói 2] hoặc theo tên người nếu có nhắc tới trong văn bản).
2. Thêm mốc thời gian ước tính tương đối phù hợp [00:00], [00:45], v.v. ở đầu mỗi lượt nói.
3. Sửa lỗi chính tả, bổ sung dấu câu chuẩn mực cho từng câu nói.
4. Giữ nguyên nội dung và ý nghĩa trung thực của cuộc hội thoại.
5. Chỉ trả về kịch bản hội thoại có cấu trúc phân vai, không có lời dẫn thêm.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      fallbackModels: ["gemini-3.8-flash", "gemini-flash-latest"],
      contents: prompt,
    });

    res.json({
      success: true,
      diarizedText: response.text?.trim() || transcript,
    });
  } catch (error: any) {
    console.error("Lỗi diarize-transcript:", error?.message || error);
    res.status(isTransientAiError(error) ? 503 : 500).json({
      error: formatAiErrorMessage(error, "Không thể phân vai người nói."),
    });
  }
});

// Translate text
app.post("/api/translate", async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage = "en" } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ error: "Nội dung cần dịch không được để trống." });
      return;
    }

    const ai = getGeminiClient();
    const prompt = `Dịch toàn bộ văn bản sau đây sang ngôn ngữ '${targetLanguage}'. Giữ nguyên định dạng, cấu trúc đoạn và ngữ điệu tự nhiên:
"""
${text}
"""
Chỉ trả về bản dịch, không giải thích.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      fallbackModels: ["gemini-3.8-flash", "gemini-flash-latest"],
      contents: prompt,
    });

    res.json({
      success: true,
      translatedText: response.text?.trim() || "",
    });
  } catch (error: any) {
    console.error("Lỗi translate:", error?.message || error);
    res.status(isTransientAiError(error) ? 503 : 500).json({
      error: formatAiErrorMessage(error, "Không thể dịch văn bản."),
    });
  }
});

// Integrate Vite middleware in development, static files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

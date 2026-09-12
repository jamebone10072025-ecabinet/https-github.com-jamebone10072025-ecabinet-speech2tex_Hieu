import { SummaryResult, SummaryStyle, SummaryLength } from "../types";

export interface TranscribeResponse {
  success: boolean;
  transcript: string;
  wordCount: number;
}

export interface DetectedLanguagePayload {
  languageCode: string;
  languageName: string;
  englishName: string;
  confidence: number;
  explanation?: string;
}

export interface DetectLanguageResponse {
  success: boolean;
  detected: DetectedLanguagePayload;
}

export async function detectAudioLanguage(
  audioData: string,
  mimeType: string = "audio/webm"
): Promise<DetectLanguageResponse> {
  const response = await fetch("/api/detect-audio-language", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioData, mimeType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Không thể nhận diện ngôn ngữ (${response.status})`);
  }

  return response.json();
}

export interface SummarizeResponse {
  success: boolean;
  data: SummaryResult;
}

export async function transcribeAudioFile(
  audioData: string,
  mimeType: string,
  language: string = "vi-VN",
  vocabularyHint: string = "",
  includeTimestamps: boolean = true
): Promise<TranscribeResponse> {
  const response = await fetch("/api/transcribe-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioData, mimeType, language, vocabularyHint, includeTimestamps }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Lỗi máy chủ (${response.status}) khi chuyển âm thanh`);
  }

  return response.json();
}

export async function diarizeTranscript(
  transcript: string,
  language: string = "Tiếng Việt"
): Promise<string> {
  const response = await fetch("/api/diarize-transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, language }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Không thể phân vai người nói.");
  }

  const data = await response.json();
  return data.diarizedText;
}

export async function askTranscriptQuestion(
  transcript: string,
  question: string,
  conversationHistory: { role: string; content: string }[] = []
): Promise<string> {
  const response = await fetch("/api/ask-transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, question, conversationHistory }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Không thể trả lời câu hỏi.");
  }

  const data = await response.json();
  return data.answer;
}

export async function refineTranscript(
  transcript: string,
  language: string = "Tiếng Việt"
): Promise<string> {
  const response = await fetch("/api/refine-transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, language }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Lỗi khi chuẩn hóa văn bản`);
  }

  const data = await response.json();
  return data.refinedText;
}

export async function summarizeTranscript(params: {
  text: string;
  style: SummaryStyle;
  length: SummaryLength;
  targetLanguage: string;
}): Promise<SummaryResult> {
  const response = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Lỗi khi tạo bản tóm tắt (${response.status})`);
  }

  const json: SummarizeResponse = await response.json();
  return json.data;
}

export async function translateContent(
  text: string,
  targetLanguage: string
): Promise<string> {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLanguage }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Không thể dịch văn bản");
  }

  const json = await response.json();
  return json.translatedText;
}

export interface TTSResponse {
  success: boolean;
  audioUrl: string;
  voice: string;
  cached?: boolean;
}

export async function generateGeminiTTS(
  text: string,
  voiceName: string = "Kore"
): Promise<TTSResponse> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceName }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Không thể tạo giọng đọc TTS qua Gemini.");
  }

  return response.json();
}

export interface ExtractDocumentTextResponse {
  success: boolean;
  extractedText: string;
  fileName: string;
  characterCount: number;
}

export async function extractDocumentText(
  fileData: string,
  fileName: string,
  mimeType: string
): Promise<ExtractDocumentTextResponse> {
  const response = await fetch("/api/extract-document-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileData, fileName, mimeType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Không thể trích xuất nội dung văn bản từ tệp.");
  }

  return response.json();
}


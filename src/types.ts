export interface SupportedLanguage {
  code: string; // e.g. "vi-VN"
  name: string; // "Tiếng Việt"
  englishName: string; // "Vietnamese"
  flag: string; // "🇻🇳"
  recognitionCode: string; // "vi-VN" for Web Speech API
}

export interface SummaryKeyPoint {
  heading: string;
  detail: string;
}

export interface SummaryActionItem {
  task: string;
  assignee?: string;
  completed?: boolean;
}

export interface SummaryResult {
  title: string;
  overview: string;
  keyPoints: SummaryKeyPoint[];
  actionItems: SummaryActionItem[];
  topics: string[];
  sentiment: string;
  formattedMarkdown: string;
  generatedAt?: string;
}

export type SummaryStyle =
  | "executive"
  | "key_points"
  | "action_items"
  | "meeting_notes"
  | "detailed";

export type SummaryLength = "concise" | "standard" | "detailed";

export type SessionCategory = "Cuộc họp" | "Phỏng vấn" | "Ý tưởng" | "Học tập" | "Cá nhân";

export interface SpeechSessionItem {
  id: string;
  timestamp: number;
  title: string;
  transcript: string;
  language: string; // code like "vi-VN"
  category?: SessionCategory;
  translatedText?: string;
  audioDurationSeconds?: number;
  summary?: SummaryResult;
  summaryStyle?: SummaryStyle;
  audioUrl?: string; // object URL or data URL if available
}

export interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
}

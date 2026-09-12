import React, { useState, useRef } from "react";
import {
  Mic,
  Upload,
  FileAudio,
  Sparkles,
  Square,
  AlertCircle,
  Clock,
  Loader2,
  BookmarkPlus,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Languages,
  CheckCircle2,
  Globe,
  RotateCcw,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Zap,
  Radio,
  Activity,
} from "lucide-react";
import { SupportedLanguage } from "../types";
import { SAMPLE_RECORDINGS, SampleRecording } from "../data/languages";
import { AudioVisualizer } from "./AudioVisualizer";
import { LanguageSelector } from "./LanguageSelector";
import { AudioPlayerControl } from "./AudioPlayerControl";
import { transcribeAudioFile, detectAudioLanguage } from "../services/apiService";
import { findMatchingLanguage } from "../utils/languageMatcher";
import { formatTimestamp } from "../utils/timestampUtils";

interface SpeechInputSectionProps {
  selectedLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onLanguageDetected?: (lang: SupportedLanguage, confidence: number) => void;
  // Speech Recognition state from parent hook
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  isWebSpeechSupported: boolean;
  onTranscriptAppend: (chunk: string) => void;
  onTranscriptReplace: (fullText: string) => void;
  onTranscribeComplete?: (text: string) => void;
  // Audio recorder state & methods
  isAudioRecording: boolean;
  isAudioPaused?: boolean;
  pauseAudioRecording?: () => void;
  resumeAudioRecording?: () => void;
  audioDuration: number;
  analyserNode: AnalyserNode | null;
  startAudioRecording: () => Promise<void>;
  stopAudioRecording: () => Promise<Blob | null>;
  audioUrl: string | null;
  resetAudioRecording: () => void;
  isLoadingAI: boolean;
  setIsLoadingAI: (loading: boolean) => void;
  onError: (msg: string) => void;
  // Enhanced STT props
  audioLevel?: number;
  isSilent?: boolean;
  speechState?: "idle" | "listening" | "speaking" | "recovering";
  currentTranscript?: string;
  // Timestamping controls
  isTimestampingEnabled?: boolean;
  onToggleTimestamping?: (enabled: boolean) => void;
  onInsertManualTimestamp?: (seconds?: number) => void;
}

export type STTRecognitionMode = "hybrid" | "gemini" | "webspeech";

export const SpeechInputSection: React.FC<SpeechInputSectionProps> = ({
  selectedLanguage,
  onLanguageChange,
  onLanguageDetected,
  isListening,
  startListening,
  stopListening,
  isWebSpeechSupported,
  onTranscriptAppend,
  onTranscriptReplace,
  onTranscribeComplete,
  isAudioRecording,
  isAudioPaused = false,
  pauseAudioRecording,
  resumeAudioRecording,
  audioDuration,
  analyserNode,
  startAudioRecording,
  stopAudioRecording,
  audioUrl,
  resetAudioRecording,
  isLoadingAI,
  setIsLoadingAI,
  onError,
  audioLevel = 0,
  isSilent = false,
  speechState = "idle",
  currentTranscript = "",
  isTimestampingEnabled = true,
  onToggleTimestamping,
  onInsertManualTimestamp,
}) => {
  const [activeTab, setActiveTab] = useState<"mic" | "upload" | "samples">("mic");
  const [recognitionMode, setRecognitionMode] = useState<STTRecognitionMode>("hybrid");
  const [lastRecordedBlob, setLastRecordedBlob] = useState<Blob | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Auto Language Detection State
  const [autoDetectLanguage, setAutoDetectLanguage] = useState<boolean>(true);
  const [detectedLanguageInfo, setDetectedLanguageInfo] = useState<{
    language: SupportedLanguage;
    confidence: number;
    explanation?: string;
  } | null>(null);

  // Custom Domain Vocabulary / Terminology hint
  const [vocabularyHint, setVocabularyHint] = useState("");
  const [isVocabOpen, setIsVocabOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleTranscribeBlob = async (blob: Blob, customNotice?: string) => {
    try {
      setIsLoadingAI(true);
      setUploadProgress(customNotice || "Đang phân tích âm thanh và chuyển đổi qua Gemini AI...");

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string;
          const result = await transcribeAudioFile(
            base64Audio,
            blob.type || "audio/webm",
            selectedLanguage.code,
            vocabularyHint
          );
          if (result.transcript) {
            onTranscriptReplace(result.transcript);
            if (onTranscribeComplete) {
              onTranscribeComplete(result.transcript);
            }
          }
        } catch (err: any) {
          onError(err.message || "Lỗi khi chuyển đổi giọng nói qua AI.");
        } finally {
          setIsLoadingAI(false);
          setUploadProgress(null);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      setIsLoadingAI(false);
      setUploadProgress(null);
      onError(err.message || "Lỗi xử lý tệp âm thanh.");
    }
  };

  const handleToggleRecording = async () => {
    if (isListening || isAudioRecording) {
      // Stopping recording
      if (isListening) {
        stopListening();
      }
      const recordedBlob = await stopAudioRecording();

      if (recordedBlob) {
        setLastRecordedBlob(recordedBlob);

        // Case 1: Always use Gemini AI if user selected Gemini mode or WebSpeech is not supported
        if (recognitionMode === "gemini" || !isWebSpeechSupported) {
          await handleTranscribeBlob(
            recordedBlob,
            "Đang xử lý âm thanh microphone qua Gemini AI Studio để đạt độ chính xác tối đa..."
          );
        }
        // Case 2: Hybrid mode auto-fallback:
        // If the browser Web Speech yielded 0 or almost no text (< 3 words) while recording was >= 2 seconds,
        // automatically fallback to Gemini 3.5 Transcribe so the user never loses their words!
        else if (recognitionMode === "hybrid") {
          const wordsCount = currentTranscript.trim()
            ? currentTranscript.trim().split(/\s+/).filter(Boolean).length
            : 0;

          if (wordsCount < 3 && audioDuration >= 2) {
            await handleTranscribeBlob(
              recordedBlob,
              "✨ Web Speech chưa bắt kịp âm thanh. Hệ thống đang tự động khôi phục toàn bộ văn bản qua Gemini AI..."
            );
          }
        }
      }
    } else {
      // Starting recording
      resetAudioRecording();
      setLastRecordedBlob(null);
      await startAudioRecording();

      // Start Web Speech if not exclusively Gemini mode and browser supports it
      if (recognitionMode !== "gemini" && isWebSpeechSupported) {
        startListening();
      }
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|webm|ogg|aac|flac)$/i)) {
      onError("Vui lòng chỉ tải lên tệp định dạng âm thanh (MP3, WAV, M4A, WEBM, OGG).");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      onError("Kích thước tệp vượt quá giới hạn 25MB. Vui lòng chọn tệp nhỏ hơn.");
      return;
    }

    setUploadedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setUploadedAudioUrl(objectUrl);
    setDetectedLanguageInfo(null);

    // Auto-detect and transcribe the uploaded file
    processAndTranscribeUploadedFile(file, autoDetectLanguage);
  };

  const processAndTranscribeUploadedFile = (file: File, shouldDetectLang: boolean = true) => {
    setIsLoadingAI(true);
    setUploadProgress(`Đang chuẩn bị tệp "${file.name}"...`);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Audio = reader.result as string;
        const mimeType = file.type || "audio/webm";

        let currentTargetLang = selectedLanguage;

        // Step 1: Automatic Language Detection if enabled
        if (shouldDetectLang) {
          setUploadProgress("Đang phân tích âm thanh để tự động phát hiện ngôn ngữ qua Gemini AI...");
          try {
            const detectRes = await detectAudioLanguage(base64Audio, mimeType);
            if (detectRes.success && detectRes.detected) {
              const matched = findMatchingLanguage(
                detectRes.detected.languageCode,
                detectRes.detected.languageName || detectRes.detected.englishName
              );

              if (matched) {
                currentTargetLang = matched;
                setDetectedLanguageInfo({
                  language: matched,
                  confidence: detectRes.detected.confidence,
                  explanation: detectRes.detected.explanation,
                });

                // Crucial requirement: Automatically switch selectedLanguage before proceeding with transcription!
                onLanguageChange(matched);

                if (onLanguageDetected) {
                  onLanguageDetected(matched, detectRes.detected.confidence);
                }

                setUploadProgress(
                  `Đã phát hiện ${matched.flag} ${matched.name} (${Math.round(
                    detectRes.detected.confidence * 100
                  )}% tin cậy). Đang tiến hành chuyển đổi âm thanh...`
                );
              }
            }
          } catch (detErr: any) {
            console.warn("Language detection skipped or failed, fallback to selected language:", detErr);
          }
        }

        // Step 2: Transcribe with currentTargetLang
        setUploadProgress(
          `Đang chuyển đổi giọng nói (${currentTargetLang.flag} ${currentTargetLang.name}) thành văn bản qua Gemini AI...`
        );

        const result = await transcribeAudioFile(
          base64Audio,
          mimeType,
          currentTargetLang.code,
          vocabularyHint
        );

        if (result.transcript) {
          onTranscriptReplace(result.transcript);
          if (onTranscribeComplete) {
            onTranscribeComplete(result.transcript);
          }
        }
      } catch (err: any) {
        onError(err.message || "Lỗi khi chuyển đổi tệp âm thanh qua Gemini.");
      } finally {
        setIsLoadingAI(false);
        setUploadProgress(null);
      }
    };

    reader.onerror = () => {
      setIsLoadingAI(false);
      setUploadProgress(null);
      onError("Không thể đọc tệp âm thanh này.");
    };

    reader.readAsDataURL(file);
  };

  const handleReDetectLanguageOnly = () => {
    if (!uploadedFile) return;
    processAndTranscribeUploadedFile(uploadedFile, true);
  };

  const handleSelectSample = (sample: SampleRecording) => {
    onTranscriptReplace(sample.text);
    if (onTranscribeComplete) {
      onTranscribeComplete(sample.text);
    }
  };

  const isAnyRecording = isListening || isAudioRecording;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 overflow-hidden transition-all duration-200">
      {/* Tab Navigation Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 px-4 pt-2 bg-slate-50/50 dark:bg-slate-850/50">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => setActiveTab("mic")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "mic"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Thu âm Micro</span>
            {isAnyRecording && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "upload"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Tải tệp âm thanh</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("samples")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "samples"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40"
            }`}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Mẫu có sẵn</span>
          </button>
        </div>

        {/* Language selector dropdown */}
        <div className="py-2">
          <LanguageSelector
            value={selectedLanguage.code}
            onChange={onLanguageChange}
            label=""
            disabled={isAnyRecording}
          />
        </div>
      </div>

      {/* Tab 1: Microphone Live Recording */}
      {activeTab === "mic" && (
        <div className="p-5 sm:p-6 flex flex-col items-center">
          {/* STT Recognition Mode Selector Bar */}
          <div className="w-full max-w-xl mb-4 p-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl">
            <div className="flex items-center justify-between px-2 py-1 mb-1.5">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Chế độ chuyển giọng nói thành văn bản (STT):
              </span>
              {recognitionMode === "hybrid" && (
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                  ⚡ Tự động tối ưu
                </span>
              )}
              {recognitionMode === "gemini" && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  🎙️ Độ chính xác cao nhất
                </span>
              )}
              {recognitionMode === "webspeech" && (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                  🌐 Tức thì qua trình duyệt
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setRecognitionMode("hybrid")}
                disabled={isAnyRecording}
                className={`px-3 py-2 rounded-xl text-left transition-all text-xs flex flex-col gap-0.5 ${
                  recognitionMode === "hybrid"
                    ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs border border-indigo-200 dark:border-indigo-800/80 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Kết hợp Tự động</span>
                </div>
                <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 leading-tight">
                  Tức thì + Gemini AI tự động cứu văn bản nếu bị mất chữ
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRecognitionMode("gemini")}
                disabled={isAnyRecording}
                className={`px-3 py-2 rounded-xl text-left transition-all text-xs flex flex-col gap-0.5 ${
                  recognitionMode === "gemini"
                    ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs border border-emerald-200 dark:border-emerald-800/80 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Gemini AI Studio</span>
                </div>
                <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 leading-tight">
                  Chuẩn xác tuyệt đối, chuẩn tiếng Việt, dấu câu & lọc ồn
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRecognitionMode("webspeech")}
                disabled={isAnyRecording}
                className={`px-3 py-2 rounded-xl text-left transition-all text-xs flex flex-col gap-0.5 ${
                  recognitionMode === "webspeech"
                    ? "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-xs border border-amber-200 dark:border-amber-800/80 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Globe className="w-3.5 h-3.5 text-amber-500" />
                  <span>Web Speech</span>
                </div>
                <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 leading-tight">
                  Nhận diện tức thì trực tiếp trên trình duyệt Web
                </span>
              </button>
            </div>
          </div>

          {/* AI Progress Banner */}
          {uploadProgress && (
            <div className="w-full max-w-xl mb-4 p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex items-center gap-2.5 text-xs text-indigo-800 dark:text-indigo-300 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-600 dark:text-indigo-400" />
              <div className="font-medium flex-1">{uploadProgress}</div>
            </div>
          )}

          {!isWebSpeechSupported && (
            <div className="w-full max-w-xl mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold">Lưu ý:</span> Trình duyệt đang sử dụng chế độ ghi âm đa phương thức để gửi trực tiếp tới Gemini AI nhận diện giọng nói chính xác.
              </div>
            </div>
          )}

          {/* Audio Visualizer */}
          <div className="w-full max-w-md mb-4">
            <AudioVisualizer
              analyserNode={analyserNode}
              isRecording={isAnyRecording}
            />
          </div>

          {/* Real-time Microphone Audio Level & Speech Status Bar (when recording) */}
          {isAnyRecording && (
            <div className="w-full max-w-md mb-5 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col gap-2 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  {isSilent ? (
                    <VolumeX className="w-4 h-4 text-rose-500 animate-pulse" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-indigo-500" />
                  )}
                  <span className="text-slate-600 dark:text-slate-300">Âm lượng Micro:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{Math.round(audioLevel)}%</span>
                </div>

                {/* Speech State Badge */}
                <div>
                  {speechState === "speaking" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-pulse">
                      <Activity className="w-3 h-3 text-emerald-600" />
                      Đang nhận diện giọng nói
                    </span>
                  )}
                  {speechState === "listening" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <Radio className="w-3 h-3 text-indigo-600" />
                      Đang lắng nghe...
                    </span>
                  )}
                  {speechState === "recovering" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <RotateCcw className="w-3 h-3 text-amber-600 animate-spin" />
                      Đang kết nối lại...
                    </span>
                  )}
                  {speechState === "idle" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-slate-400">
                      Sẵn sàng
                    </span>
                  )}
                </div>
              </div>

              {/* Progress VU Bar */}
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 rounded-full ${
                    audioLevel > 25
                      ? "bg-emerald-500"
                      : audioLevel > 8
                      ? "bg-indigo-500"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(3, audioLevel))}%` }}
                />
              </div>

              {/* Silence Warning Tip */}
              {isSilent && audioDuration >= 2 && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-1.5 rounded-lg border border-amber-200 dark:border-amber-800/40">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Micro chưa phát hiện tín hiệu rõ. Vui lòng nói to hơn hoặc đưa micro lại gần.</span>
                </div>
              )}
            </div>
          )}

          {/* Main Record Button & Controls */}
          <div className="flex flex-col items-center gap-4 w-full max-w-lg">
            {!isAnyRecording ? (
              /* Idle state: Big circular Record button */
              <div className="relative flex items-center justify-center">
                <button
                  type="button"
                  id="btn-toggle-recording"
                  onClick={handleToggleRecording}
                  disabled={isLoadingAI}
                  className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-200 transform active:scale-95 bg-indigo-600 hover:bg-indigo-700 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/50 hover:shadow-indigo-500/25 ${
                    isLoadingAI ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {isLoadingAI ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>
              </div>
            ) : (
              /* Active recording state: Timer + Multi-control group (Pause / Resume / Stop / Stamp) */
              <div className="flex flex-col items-center gap-3 w-full">
                {/* Visual pulse indicator */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isAudioPaused ? "bg-amber-500" : "bg-red-500 animate-ping"
                    }`}
                  />
                  <span
                    className={`font-mono text-2xl font-bold tracking-wider ${
                      isAudioPaused
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatTime(audioDuration)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isAudioPaused
                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                        : "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800"
                    }`}
                  >
                    {isAudioPaused ? "Đã tạm dừng" : "Đang ghi âm"}
                  </span>
                </div>

                {/* Control Action Buttons Row */}
                <div className="flex items-center gap-2.5 flex-wrap justify-center mt-1">
                  {/* Pause / Resume Button */}
                  {isAudioPaused ? (
                    <button
                      type="button"
                      id="btn-resume-recording"
                      onClick={resumeAudioRecording}
                      title="Tiếp tục thu âm giọng nói"
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all ring-2 ring-emerald-300 dark:ring-emerald-900 animate-pulse"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Tiếp tục nói</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="btn-pause-recording"
                      onClick={pauseAudioRecording}
                      title="Tạm dừng ghi âm và tự động chèn mốc thời gian vào văn bản"
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition-all ring-2 ring-amber-200 dark:ring-amber-900"
                    >
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Tạm dừng</span>
                    </button>
                  )}

                  {/* Stop & Finish Button */}
                  <button
                    type="button"
                    id="btn-stop-recording"
                    onClick={handleToggleRecording}
                    title="Dừng ghi âm và lưu bản ghi"
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition-all ring-2 ring-red-200 dark:ring-red-950"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Dừng & Hoàn tất</span>
                  </button>

                  {/* Instant Timestamp Insert Button */}
                  {onInsertManualTimestamp && (
                    <button
                      type="button"
                      id="btn-insert-recording-timestamp"
                      onClick={() => onInsertManualTimestamp(audioDuration)}
                      title={`Chèn mốc thời gian [${formatTimestamp(audioDuration)}] vào vị trí hiện tại`}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-600 shadow-2xs transition-all"
                    >
                      <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>+ Mốc {formatTimestamp(audioDuration)}</span>
                    </button>
                  )}
                </div>

                {isAudioPaused && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-800/60 mt-1">
                    Đã chèn mốc {formatTimestamp(audioDuration)} vào văn bản. Bấm "Tiếp tục nói" khi bạn sẵn sàng.
                  </p>
                )}
              </div>
            )}

            {/* Timer & Status text for idle state */}
            {!isAnyRecording && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold">
                  <span className="text-slate-600 dark:text-slate-300">
                    Bấm để bắt đầu nói
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Tự động ngắt câu, chèn mốc thời gian, lọc tạp âm và nhận diện giọng nói chính xác.
                </p>
              </div>
            )}

            {/* Timestamping Setting Card */}
            <div className="w-full max-w-md p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                    <span>Tự động chèn mốc thời gian</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      Mỗi 30s & Tạm dừng
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Chèn [00:30], [01:00]... mỗi 30 giây hoặc khi bấm tạm dừng
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-toggle-timestamping"
                role="switch"
                aria-checked={isTimestampingEnabled}
                onClick={() => onToggleTimestamping?.(!isTimestampingEnabled)}
                title={isTimestampingEnabled ? "Tắt tự động chèn mốc thời gian" : "Bật tự động chèn mốc thời gian"}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isTimestampingEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isTimestampingEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Audio Playback of the last recording */}
            {audioUrl && !isAnyRecording && (
              <div className="w-full mt-2 flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                <AudioPlayerControl audioUrl={audioUrl} fileName="ghi-am-giong-noi.webm" />
                <button
                  type="button"
                  onClick={() => {
                    if (lastRecordedBlob) {
                      handleTranscribeBlob(
                        lastRecordedBlob,
                        "Đang dùng Gemini AI chuyển đổi lại toàn diện bản ghi âm với độ chính xác cao nhất..."
                      );
                    } else {
                      fetch(audioUrl)
                        .then((r) => r.blob())
                        .then((blob) =>
                          handleTranscribeBlob(
                            blob,
                            "Đang dùng Gemini AI chuyển đổi lại toàn diện bản ghi âm với độ chính xác cao nhất..."
                          )
                        );
                    }
                  }}
                  disabled={isLoadingAI}
                  className="self-center flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Dùng Gemini AI chuyển đổi lại bản ghi (Độ chính xác cao nhất)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Audio File Upload */}
      {activeTab === "upload" && (
        <div className="p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.aac,.flac"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          {/* Auto-detect Language Toggle Card */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl mb-4 transition-all">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Languages className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Tự động nhận diện ngôn ngữ (Auto Language Detection)
                  </span>
                  <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded">
                    Gemini AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tự động phân tích giọng nói trong tệp, chuyển đổi <span className="font-semibold text-slate-700 dark:text-slate-300">selectedLanguage</span> tương ứng trước khi tiến hành phiên âm
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                id="toggle-auto-detect-lang"
                checked={autoDetectLanguage}
                onChange={(e) => setAutoDetectLanguage(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
              isDragOver
                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                : "border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-900/30"
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
              {isLoadingAI ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : (
                <FileAudio className="w-7 h-7" />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {uploadedFile ? uploadedFile.name : "Kéo thả hoặc bấm để tải lên tệp ghi âm"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Hỗ trợ MP3, WAV, M4A, WEBM, OGG, AAC (Tối đa 25MB)
              </p>
            </div>

            <button
              type="button"
              className="mt-2 px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs"
            >
              Chọn tệp từ máy tính
            </button>
          </div>

          {/* Detected Language Banner */}
          {detectedLanguageInfo && (
            <div className="mt-4 p-3.5 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                  {detectedLanguageInfo.language.flag}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Đã phát hiện: {detectedLanguageInfo.language.name} ({detectedLanguageInfo.language.englishName})
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-200/70 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-md">
                      {Math.round(detectedLanguageInfo.confidence * 100)}% tin cậy
                    </span>
                  </div>
                  {detectedLanguageInfo.explanation && (
                    <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90 mt-0.5">
                      {detectedLanguageInfo.explanation}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100/80 dark:bg-emerald-900/80 rounded-lg text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Đã chuyển đổi selectedLanguage</span>
              </div>
            </div>
          )}

          {/* Uploaded Audio Playback */}
          {uploadedAudioUrl && !isLoadingAI && (
            <div className="mt-4">
              <AudioPlayerControl
                audioUrl={uploadedAudioUrl}
                fileName={uploadedFile?.name || "audio-file.mp3"}
              />
              <div className="mt-2.5 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  id="btn-redetect-lang"
                  onClick={handleReDetectLanguageOnly}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Nhận diện lại ngôn ngữ & Chuyển đổi</span>
                </button>
                <button
                  type="button"
                  id="btn-retranscribe-file"
                  onClick={() => uploadedFile && processAndTranscribeUploadedFile(uploadedFile, false)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Chuyển đổi lại tệp này</span>
                </button>
              </div>
            </div>
          )}

          {uploadProgress && (
            <div className="mt-4 p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center gap-3 text-xs text-indigo-700 dark:text-indigo-300">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>{uploadProgress}</span>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Sample Recordings */}
      {activeTab === "samples" && (
        <div className="p-6">
          <div className="mb-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Chọn mẫu có sẵn để trải nghiệm ngay:
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Bấm vào bất kỳ tình huống nào dưới đây để nạp văn bản mẫu và kiểm tra tính năng tóm tắt thông minh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SAMPLE_RECORDINGS.map((sample) => (
              <div
                key={sample.id}
                onClick={() => handleSelectSample(sample)}
                className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl hover:border-indigo-500 hover:shadow-xs cursor-pointer transition-all duration-150 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                      {sample.category}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {sample.duration}
                    </span>
                  </div>
                  <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {sample.title}
                  </h5>
                  <p className="text-[11px] text-slate-400 line-clamp-3 mt-1.5 leading-relaxed">
                    {sample.text}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                  <span>Sử dụng mẫu này</span>
                  <span>{sample.language === "vi-VN" ? "🇻🇳 Tiếng Việt" : "🇺🇸 English"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vocabulary Hints Collapsible Bar */}
      <div className="border-t border-slate-200/70 dark:border-slate-700/70 bg-slate-50/40 dark:bg-slate-850/40 px-4 py-2">
        <button
          type="button"
          onClick={() => setIsVocabOpen(!isVocabOpen)}
          className="w-full flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 py-1"
        >
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold">Từ vựng chuyên môn & Thuật ngữ tùy chỉnh</span>
            {vocabularyHint && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono">
                Đã thêm từ khóa
              </span>
            )}
          </div>
          {isVocabOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {isVocabOpen && (
          <div className="mt-2 pb-2 space-y-2">
            <input
              type="text"
              value={vocabularyHint}
              onChange={(e) => setVocabularyHint(e.target.value)}
              placeholder="Nhập tên riêng, biệt ngữ, thuật ngữ (ví dụ: Gemini, React, Kubernetes, FinTech)..."
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <span className="text-slate-400">Gợi ý nhanh:</span>
              {[
                "AI, LLM, Gemini, Deep Learning",
                "Frontend, Backend, Cloud, API",
                "Doanh thu, ROI, KPI, Budget",
                "Chuẩn đoán, Điều trị, Dược phẩm",
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setVocabularyHint(
                      vocabularyHint ? `${vocabularyHint}, ${preset}` : preset
                    )
                  }
                  className="px-2 py-0.5 bg-slate-200/70 dark:bg-slate-700/60 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 rounded-md transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

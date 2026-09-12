import React, { useState } from "react";
import {
  Copy,
  Check,
  Wand2,
  Volume2,
  VolumeX,
  Download,
  Trash2,
  Globe,
  Languages,
  Loader2,
  FileText,
  Clock,
  Sparkles,
  Users,
  MessageSquare,
  Search,
  X,
  Gauge,
  Activity,
  Share2,
  Type,
} from "lucide-react";
import { refineTranscript, diarizeTranscript, translateContent } from "../services/apiService";
import { SupportedLanguage } from "../types";
import { SUPPORTED_LANGUAGES } from "../data/languages";
import { generateSrt, generateVtt } from "../utils/subtitleGenerator";
import { formatTimestamp, hasTimestamps, stripTimestamps } from "../utils/timestampUtils";

interface TranscriptViewProps {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  onTranscriptChange: (text: string) => void;
  onClear: () => void;
  currentLanguage: SupportedLanguage;
  onError: (msg: string) => void;
  onSuccessToast: (msg: string) => void;
  onOpenChat?: () => void;
  onOpenBilingual?: () => void;
  onOpenAnalytics?: () => void;
  onOpenExportModal?: () => void;
  onOpenShareModal?: () => void;
  onOpenTTS?: (text: string, title: string) => void;
  autoSaveStatus?: "saved" | "saving" | "idle";
  lastSavedTime?: string | null;
  audioDuration?: number;
  isAudioRecording?: boolean;
  isAudioPaused?: boolean;
  isTimestampingEnabled?: boolean;
  onToggleTimestamping?: (enabled: boolean) => void;
  onInsertManualTimestamp?: (seconds?: number) => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  transcript,
  interimTranscript,
  isListening,
  onTranscriptChange,
  onClear,
  currentLanguage,
  onError,
  onSuccessToast,
  onOpenChat,
  onOpenBilingual,
  onOpenAnalytics,
  onOpenExportModal,
  onOpenShareModal,
  onOpenTTS,
  autoSaveStatus,
  lastSavedTime,
  audioDuration = 0,
  isAudioRecording = false,
  isAudioPaused = false,
  isTimestampingEnabled = true,
  onToggleTimestamping,
  onInsertManualTimestamp,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetTranslateLang, setTargetTranslateLang] = useState<string>("en-US");
  const [showTranslateBar, setShowTranslateBar] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Search in transcript
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchWord, setSearchWord] = useState("");

  // Calculate metrics
  const fullContent = transcript + (interimTranscript ? " " + interimTranscript : "");
  const trimmed = fullContent.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const charCount = trimmed.length;
  const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 180));

  // Search match count
  const searchMatches = searchWord.trim()
    ? (fullContent.toLowerCase().match(new RegExp(searchWord.toLowerCase(), "g")) || []).length
    : 0;

  // Copy to clipboard
  const handleCopy = async () => {
    if (!trimmed) return;
    try {
      await navigator.clipboard.writeText(trimmed);
      setIsCopied(true);
      onSuccessToast("Đã sao chép văn bản vào bộ nhớ tạm!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      onError("Không thể sao chép văn bản.");
    }
  };

  const containsTimestamps = hasTimestamps(transcript);

  // Copy plain text without any [mm:ss] timestamps
  const handleCopyCleanWithoutTimestamps = async () => {
    if (!trimmed) return;
    const cleanText = stripTimestamps(trimmed);
    try {
      await navigator.clipboard.writeText(cleanText);
      setIsCopied(true);
      onSuccessToast("Đã sao chép văn bản (loại bỏ mốc thời gian)!");
      setTimeout(() => setIsCopied(false), 2000);
      setShowDownloadMenu(false);
    } catch {
      onError("Không thể sao chép văn bản.");
    }
  };

  // Strip timestamps from the live transcript
  const handleStripTimestamps = () => {
    if (!transcript.trim()) return;
    const cleanText = stripTimestamps(transcript);
    onTranscriptChange(cleanText);
    onSuccessToast("Đã xóa tất cả mốc thời gian khỏi văn bản!");
    setShowDownloadMenu(false);
  };

  // Export TXT file
  const handleDownloadTxt = () => {
    if (!trimmed) return;
    const blob = new Blob([trimmed], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voice-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccessToast("Đã tải tệp văn bản .txt thành công!");
    setShowDownloadMenu(false);
  };

  // Export SRT Subtitle file
  const handleDownloadSrt = () => {
    if (!trimmed) return;
    const srt = generateSrt(trimmed);
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles-${new Date().toISOString().slice(0, 10)}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccessToast("Đã tải tệp phụ đề .srt thành công!");
    setShowDownloadMenu(false);
  };

  // Export VTT Subtitle file
  const handleDownloadVtt = () => {
    if (!trimmed) return;
    const vtt = generateVtt(trimmed);
    const blob = new Blob([vtt], { type: "text/vtt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles-${new Date().toISOString().slice(0, 10)}.vtt`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccessToast("Đã tải tệp phụ đề WebVTT .vtt thành công!");
    setShowDownloadMenu(false);
  };

  // AI Refine (fix punctuation, typos, formatting)
  const handleRefine = async () => {
    if (!transcript.trim() || isRefining) return;
    setIsRefining(true);
    try {
      const refined = await refineTranscript(transcript, currentLanguage.name);
      onTranscriptChange(refined);
      onSuccessToast("AI đã chuẩn hóa dấu câu và cấu trúc đoạn!");
    } catch (err: any) {
      onError(err.message || "Không thể chuẩn hóa văn bản.");
    } finally {
      setIsRefining(false);
    }
  };

  // AI Diarize / Speaker breakdown
  const handleDiarize = async () => {
    if (!transcript.trim() || isDiarizing) return;
    setIsDiarizing(true);
    try {
      const diarized = await diarizeTranscript(transcript, currentLanguage.name);
      onTranscriptChange(diarized);
      onSuccessToast("Đã phân vai người nói & gắn mốc thời gian!");
    } catch (err: any) {
      onError(err.message || "Không thể phân vai người nói.");
    } finally {
      setIsDiarizing(false);
    }
  };

  // Text to Speech
  const handleToggleSpeak = () => {
    if (!window.speechSynthesis) {
      onError("Trình duyệt không hỗ trợ Text-to-Speech.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!trimmed) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = currentLanguage.code;
    utterance.rate = 1.0;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Quick Translate
  const handleQuickTranslate = async () => {
    if (!transcript.trim() || isTranslating) return;
    setIsTranslating(true);
    try {
      const target = SUPPORTED_LANGUAGES.find((l) => l.code === targetTranslateLang);
      const translated = await translateContent(
        transcript,
        target ? target.name : targetTranslateLang
      );
      onTranscriptChange(translated);
      setShowTranslateBar(false);
      onSuccessToast(`Đã dịch sang ${target?.name || targetTranslateLang}!`);
    } catch (err: any) {
      onError(err.message || "Không thể dịch văn bản.");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden flex flex-col h-full transition-all duration-200">
      {/* Header bar */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
              <span>Văn bản chuyển đổi</span>
              {isListening && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  Đang nhận diện
                </span>
              )}
              {autoSaveStatus === "saving" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 animate-pulse border border-indigo-200/50 dark:border-indigo-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Đang lưu...
                </span>
              )}
              {autoSaveStatus === "saved" && lastSavedTime && (
                <span
                  title="Đã lưu tự động an toàn vào bộ nhớ trình duyệt LocalStorage"
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60"
                >
                  <Check className="w-2.5 h-2.5" />
                  Đã lưu {lastSavedTime}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{wordCount} từ</span>
              <span>•</span>
              <span>{charCount} ký tự</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> ~{readTimeMinutes} phút đọc
              </span>
            </div>
          </div>
        </div>

        {/* Action icons & Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Word Count Indicator Badge */}
          <div
            id="toolbar-word-count-indicator"
            title={`Độ dài bản ghi: ${wordCount.toLocaleString()} từ • ${charCount.toLocaleString()} ký tự • Khoảng ${readTimeMinutes} phút đọc`}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all select-none ${
              wordCount > 0
                ? "bg-slate-50 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 shadow-2xs"
                : "bg-slate-50/60 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 border-dashed border-slate-200 dark:border-slate-750"
            }`}
          >
            <Type className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
              {wordCount.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">từ</span>
            {wordCount > 0 && (
              <span className="hidden md:inline-block text-[10px] text-slate-400 dark:text-slate-500 font-normal pl-1 border-l border-slate-200 dark:border-slate-700">
                ~{readTimeMinutes}m
              </span>
            )}
          </div>

          {/* Quick Timestamp Insertion Button */}
          {onInsertManualTimestamp && (
            <button
              type="button"
              id="btn-insert-timestamp-toolbar"
              onClick={() => onInsertManualTimestamp(audioDuration)}
              title={`Chèn mốc thời gian [${formatTimestamp(audioDuration || 0)}] vào văn bản`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-750 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">+ Mốc [{formatTimestamp(audioDuration || 0).replace(/[\[\]]/g, "")}]</span>
            </button>
          )}

          {/* AI Refine button */}
          <button
            type="button"
            id="btn-ai-refine"
            onClick={handleRefine}
            disabled={!transcript.trim() || isRefining || isListening}
            title="Dùng AI sửa lỗi chính tả, ngắt đoạn và dấu câu chuẩn xác"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRefining ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            )}
            <span className="hidden sm:inline">Chuẩn hóa AI</span>
          </button>

          {/* Diarization button */}
          <button
            type="button"
            id="btn-ai-diarize"
            onClick={handleDiarize}
            disabled={!transcript.trim() || isDiarizing || isListening}
            title="Tự động phân vai người nói & gắn mốc thời gian"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDiarizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            )}
            <span className="hidden sm:inline">Phân vai</span>
          </button>

          {/* Ask AI about transcript */}
          {onOpenChat && (
            <button
              type="button"
              id="btn-ask-transcript"
              onClick={onOpenChat}
              disabled={!trimmed}
              title="Hỏi đáp thông minh về bài nói"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Hỏi đáp AI</span>
            </button>
          )}

          {/* Search button */}
          <button
            type="button"
            onClick={() => setShowSearchBar(!showSearchBar)}
            disabled={!trimmed}
            title="Tìm từ trong văn bản"
            className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
              showSearchBar
                ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300"
                : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Read aloud TTS */}
          <button
            type="button"
            id="btn-read-aloud"
            onClick={() => {
              if (onOpenTTS) {
                onOpenTTS(trimmed, "Bản ghi âm lời nói");
              } else {
                handleToggleSpeak();
              }
            }}
            disabled={!trimmed}
            title={isSpeaking ? "Dừng đọc" : "Đọc to văn bản (TTS AI & Trình duyệt)"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              isSpeaking
                ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 ring-2 ring-amber-400"
                : "bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shadow-2xs"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isSpeaking ? (
              <VolumeX className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            )}
            <span className="hidden sm:inline">Đọc bản ghi (TTS)</span>
          </button>

          {/* Bilingual Dual-View trigger */}
          {onOpenBilingual && (
            <button
              type="button"
              id="btn-bilingual-view"
              onClick={onOpenBilingual}
              disabled={!trimmed}
              title="Đối chiếu văn bản song ngữ"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Languages className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Song ngữ</span>
            </button>
          )}

          {/* Speech Analytics trigger */}
          {onOpenAnalytics && (
            <button
              type="button"
              id="btn-speech-analytics"
              onClick={onOpenAnalytics}
              disabled={!trimmed}
              title="Phân tích tốc độ nói (WPM) & từ vựng"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Activity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Chỉ số</span>
            </button>
          )}

          {/* Quick Translate toggle */}
          <button
            type="button"
            id="btn-quick-translate"
            onClick={() => setShowTranslateBar(!showTranslateBar)}
            disabled={!trimmed}
            title="Dịch văn bản sang ngôn ngữ khác"
            className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
              showTranslateBar
                ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300"
                : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Globe className="w-3.5 h-3.5" />
          </button>

          {/* Copy button */}
          <button
            type="button"
            id="btn-copy-transcript"
            onClick={handleCopy}
            disabled={!trimmed}
            title="Sao chép toàn bộ văn bản"
            className="p-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Share button */}
          {onOpenShareModal && (
            <button
              type="button"
              id="btn-share-transcript"
              onClick={onOpenShareModal}
              disabled={!trimmed}
              title="Tạo liên kết chia sẻ tạm thời (Shareable Hash Link)"
              className="p-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Direct HTML Download button */}
          {onOpenExportModal && (
            <button
              type="button"
              id="btn-direct-download-html"
              onClick={onOpenExportModal}
              disabled={!trimmed}
              title="Tải tệp HTML offline độc lập (kèm audio phát lại và bộ đọc giọng nói TTS)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Tải HTML</span>
            </button>
          )}

          {/* Download Menu (TXT, SRT, VTT) */}
          <div className="relative">
            <button
              type="button"
              id="btn-download-menu"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={!trimmed}
              title="Xuất file (TXT, SRT, VTT)"
              className="p-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {showDownloadMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30 animate-in fade-in zoom-in-95">
                {onOpenShareModal && (
                  <>
                    <button
                      type="button"
                      id="btn-menu-share-link"
                      onClick={() => {
                        setShowDownloadMenu(false);
                        onOpenShareModal();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center justify-between group"
                    >
                      <span className="font-semibold text-purple-600 dark:text-purple-400">Sao chép Link chia sẻ</span>
                      <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.5 rounded">#share</span>
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                  </>
                )}
                {onOpenExportModal && (
                  <>
                    <button
                      type="button"
                      id="btn-download-html-offline"
                      onClick={() => {
                        setShowDownloadMenu(false);
                        onOpenExportModal();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between group"
                    >
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Tệp HTML offline</span>
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">.html</span>
                    </button>
                    <button
                      type="button"
                      id="btn-download-docx"
                      onClick={() => {
                        setShowDownloadMenu(false);
                        onOpenExportModal();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between group"
                    >
                      <span className="font-semibold text-blue-600 dark:text-blue-400">Tài liệu Word</span>
                      <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded">.docx</span>
                    </button>
                    <button
                      type="button"
                      id="btn-download-pdf"
                      onClick={() => {
                        setShowDownloadMenu(false);
                        onOpenExportModal();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-between group"
                    >
                      <span className="font-semibold text-red-600 dark:text-red-400">Tài liệu PDF</span>
                      <span className="text-[10px] font-mono font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/60 px-1.5 py-0.5 rounded">.pdf</span>
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                  </>
                )}
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                >
                  <span>Tệp văn bản thô</span>
                  <span className="text-[10px] font-mono text-slate-400">.txt</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSrt}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                >
                  <span>Phụ đề SubRip</span>
                  <span className="text-[10px] font-mono text-indigo-500 font-semibold">.srt</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadVtt}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                >
                  <span>Phụ đề WebVTT</span>
                  <span className="text-[10px] font-mono text-indigo-500 font-semibold">.vtt</span>
                </button>
                {containsTimestamps && (
                  <>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                    <button
                      type="button"
                      id="btn-copy-clean-text"
                      onClick={handleCopyCleanWithoutTimestamps}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                    >
                      <span>Sao chép bỏ mốc thời gian</span>
                      <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">Clean</span>
                    </button>
                    <button
                      type="button"
                      id="btn-strip-timestamps"
                      onClick={handleStripTimestamps}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-between"
                    >
                      <span>Xóa hết mốc thời gian</span>
                      <span className="text-[10px] font-mono text-red-500">Xóa</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Clear button */}
          <button
            type="button"
            id="btn-clear-transcript"
            onClick={onClear}
            disabled={!trimmed && !interimTranscript}
            title="Xóa nội dung"
            className="p-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-600 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Search Bar */}
      {showSearchBar && (
        <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
            placeholder="Tìm từ khóa trong văn bản..."
            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          {searchWord && (
            <span className="text-[11px] text-slate-500 font-mono">
              {searchMatches} kết quả
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchWord("");
              setShowSearchBar(false);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Translate Bar */}
      {showTranslateBar && (
        <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1">
            <Languages className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Dịch sang:
            </span>
            <select
              value={targetTranslateLang}
              onChange={(e) => setTargetTranslateLang(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name} ({lang.englishName})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleQuickTranslate}
            disabled={isTranslating}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs transition-all"
          >
            {isTranslating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Dịch ngay</span>
          </button>
        </div>
      )}

      {/* Main Text Area with real-time stream support */}
      <div className="relative flex-1 min-h-[260px] p-4 flex flex-col">
        <textarea
          id="textarea-transcript"
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          placeholder="Nội dung giọng nói của bạn sẽ xuất hiện tại đây theo thời gian thực... Bạn cũng có thể gõ hoặc chỉnh sửa trực tiếp."
          className="w-full flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none font-normal"
        />

        {/* Interim word stream when speaking */}
        {interimTranscript && (
          <div className="mt-2 p-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/40 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 italic flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping shrink-0" />
            <span>{interimTranscript}</span>
          </div>
        )}
      </div>

      {/* Real-time Status Footer */}
      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 select-none">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
            <Type className="w-3 h-3 text-indigo-500" />
            {wordCount.toLocaleString()} từ
          </span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span>{charCount.toLocaleString()} ký tự</span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" /> ~{readTimeMinutes} phút đọc
          </span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <button
            type="button"
            id="footer-timestamping-toggle"
            onClick={() => onToggleTimestamping?.(!isTimestampingEnabled)}
            title="Nhấn để bật/tắt tự động chèn mốc thời gian [mm:ss] mỗi 30 giây hoặc khi tạm dừng"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
              isTimestampingEnabled
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 line-through"
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Mốc thời gian: {isTimestampingEnabled ? "Bật (30s & Tạm dừng)" : "Tắt"}</span>
          </button>
        </div>
        <div className="text-[11px] text-slate-400">
          {isListening ? (
            <span className="text-red-500 dark:text-red-400 font-medium animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Đang nhận diện trực tiếp
            </span>
          ) : (
            <span>Tự động cập nhật trực tiếp</span>
          )}
        </div>
      </div>
    </div>
  );
};

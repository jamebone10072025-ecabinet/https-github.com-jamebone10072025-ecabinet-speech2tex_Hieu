/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Mic,
  Sparkles,
  History,
  Plus,
  Languages,
  Moon,
  Sun,
  AlertCircle,
  CheckCircle2,
  X,
  FileAudio,
  Volume2,
  ChevronRight,
  Play,
  FileDown,
  Share2,
  Save,
  Loader2,
  Globe,
} from "lucide-react";
import { SupportedLanguage, SummaryResult, SummaryStyle, SummaryLength, SpeechSessionItem, SessionCategory } from "./types";
import { SUPPORTED_LANGUAGES, SAMPLE_RECORDINGS } from "./data/languages";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { SpeechInputSection } from "./components/SpeechInputSection";
import { TranscriptView } from "./components/TranscriptView";
import { SummarySection } from "./components/SummarySection";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { TranscriptChatModal } from "./components/TranscriptChatModal";
import { BilingualComparisonModal } from "./components/BilingualComparisonModal";
import { SpeechAnalyticsModal } from "./components/SpeechAnalyticsModal";
import { ExportDocumentModal } from "./components/ExportDocumentModal";
import { ShareLinkModal } from "./components/ShareLinkModal";
import { TTSPlayerBar } from "./components/TTSPlayerBar";
import { TextToSpeechModal } from "./components/TextToSpeechModal";
import { parseShareableHash, clearShareHash } from "./utils/shareableLink";
import { summarizeTranscript } from "./services/apiService";
import { formatTimestamp } from "./utils/timestampUtils";

const STORAGE_KEY = "voice_transcripts_sessions_v1";
const DRAFT_STORAGE_KEY = "voice_transcripts_draft_v2";

export interface AutoSaveDraft {
  sessionId: string;
  sessionTitle: string;
  category: SessionCategory;
  transcript: string;
  summary: SummaryResult | null;
  languageCode: string;
  updatedAt: number;
}

const loadSavedDraft = (): AutoSaveDraft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.transcript === "string" && parsed.transcript.trim().length > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const SESSION_CATEGORIES: SessionCategory[] = [
  "Cuộc họp",
  "Phỏng vấn",
  "Ý tưởng",
  "Học tập",
  "Cá nhân",
];

export default function App() {
  const [initialDraft] = useState<AutoSaveDraft | null>(() => loadSavedDraft());
  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(() => !!loadSavedDraft());
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    const draft = loadSavedDraft();
    if (draft?.updatedAt) {
      return new Date(draft.updatedAt).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
    return null;
  });

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(() => {
    if (initialDraft?.languageCode) {
      const match = SUPPORTED_LANGUAGES.find(
        (l) => l.code === initialDraft.languageCode || l.recognitionCode === initialDraft.languageCode
      );
      if (match) return match;
    }
    return SUPPORTED_LANGUAGES[0]; // Default: Tiếng Việt (vi-VN)
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => initialDraft?.sessionId || Date.now().toString()
  );
  const [sessionTitle, setSessionTitle] = useState<string>(
    () => initialDraft?.sessionTitle || "Bản ghi âm mới"
  );
  const [activeCategory, setActiveCategory] = useState<SessionCategory>(
    () => initialDraft?.category || "Cuộc họp"
  );
  const [summary, setSummary] = useState<SummaryResult | null>(
    () => initialDraft?.summary || null
  );
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
  const [autoSummarize, setAutoSummarize] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isBilingualOpen, setIsBilingualOpen] = useState<boolean>(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isViewingShared, setIsViewingShared] = useState<boolean>(false);
  const [shareTargetSession, setShareTargetSession] = useState<{
    title: string;
    category?: SessionCategory | string;
    languageName?: string;
    transcript: string;
    summary: SummaryResult | null;
  } | null>(null);
  const [sessions, setSessions] = useState<SpeechSessionItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Toasts
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ id: Date.now(), type, message });
    setTimeout(() => {
      setToast((cur) => (cur?.message === message ? null : cur));
    }, 4000);
  }, []);

  const [toast, setToast] = useState<{
    id: number;
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Text-to-Speech active state
  const [ttsState, setTtsState] = useState<{
    isOpen: boolean;
    title: string;
    sourceType: "transcript" | "summary";
    text: string;
  }>({
    isOpen: false,
    title: "",
    sourceType: "transcript",
    text: "",
  });

  const handleOpenTTS = useCallback(
    (textToRead: string, title: string, sourceType: "transcript" | "summary" = "transcript") => {
      if (!textToRead || !textToRead.trim()) {
        showToast("Không có nội dung văn bản để đọc.", "error");
        return;
      }
      setTtsState({
        isOpen: true,
        title,
        sourceType,
        text: textToRead.trim(),
      });
    },
    [showToast]
  );

  // Sync dark mode class on HTML root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn("Lỗi lưu localStorage:", e);
    }
  }, [sessions]);

  // Speech Recognition hook - initial transcript restored from draft if exists
  const {
    isListening,
    speechState,
    transcript,
    interimTranscript,
    error: speechError,
    isSupported: isWebSpeechSupported,
    setSelectedLang: setRecognitionLang,
    startListening,
    pauseListening,
    resumeListening,
    stopListening,
    insertTimestamp,
    resetTranscript,
    setManualTranscript,
  } = useSpeechRecognition(
    selectedLanguage.recognitionCode,
    initialDraft?.transcript || ""
  );

  // Dedicated Text-to-Speech Studio Modal state
  const [isTTSStudioOpen, setIsTTSStudioOpen] = useState<boolean>(false);
  const [ttsStudioInitialText, setTtsStudioInitialText] = useState<string>("");
  const [ttsStudioInitialMode, setTtsStudioInitialMode] = useState<"text" | "file">("text");

  const handleOpenTTSStudio = useCallback(
    (initialTextToUse?: string, mode: "text" | "file" = "text") => {
      setTtsStudioInitialText(initialTextToUse !== undefined ? initialTextToUse : transcript);
      setTtsStudioInitialMode(mode);
      setIsTTSStudioOpen(true);
    },
    [transcript]
  );

  // Auto-save transcript & session draft to LocalStorage
  useEffect(() => {
    // If empty transcript and no summary, remove draft
    if (!transcript.trim() && !summary) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setAutoSaveStatus("idle");
      } catch (e) {
        console.warn("Lỗi xóa draft LocalStorage:", e);
      }
      return;
    }

    setAutoSaveStatus("saving");

    const timer = setTimeout(() => {
      try {
        const draft: AutoSaveDraft = {
          sessionId: activeSessionId,
          sessionTitle,
          category: activeCategory,
          transcript,
          summary,
          languageCode: selectedLanguage.code,
          updatedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        setAutoSaveStatus("saved");
        setLastSavedTime(
          new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch (e) {
        console.warn("Lỗi tự động lưu bản nháp vào LocalStorage:", e);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [transcript, sessionTitle, activeCategory, summary, selectedLanguage, activeSessionId]);

  // Synchronous flush on window beforeunload (close tab or refresh)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (transcript.trim() || summary) {
        const draft: AutoSaveDraft = {
          sessionId: activeSessionId,
          sessionTitle,
          category: activeCategory,
          transcript,
          summary,
          languageCode: selectedLanguage.code,
          updatedAt: Date.now(),
        };
        try {
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [transcript, sessionTitle, activeCategory, summary, selectedLanguage, activeSessionId]);

  // Audio Recorder hook
  const {
    isRecording: isAudioRecording,
    isPaused: isAudioPaused,
    duration: audioDuration,
    analyserNode,
    audioLevel,
    isSilent,
    startRecording: startAudioRecording,
    pauseRecording: pauseAudioRecorderAction,
    resumeRecording: resumeAudioRecorderAction,
    stopRecording: stopAudioRecording,
    audioUrl,
    resetRecording: resetAudioRecording,
    error: audioError,
  } = useAudioRecorder();

  // Timestamping configuration & auto-insertion state
  const [isTimestampingEnabled, setIsTimestampingEnabled] = useState<boolean>(true);
  const lastAutoTimestampBucketRef = useRef<number>(0);

  // Pause recording: pause media recorder + speech recognition and insert timestamp
  const handlePauseRecording = useCallback(() => {
    pauseAudioRecorderAction();
    pauseListening();
    if (isTimestampingEnabled) {
      insertTimestamp(audioDuration);
      showToast(`Đã chèn mốc thời gian [${formatTimestamp(audioDuration)}] khi tạm dừng ghi âm.`, "success");
    }
  }, [pauseAudioRecorderAction, pauseListening, isTimestampingEnabled, insertTimestamp, audioDuration, showToast]);

  // Resume recording: resume media recorder + speech recognition
  const handleResumeRecording = useCallback(() => {
    resumeAudioRecorderAction();
    resumeListening();
    showToast("Đang tiếp tục ghi âm...", "success");
  }, [resumeAudioRecorderAction, resumeListening, showToast]);

  // Manual timestamp insertion triggered by button
  const handleInsertManualTimestamp = useCallback((seconds?: number) => {
    const sec = seconds !== undefined ? seconds : audioDuration;
    insertTimestamp(sec);
    showToast(`Đã chèn mốc thời gian [${formatTimestamp(sec)}]!`, "success");
  }, [audioDuration, insertTimestamp, showToast]);

  // Auto-insert timestamp every 30 seconds of active recording
  useEffect(() => {
    if (!isTimestampingEnabled || !isAudioRecording || isAudioPaused) return;

    if (audioDuration >= 30) {
      const current30sBucket = Math.floor(audioDuration / 30) * 30;
      if (current30sBucket > lastAutoTimestampBucketRef.current) {
        lastAutoTimestampBucketRef.current = current30sBucket;
        insertTimestamp(current30sBucket);
        showToast(`Đã tự động chèn mốc thời gian [${formatTimestamp(current30sBucket)}] (30 giây)!`, "success");
      }
    }
  }, [audioDuration, isAudioRecording, isAudioPaused, isTimestampingEnabled, insertTimestamp, showToast]);

  // Reset 30s bucket counter when recording stops or resets
  useEffect(() => {
    if (!isAudioRecording) {
      lastAutoTimestampBucketRef.current = 0;
    }
  }, [isAudioRecording]);

  // Watch for errors from hooks
  useEffect(() => {
    if (speechError) showToast(speechError, "error");
  }, [speechError, showToast]);

  useEffect(() => {
    if (audioError) showToast(audioError, "error");
  }, [audioError, showToast]);

  // Sync language selection
  const handleLanguageChange = (lang: SupportedLanguage) => {
    setSelectedLanguage(lang);
    setRecognitionLang(lang.recognitionCode);
  };

  // Generate Summary function
  const handleGenerateSummary = async (
    style: SummaryStyle = "executive",
    length: SummaryLength = "standard",
    targetLang: string = "auto"
  ) => {
    if (!transcript.trim()) {
      showToast("Chưa có nội dung văn bản để tóm tắt!", "error");
      return;
    }

    setIsSummarizing(true);
    try {
      const result = await summarizeTranscript({
        text: transcript,
        style,
        length,
        targetLanguage: targetLang,
      });
      setSummary(result);
      showToast("Tạo bản tóm tắt thành công!");

      // Update or insert into sessions history
      setSessions((prev) => {
        const existingIdx = prev.findIndex((s) => s.id === activeSessionId);
        const updatedItem: SpeechSessionItem = {
          id: activeSessionId,
          timestamp: Date.now(),
          title: sessionTitle !== "Bản ghi âm mới" ? sessionTitle : (result.title || "Ghi chú âm thanh"),
          category: activeCategory,
          transcript,
          language: selectedLanguage.name,
          summary: result,
          summaryStyle: style,
        };

        if (existingIdx >= 0) {
          const clone = [...prev];
          clone[existingIdx] = updatedItem;
          return clone;
        } else {
          return [updatedItem, ...prev];
        }
      });
    } catch (err: any) {
      showToast(err.message || "Không thể tạo bản tóm tắt.", "error");
    } finally {
      setIsSummarizing(false);
    }
  };

  // Auto-summarize trigger when transcription completes (if enabled)
  const handleTranscribeComplete = (newText: string) => {
    if (autoSummarize && newText.trim().length > 30) {
      handleGenerateSummary("executive", "standard", "auto");
    }
  };

  // Start new empty session
  const handleNewSession = () => {
    if (isListening) stopListening();
    if (isAudioRecording) stopAudioRecording();
    resetTranscript();
    resetAudioRecording();
    setSummary(null);
    setSessionTitle("Bản ghi âm mới");
    setActiveCategory("Cuộc họp");
    setActiveSessionId(Date.now().toString());
    setIsViewingShared(false);
    clearShareHash();
    setHasRestoredDraft(false);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setAutoSaveStatus("idle");
    setLastSavedTime(null);
    showToast("Đã khởi tạo phiên ghi âm mới!");
  };

  // Load session from shareable URL hash (#share=...) on initial load or on hash changes
  useEffect(() => {
    const checkAndLoadShareHash = () => {
      const payload = parseShareableHash();
      if (payload) {
        setSessionTitle(payload.t || "Bản ghi âm chia sẻ");
        if (payload.c) setActiveCategory(payload.c as SessionCategory);
        setManualTranscript(payload.tx);
        if (payload.s) setSummary(payload.s);
        if (payload.l) {
          const match = SUPPORTED_LANGUAGES.find(
            (l) =>
              l.name.toLowerCase() === payload.l?.toLowerCase() ||
              l.code.toLowerCase() === payload.l?.toLowerCase()
          );
          if (match) {
            setSelectedLanguage(match);
            setRecognitionLang(match.recognitionCode);
          }
        }
        setIsViewingShared(true);
        showToast(`Đã nạp nội dung chia sẻ: "${payload.t || "Bản ghi âm"}"`, "success");
      }
    };

    checkAndLoadShareHash();
    window.addEventListener("hashchange", checkAndLoadShareHash);
    return () => window.removeEventListener("hashchange", checkAndLoadShareHash);
  }, [setManualTranscript, setRecognitionLang, showToast]);

  // Save shared session into local user history
  const handleSaveSharedToHistory = () => {
    const newSession: SpeechSessionItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      title: sessionTitle || "Bản ghi âm chia sẻ",
      category: activeCategory,
      transcript,
      language: selectedLanguage.name,
      summary,
      summaryStyle: "executive",
    };
    setSessions((prev) => [newSession, ...prev]);
    clearShareHash();
    setIsViewingShared(false);
    showToast("Đã lưu bản ghi được chia sẻ vào Lịch sử của bạn!", "success");
  };

  const handleDismissShared = () => {
    clearShareHash();
    setIsViewingShared(false);
    showToast("Đã đóng chế độ xem chia sẻ.");
  };

  const handleOpenShareModalForCurrent = () => {
    setShareTargetSession(null);
    setIsShareModalOpen(true);
  };

  const handleOpenShareModalForHistoryItem = (item: SpeechSessionItem) => {
    setShareTargetSession({
      title: item.title || "Bản ghi âm",
      category: item.category,
      languageName: item.language,
      transcript: item.transcript,
      summary: item.summary || null,
    });
    setIsShareModalOpen(true);
  };

  // Restore session from History
  const handleSelectSession = (item: SpeechSessionItem) => {
    setActiveSessionId(item.id);
    setSessionTitle(item.title || "Bản ghi âm mới");
    if (item.category) setActiveCategory(item.category);
    setManualTranscript(item.transcript);
    setSummary(item.summary || null);
    const foundLang = SUPPORTED_LANGUAGES.find((l) => l.name === item.language);
    if (foundLang) setSelectedLanguage(foundLang);
    showToast(`Đã tải bản ghi: "${item.title}"`);
  };

  // Delete session from History
  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    showToast("Đã xóa bản ghi khỏi lịch sử.");
  };

  const handleClearAllHistory = () => {
    setSessions([]);
    showToast("Đã xóa sạch toàn bộ lịch sử.");
  };

  // Run full demo with sample data and AI summary
  const handleRunDemo = async () => {
    const demoSample = SAMPLE_RECORDINGS[0]; // Cuộc họp Chiến lược Quý 3 & Ra mắt Sản phẩm
    setSessionTitle(demoSample.title);
    setActiveCategory("Cuộc họp");
    setManualTranscript(demoSample.text);

    // Set language to Vietnamese
    const vnLang = SUPPORTED_LANGUAGES.find((l) => l.code === "vi-VN") || SUPPORTED_LANGUAGES[0];
    setSelectedLanguage(vnLang);
    setRecognitionLang(vnLang.recognitionCode);

    showToast("Đang nạp dữ liệu mẫu và tạo tóm tắt Gemini AI...", "success");

    setIsSummarizing(true);
    try {
      const result = await summarizeTranscript({
        text: demoSample.text,
        style: "executive",
        length: "standard",
        targetLanguage: "auto",
      });
      setSummary(result);
      showToast("Demo đã sẵn sàng! Bạn có thể thử Phân vai, Hỏi đáp AI, Xuất phụ đề hoặc xem Chỉ số.", "success");

      setSessions((prev) => {
        const demoItem: SpeechSessionItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          title: demoSample.title,
          category: "Cuộc họp",
          transcript: demoSample.text,
          language: vnLang.name,
          summary: result,
          summaryStyle: "executive",
        };
        return [demoItem, ...prev];
      });
    } catch (err: any) {
      showToast("Lỗi khi tạo tóm tắt demo: " + (err.message || "Vui lòng thử lại"), "error");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col font-sans transition-colors duration-200">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border backdrop-blur-md animate-in slide-in-from-top-3 duration-200 ${
            toast.type === "success"
              ? "bg-emerald-500/95 text-white border-emerald-400/50"
              : "bg-red-500/95 text-white border-red-400/50"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 opacity-80 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Ghi chép giọng nói AI
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800">
                  <Languages className="w-3 h-3" />
                  Đa ngôn ngữ & Tóm tắt tự động
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Chuyển giọng nói thành văn bản & đúc kết thông minh với Gemini 3.8
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            {/* Quick Demo Button */}
            <button
              type="button"
              id="btn-run-demo"
              onClick={handleRunDemo}
              disabled={isSummarizing}
              title="Chạy thử kịch bản mẫu đầy đủ tính năng"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Chạy demo</span>
            </button>

            {/* New Session Button */}
            <button
              type="button"
              id="btn-new-session"
              onClick={handleNewSession}
              title="Khởi tạo phiên mới"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Phiên mới</span>
            </button>

            {/* History Button with Count badge */}
            <button
              type="button"
              id="btn-open-history"
              onClick={() => setIsHistoryOpen(true)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden md:inline">Lịch sử</span>
              {sessions.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ml-0.5">
                  {sessions.length}
                </span>
              )}
            </button>

            {/* Text-to-Speech Studio Button */}
            <button
              type="button"
              id="btn-open-tts-studio"
              onClick={() => handleOpenTTSStudio(transcript || "")}
              title="Mở Studio đọc văn bản thành giọng nói (Text-to-Speech)"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 rounded-xl text-xs font-bold shadow-2xs transition-all"
            >
              <Volume2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Đọc văn bản (TTS)</span>
              <span className="sm:hidden">TTS</span>
            </button>

            {/* Direct Export HTML Offline Button */}
            <button
              type="button"
              id="btn-header-export-html"
              onClick={() => setIsExportModalOpen(true)}
              title="Tải tệp HTML offline độc lập chạy không cần mạng, hoặc xuất Word/PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800 rounded-xl text-xs font-bold shadow-2xs transition-all"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Tải HTML</span>
              <span className="hidden sm:inline-block text-[10px] font-mono font-bold bg-emerald-200/60 dark:bg-emerald-800/60 px-1 py-0.2 rounded text-emerald-800 dark:text-emerald-200">
                .html
              </span>
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              id="btn-toggle-dark-mode"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Section 1: Audio Input & Recording Panel */}
        <section id="section-speech-input">
          <SpeechInputSection
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
            onLanguageDetected={(lang, confidence) => {
              showToast(
                `✨ Đã tự động phát hiện ngôn ngữ: ${lang.flag} ${lang.name} (${Math.round(
                  confidence * 100
                )}% tin cậy). Đã tự động chuyển đổi sang ngôn ngữ này!`,
                "success"
              );
            }}
            isListening={isListening}
            startListening={startListening}
            stopListening={stopListening}
            isWebSpeechSupported={isWebSpeechSupported}
            onTranscriptAppend={(chunk) => {
              setManualTranscript(transcript ? transcript + " " + chunk : chunk);
            }}
            onTranscriptReplace={(fullText) => {
              setManualTranscript(fullText);
            }}
            onTranscribeComplete={handleTranscribeComplete}
            isAudioRecording={isAudioRecording}
            isAudioPaused={isAudioPaused}
            pauseAudioRecording={handlePauseRecording}
            resumeAudioRecording={handleResumeRecording}
            audioDuration={audioDuration}
            analyserNode={analyserNode}
            startAudioRecording={startAudioRecording}
            stopAudioRecording={stopAudioRecording}
            audioUrl={audioUrl}
            resetAudioRecording={resetAudioRecording}
            isLoadingAI={isLoadingAI}
            setIsLoadingAI={setIsLoadingAI}
            audioLevel={audioLevel}
            isSilent={isSilent}
            speechState={speechState}
            currentTranscript={transcript}
            onError={(msg) => showToast(msg, "error")}
            isTimestampingEnabled={isTimestampingEnabled}
            onToggleTimestamping={setIsTimestampingEnabled}
            onInsertManualTimestamp={handleInsertManualTimestamp}
          />
        </section>

        {/* Session Metadata Bar: Editable Title & Category */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <span className="text-xs font-bold text-slate-400">Tiêu đề:</span>
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Nhập tên phiên ghi âm..."
              className="flex-1 text-sm font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-indigo-500 focus:outline-none px-1 py-0.5"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Danh mục:</span>
            {SESSION_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeCategory === cat
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

            <button
              type="button"
              id="btn-open-export-modal"
              onClick={() => setIsExportModalOpen(true)}
              disabled={!transcript.trim()}
              title="Xuất bản ghi & tóm tắt ra tệp PDF hoặc Word"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Xuất PDF / Word</span>
            </button>

            <button
              type="button"
              id="btn-open-share-modal"
              onClick={handleOpenShareModalForCurrent}
              disabled={!transcript.trim()}
              title="Tạo đường dẫn chia sẻ tạm thời (Shareable Hash Link)"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Share2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Chia sẻ link</span>
            </button>

            {/* Auto-save Status Badge */}
            <div
              id="badge-autosave-status"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300"
              title="Tính năng tự động lưu bảo vệ dữ liệu vào LocalStorage tức thời khi chỉnh sửa hoặc nhận diện giọng nói"
            >
              {autoSaveStatus === "saving" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">Đang lưu...</span>
                </>
              ) : autoSaveStatus === "saved" && lastSavedTime ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    Đã lưu {lastSavedTime}
                  </span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-400 font-medium">Tự động lưu: Bật</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Restored Auto-saved Draft Notice */}
        {hasRestoredDraft && transcript.trim() && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Save className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Đã khôi phục bản ghi nháp chưa lưu trước đó
                  </span>
                  {lastSavedTime && (
                    <span className="px-2 py-0.5 bg-emerald-200/70 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold rounded-md">
                      Lưu lúc: {lastSavedTime}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                  Mọi nội dung trước khi đóng ứng dụng đã được bảo toàn tự động trong LocalStorage để bạn không bị gián đoạn công việc.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                id="btn-keep-restored-draft"
                onClick={() => setHasRestoredDraft(false)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tiếp tục bản ghi này</span>
              </button>
              <button
                type="button"
                id="btn-discard-restored-draft"
                onClick={handleNewSession}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
              >
                Tạo bản mới
              </button>
            </div>
          </div>
        )}

        {/* Shared Session Banner if opened via hash link */}
        {isViewingShared && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 rounded-2xl shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                    Đang xem bản ghi được chia sẻ qua liên kết URL Hash
                  </span>
                  <span className="px-1.5 py-0.5 bg-purple-200/70 dark:bg-purple-900/70 text-purple-800 dark:text-purple-300 text-[10px] font-mono font-bold rounded">
                    #share
                  </span>
                </div>
                <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80">
                  Dữ liệu được trích xuất trực tiếp từ đường dẫn hash. Bạn có thể xem, chỉnh sửa, xuất văn bản hoặc lưu vĩnh viễn vào lịch sử.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                id="btn-save-shared-history"
                onClick={handleSaveSharedToHistory}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Lưu vào Lịch sử</span>
              </button>
              <button
                type="button"
                id="btn-dismiss-shared"
                onClick={handleDismissShared}
                className="px-2.5 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* Quick Demo CTA Banner when empty */}
        {!transcript.trim() && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Trải nghiệm nhanh ứng dụng không cần thu âm
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Nhấn "Chạy Demo" để tự động nạp kịch bản cuộc họp doanh nghiệp và đúc kết qua Gemini AI
                </p>
              </div>
            </div>
            <button
              type="button"
              id="btn-banner-demo"
              onClick={handleRunDemo}
              disabled={isSummarizing}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Chạy thử demo ngay</span>
            </button>
          </div>
        )}

        {/* Section 2: Split Workspace (Transcript & AI Summary) */}
        <section
          id="section-workspace"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch flex-1 min-h-[520px]"
        >
          {/* Column 1: Live Transcript View */}
          <div className="flex flex-col h-full">
            <TranscriptView
              transcript={transcript}
              interimTranscript={interimTranscript}
              isListening={isListening}
              onTranscriptChange={setManualTranscript}
              onClear={() => {
                resetTranscript();
                setSummary(null);
                try {
                  localStorage.removeItem(DRAFT_STORAGE_KEY);
                } catch {
                  // ignore
                }
                setAutoSaveStatus("idle");
                setLastSavedTime(null);
                setHasRestoredDraft(false);
                showToast("Đã xóa nội dung!");
              }}
              currentLanguage={selectedLanguage}
              onError={(msg) => showToast(msg, "error")}
              onSuccessToast={(msg) => showToast(msg, "success")}
              onOpenChat={() => setIsChatOpen(true)}
              onOpenBilingual={() => setIsBilingualOpen(true)}
              onOpenAnalytics={() => setIsAnalyticsOpen(true)}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenShareModal={handleOpenShareModalForCurrent}
              onOpenTTS={(text, title) => handleOpenTTS(text, title, "transcript")}
              autoSaveStatus={autoSaveStatus}
              lastSavedTime={lastSavedTime}
              audioDuration={audioDuration}
              isAudioRecording={isAudioRecording}
              isAudioPaused={isAudioPaused}
              isTimestampingEnabled={isTimestampingEnabled}
              onToggleTimestamping={setIsTimestampingEnabled}
              onInsertManualTimestamp={handleInsertManualTimestamp}
            />
          </div>

          {/* Column 2: Automatic Content Summarization */}
          <div className="flex flex-col h-full">
            <SummarySection
              transcript={transcript}
              summary={summary}
              isLoading={isSummarizing}
              onGenerateSummary={handleGenerateSummary}
              autoSummarize={autoSummarize}
              onToggleAutoSummarize={setAutoSummarize}
              onError={(msg) => showToast(msg, "error")}
              onSuccessToast={(msg) => showToast(msg, "success")}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenShareModal={handleOpenShareModalForCurrent}
              onOpenTTS={(text, title) => handleOpenTTS(text, title, "summary")}
            />
          </div>
        </section>
      </main>

      {/* History Slide-over Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onClearAll={handleClearAllHistory}
        onShareSession={handleOpenShareModalForHistoryItem}
      />

      {/* Transcript Q&A Chat Modal */}
      <TranscriptChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        transcript={transcript}
      />

      {/* Bilingual Comparison Modal */}
      <BilingualComparisonModal
        isOpen={isBilingualOpen}
        onClose={() => setIsBilingualOpen(false)}
        originalText={transcript}
        originalLanguage={selectedLanguage}
        onSuccessToast={(msg) => showToast(msg, "success")}
        onError={(msg) => showToast(msg, "error")}
      />

      {/* Speech Analytics Modal */}
      <SpeechAnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        transcript={transcript}
        durationSeconds={audioDuration}
      />

      {/* Export Document (HTML Offline / Word / PDF / Audio WAV) Modal */}
      <ExportDocumentModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={sessionTitle}
        category={activeCategory}
        languageName={selectedLanguage.name}
        languageCode={selectedLanguage.code}
        transcript={transcript}
        summary={summary}
        audioUrl={audioUrl}
        onSuccess={(msg) => showToast(msg, "success")}
        onError={(msg) => showToast(msg, "error")}
      />

      {/* Shareable Link Modal */}
      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setShareTargetSession(null);
        }}
        title={shareTargetSession?.title ?? sessionTitle}
        category={shareTargetSession?.category ?? activeCategory}
        languageName={shareTargetSession?.languageName ?? selectedLanguage.name}
        transcript={shareTargetSession?.transcript ?? transcript}
        summary={shareTargetSession ? shareTargetSession.summary : summary}
        onSuccess={(msg) => showToast(msg, "success")}
        onError={(msg) => showToast(msg, "error")}
      />

      {/* Text-to-Speech (TTS) Player Bar */}
      <TTSPlayerBar
        isOpen={ttsState.isOpen}
        onClose={() => setTtsState((prev) => ({ ...prev, isOpen: false }))}
        title={ttsState.title}
        sourceType={ttsState.sourceType}
        text={ttsState.text}
        currentLanguageCode={selectedLanguage.code}
        onError={(msg) => showToast(msg, "error")}
        onSuccessToast={(msg) => showToast(msg, "success")}
        onOpenFullStudio={(txt, _title, mode) => handleOpenTTSStudio(txt, mode || "text")}
      />

      {/* Dedicated Full Text-to-Speech Studio Modal */}
      <TextToSpeechModal
        isOpen={isTTSStudioOpen}
        onClose={() => setIsTTSStudioOpen(false)}
        initialText={ttsStudioInitialText}
        initialMode={ttsStudioInitialMode}
        currentTranscript={transcript}
        currentSummaryText={
          summary
            ? `${summary.title}. ${summary.overview}. Luận điểm cốt lõi: ${
                summary.keyPoints
                  ?.map((kp) => (typeof kp === "string" ? kp : `${kp.heading}: ${kp.detail}`))
                  .join(". ") || ""
              }`
            : ""
        }
        currentLanguageCode={selectedLanguage.code}
        onSuccessToast={(msg) => showToast(msg, "success")}
        onError={(msg) => showToast(msg, "error")}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-4 px-6 text-center text-xs text-slate-400">
        Ứng dụng chuyển đổi giọng nói thành văn bản đa ngôn ngữ & tóm tắt tự động • Tích hợp Google Gemini AI
      </footer>
    </div>
  );
}

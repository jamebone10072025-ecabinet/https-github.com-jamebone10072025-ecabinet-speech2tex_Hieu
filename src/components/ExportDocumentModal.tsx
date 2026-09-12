import React, { useState, useRef, useEffect } from "react";
import {
  X,
  FileText,
  FileDown,
  Check,
  Loader2,
  FileCode,
  Calendar,
  Layers,
  Sparkles,
  AlignLeft,
  ListChecks,
  Headphones,
  Volume2,
  Play,
  Pause,
  Download,
  RotateCcw,
  Globe,
} from "lucide-react";
import { SummaryResult, SessionCategory } from "../types";
import { exportToDocx, exportToPdf, exportToHtml, ExportDocumentOptions } from "../utils/documentExporter";
import { generateGeminiTTS } from "../services/apiService";

const GEMINI_VOICES = [
  { id: "Kore", name: "Kore", desc: "Giọng nữ thanh lịch, rõ ràng, ấm áp", gender: "Nữ" },
  { id: "Puck", name: "Puck", desc: "Giọng nam truyền cảm, tự nhiên, sinh động", gender: "Nam" },
  { id: "Fenrir", name: "Fenrir", desc: "Giọng nam trầm ấm, đĩnh đạc", gender: "Nam" },
  { id: "Charon", name: "Charon", desc: "Giọng nam điềm tĩnh, chuyên nghiệp", gender: "Nam" },
  { id: "Zephyr", name: "Zephyr", desc: "Giọng nữ nhẹ nhàng, êm dịu", gender: "Nữ" },
];

interface ExportDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  category: SessionCategory | string;
  languageName: string;
  languageCode?: string;
  transcript: string;
  summary: SummaryResult | null;
  audioUrl?: string | null;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const ExportDocumentModal: React.FC<ExportDocumentModalProps> = ({
  isOpen,
  onClose,
  title,
  category,
  languageName,
  languageCode = "vi-VN",
  transcript,
  summary,
  audioUrl,
  onSuccess,
  onError,
}) => {
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(!!summary);
  const [includeActionItems, setIncludeActionItems] = useState(true);
  const [customTitle, setCustomTitle] = useState(title || "Bản ghi âm & Tóm tắt AI");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const [embedAudioInHtml, setEmbedAudioInHtml] = useState(true);
  const [includeOfflineTTSInHtml, setIncludeOfflineTTSInHtml] = useState(true);

  // Audio TTS export state
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [isExportingAudio, setIsExportingAudio] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync title and reset playback when opening/closing
  useEffect(() => {
    if (isOpen && title) {
      setCustomTitle(title);
      setIncludeSummary(!!summary);
    }
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlayingAudio(false);
      setAudioCurrentTime(0);
    }
  }, [isOpen, title, summary]);

  if (!isOpen) return null;

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  // Build spoken text for audio summary
  const getSpokenSummaryText = (): string => {
    if (!summary) return "";
    const parts: string[] = [];

    if (customTitle.trim()) {
      parts.push(`Tóm tắt: ${customTitle.trim()}.`);
    } else if (summary.title) {
      parts.push(`Tóm tắt: ${summary.title}.`);
    }

    if (includeSummary && summary.overview) {
      parts.push(`Tổng quan nội dung: ${summary.overview}`);
    }

    if (includeSummary && summary.keyPoints && summary.keyPoints.length > 0) {
      const keyPointsText = summary.keyPoints
        .map((kp) => (typeof kp === "string" ? kp : `${kp.heading}: ${kp.detail}`))
        .join(". ");
      parts.push(`Các luận điểm quan trọng: ${keyPointsText}.`);
    }

    if (includeActionItems && summary.actionItems && summary.actionItems.length > 0) {
      const actionsText = summary.actionItems
        .map(
          (item, idx) =>
            `Hành động ${idx + 1}: ${item.task}${
              item.assignee ? `, người phụ trách: ${item.assignee}` : ""
            }`
        )
        .join(". ");
      parts.push(`Kế hoạch hành động: ${actionsText}.`);
    }

    return parts.join(" ").trim();
  };

  const spokenText = getSpokenSummaryText();
  const spokenCharCount = spokenText.length;
  const spokenWordCount = spokenText ? spokenText.split(/\s+/).length : 0;

  const handleExportDocx = async () => {
    if (!includeTranscript && !includeSummary) {
      onError("Vui lòng chọn ít nhất một nội dung để xuất (Bản ghi hoặc Tóm tắt).");
      return;
    }

    setIsExportingDocx(true);
    try {
      const opts: ExportDocumentOptions = {
        title: customTitle,
        category,
        languageName,
        dateStr: new Date().toLocaleString("vi-VN"),
        transcript,
        summary,
        includeTranscript,
        includeSummary: includeSummary && !!summary,
        includeActionItems,
      };

      await exportToDocx(opts);
      onSuccess("Đã xuất tệp Word (.docx) thành công!");
      onClose();
    } catch (err: any) {
      onError(err.message || "Không thể xuất tệp Word.");
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportPdf = async () => {
    if (!includeTranscript && !includeSummary) {
      onError("Vui lòng chọn ít nhất một nội dung để xuất (Bản ghi hoặc Tóm tắt).");
      return;
    }

    setIsExportingPdf(true);
    try {
      const opts: ExportDocumentOptions = {
        title: customTitle,
        category,
        languageName,
        dateStr: new Date().toLocaleString("vi-VN"),
        transcript,
        summary,
        includeTranscript,
        includeSummary: includeSummary && !!summary,
        includeActionItems,
      };

      await exportToPdf(opts);
      onSuccess("Đã xuất tệp PDF (.pdf) thành công!");
      onClose();
    } catch (err: any) {
      onError(err.message || "Không thể xuất tệp PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportHtml = async () => {
    if (!includeTranscript && !includeSummary) {
      onError("Vui lòng chọn ít nhất một nội dung để xuất (Bản ghi hoặc Tóm tắt).");
      return;
    }

    setIsExportingHtml(true);
    try {
      const opts: ExportDocumentOptions = {
        title: customTitle,
        category,
        languageName,
        languageCode,
        dateStr: new Date().toLocaleString("vi-VN"),
        transcript,
        summary,
        includeTranscript,
        includeSummary: includeSummary && !!summary,
        includeActionItems,
        audioUrl,
        embedAudio: embedAudioInHtml && !!audioUrl,
        includeOfflineTTS: includeOfflineTTSInHtml,
      };

      await exportToHtml(opts);
      onSuccess("Đã xuất tệp HTML chạy offline (.html) thành công!");
      onClose();
    } catch (err: any) {
      onError(err.message || "Không thể xuất tệp HTML.");
    } finally {
      setIsExportingHtml(false);
    }
  };

  // Export summary as Audio WAV file using TTS
  const handleExportAudio = async () => {
    if (!summary) {
      onError("Chưa có bản tóm tắt AI để xuất thành tệp âm thanh. Vui lòng tạo tóm tắt trước.");
      return;
    }

    const textToSpeak = getSpokenSummaryText();
    if (!textToSpeak) {
      onError("Vui lòng chọn ít nhất Bản tóm tắt hoặc Kế hoạch hành động để đọc thành tiếng.");
      return;
    }

    setIsExportingAudio(true);
    try {
      const res = await generateGeminiTTS(textToSpeak, selectedVoice);
      if (!res.audioUrl) {
        throw new Error("Không nhận được dữ liệu âm thanh từ mô hình AI.");
      }

      setGeneratedAudioUrl(res.audioUrl);

      // Safe file name
      const safeTitle = (customTitle || "tom-tat-ai")
        .toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u024F\u1EA0-\u1EF9]/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      const fileName = `${safeTitle || "tom-tat"}-audio.wav`;

      // Trigger automatic file download
      const a = document.createElement("a");
      a.href = res.audioUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      onSuccess(`Đã xuất tệp âm thanh tóm tắt "${fileName}" (.wav) thành công!`);
    } catch (err: any) {
      console.error("Lỗi xuất âm thanh TTS:", err);
      onError(err.message || "Lỗi khi xuất tệp âm thanh tóm tắt. Vui lòng thử lại.");
    } finally {
      setIsExportingAudio(false);
    }
  };

  const togglePlayAudio = () => {
    if (!audioRef.current || !generatedAudioUrl) return;

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const formatSeconds = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Hidden audio element for preview */}
      {generatedAudioUrl && (
        <audio
          ref={audioRef}
          src={generatedAudioUrl}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setAudioCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setAudioDuration(audioRef.current.duration || 0);
            }
          }}
          onEnded={() => {
            setIsPlayingAudio(false);
            setAudioCurrentTime(0);
          }}
        />
      )}

      <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Xuất tài liệu & âm thanh (HTML offline, Word, PDF, Audio WAV)
              </h3>
              <p className="text-xs text-slate-400">
                Lưu trữ tệp HTML chạy offline độc lập, tài liệu văn bản hoặc file âm thanh giọng đọc
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Document Title input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Tiêu đề tài liệu / tệp xuất:
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Nhập tiêu đề..."
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-medium"
            />
          </div>

          {/* Metadata preview card */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                Danh mục: <strong className="text-slate-700 dark:text-slate-200">{category}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                Độ dài: <strong className="text-slate-700 dark:text-slate-200">{wordCount} từ</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>{new Date().toLocaleDateString("vi-VN")}</span>
            </div>
          </div>

          {/* Checklist of what to include in Document / Audio */}
          <div>
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Nội dung bao gồm trong tài liệu & âm thanh:
            </span>
            <div className="space-y-2">
              {/* Option 1: AI Summary */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  includeSummary && summary
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                    : !summary
                    ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!summary}
                  checked={includeSummary && !!summary}
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Bản tóm tắt thông minh Gemini AI
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {summary
                      ? "Bao gồm tổng quan điều hành, luận điểm cốt lõi và chủ đề chính"
                      : "Chưa có bản tóm tắt (Vui lòng tạo tóm tắt trước nếu cần)"}
                  </p>
                </div>
              </label>

              {/* Option 2: Action items */}
              {summary && summary.actionItems && summary.actionItems.length > 0 && (
                <label className="flex items-start gap-3 p-3 rounded-xl border bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeActionItems}
                    onChange={(e) => setIncludeActionItems(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <ListChecks className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Kế hoạch hành động & Phân công nhiệm vụ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Bao gồm {summary.actionItems.length} đầu mục công việc được trích xuất
                    </p>
                  </div>
                </label>
              )}

              {/* Option 3: Transcript (Document only) */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  includeTranscript
                    ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800"
                    : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={includeTranscript}
                  onChange={(e) => setIncludeTranscript(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Toàn bộ nội dung bản ghi âm (Transcript cho Word / PDF)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Lời thoại chi tiết và các đoạn phát biểu ({wordCount} từ)
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Standalone Offline HTML Export Configuration Section */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    Xuất tệp HTML độc lập chạy 100% offline (.html)
                  </h4>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                    Mở được trên mọi máy tính và điện thoại không cần internet, máy chủ hay cài đặt
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                Offline 100%
              </span>
            </div>

            <div className="space-y-2 pt-1 border-t border-emerald-100 dark:border-emerald-900/50">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeOfflineTTSInHtml}
                  onChange={(e) => setIncludeOfflineTTSInHtml(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <span>Tích hợp bộ đọc giọng nói Text-to-Speech offline (Web Speech API trình duyệt)</span>
              </label>

              <label
                className={`flex items-center gap-2 text-xs cursor-pointer ${
                  audioUrl ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!audioUrl}
                  checked={embedAudioInHtml && !!audioUrl}
                  onChange={(e) => setEmbedAudioInHtml(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <span>
                  {audioUrl
                    ? "Nhúng file âm thanh ghi âm vào tệp HTML (phát lại offline không cần mạng)"
                    : "Chưa có bản ghi âm để nhúng vào tệp HTML"}
                </span>
              </label>
            </div>
          </div>

          {/* Audio TTS Export Configuration Section */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    Xuất bản tóm tắt thành tệp âm thanh (.wav)
                  </h4>
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                    Sử dụng động cơ Gemini AI TTS chuyển đổi bản tóm tắt thành file giọng nói tự nhiên
                  </p>
                </div>
              </div>

              {summary && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {spokenWordCount} từ ({spokenCharCount} ký tự)
                </span>
              )}
            </div>

            {summary ? (
              <div className="space-y-3 pt-1">
                {/* Voice Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Chọn giọng đọc AI (Gemini Flash Voice):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {GEMINI_VOICES.map((v) => {
                      const isSelected = selectedVoice === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedVoice(v.id);
                            if (generatedAudioUrl) {
                              setGeneratedAudioUrl(null);
                              setIsPlayingAudio(false);
                            }
                          }}
                          className={`p-2 rounded-xl text-left transition-all border ${
                            isSelected
                              ? "bg-white dark:bg-slate-800 border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs"
                              : "bg-white/60 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {v.name}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                v.gender === "Nữ"
                                  ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300"
                                  : "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300"
                              }`}
                            >
                              {v.gender}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate leading-tight">
                            {v.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* In-modal Audio Player Preview if generated */}
                {generatedAudioUrl && (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200/70 dark:border-indigo-800/70 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={togglePlayAudio}
                        className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs transition-colors"
                        title={isPlayingAudio ? "Tạm dừng" : "Nghe thử"}
                      >
                        {isPlayingAudio ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            Đã tạo âm thanh ({selectedVoice})
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatSeconds(audioCurrentTime)} / {formatSeconds(audioDuration)}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ File WAV (24kHz Studio Quality) sẵn sàng
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={generatedAudioUrl}
                        download={`${(customTitle || "tom-tat").toLowerCase().replace(/[^a-z0-9]/g, "-")}-audio.wav`}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold transition-colors border border-indigo-200/60 dark:border-indigo-800"
                        title="Tải lại file WAV về máy"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải lại</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                Chưa có bản tóm tắt AI. Vui lòng bấm "Tạo tóm tắt AI" ở màn hình chính trước để xuất tệp âm thanh.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions: PDF, Word, & Audio buttons */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
          >
            Hủy bỏ
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            {/* HTML Offline Button */}
            <button
              type="button"
              id="btn-export-html"
              onClick={handleExportHtml}
              disabled={isExportingHtml || isExportingDocx || isExportingPdf || isExportingAudio}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              title="Xuất file HTML độc lập chạy offline 100%, có audio player và bộ đọc TTS"
            >
              {isExportingHtml ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              <span>{isExportingHtml ? "Đang tạo HTML..." : "Xuất file HTML offline (.html)"}</span>
            </button>

            {/* Audio Summary Export Button */}
            <button
              type="button"
              id="btn-export-audio"
              onClick={handleExportAudio}
              disabled={isExportingAudio || isExportingDocx || isExportingPdf || !summary}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              title="Xuất bản tóm tắt thành tệp âm thanh giọng đọc AI (.wav)"
            >
              {isExportingAudio ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              <span>{isExportingAudio ? "Đang tạo Audio..." : "Xuất file âm thanh (.wav)"}</span>
            </button>

            {/* Word Button */}
            <button
              type="button"
              id="btn-export-docx"
              onClick={handleExportDocx}
              disabled={isExportingDocx || isExportingPdf || isExportingAudio}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
            >
              {isExportingDocx ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileCode className="w-4 h-4" />
              )}
              <span>{isExportingDocx ? "Đang xuất Word..." : "Xuất file Word (.docx)"}</span>
            </button>

            {/* PDF Button */}
            <button
              type="button"
              id="btn-export-pdf"
              onClick={handleExportPdf}
              disabled={isExportingPdf || isExportingDocx || isExportingAudio}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span>{isExportingPdf ? "Đang xuất PDF..." : "Xuất file PDF (.pdf)"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


import React, { useState } from "react";
import Markdown from "react-markdown";
import {
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  Tag,
  Smile,
  Copy,
  Check,
  Download,
  Volume2,
  VolumeX,
  Loader2,
  RefreshCw,
  FileDown,
  Printer,
  SlidersHorizontal,
  ChevronRight,
  GitBranch,
  Share2,
} from "lucide-react";
import { SummaryResult, SummaryStyle, SummaryLength } from "../types";
import { SUPPORTED_LANGUAGES } from "../data/languages";

interface SummarySectionProps {
  transcript: string;
  summary: SummaryResult | null;
  isLoading: boolean;
  onGenerateSummary: (style: SummaryStyle, length: SummaryLength, targetLang: string) => void;
  autoSummarize: boolean;
  onToggleAutoSummarize: (val: boolean) => void;
  onError: (msg: string) => void;
  onSuccessToast: (msg: string) => void;
  onOpenExportModal?: () => void;
  onOpenShareModal?: () => void;
  onOpenTTS?: (text: string, title: string) => void;
}

export const SummarySection: React.FC<SummarySectionProps> = ({
  transcript,
  summary,
  isLoading,
  onGenerateSummary,
  autoSummarize,
  onToggleAutoSummarize,
  onError,
  onSuccessToast,
  onOpenExportModal,
  onOpenShareModal,
  onOpenTTS,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<SummaryStyle>("executive");
  const [selectedLength, setSelectedLength] = useState<SummaryLength>("standard");
  const [targetLang, setTargetLang] = useState<string>("auto");
  const [activeTab, setActiveTab] = useState<"cards" | "markdown" | "mindmap">("cards");
  const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});
  const [isCopied, setIsCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  // Toggle task completion in action items
  const toggleTask = (index: number) => {
    setCheckedTasks((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Copy summary markdown
  const handleCopySummary = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.formattedMarkdown);
      setIsCopied(true);
      onSuccessToast("Đã sao chép toàn bộ tóm tắt dưới dạng Markdown!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      onError("Không thể sao chép tóm tắt.");
    }
  };

  // Download Markdown (.md)
  const handleDownloadMarkdown = () => {
    if (!summary) return;
    const blob = new Blob([summary.formattedMarkdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary-${summary.title.toLowerCase().replace(/[^a-z0-9]/gi, "-") || "notes"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccessToast("Đã tải tệp Markdown (.md) thành công!");
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  // Speak overview aloud
  const handleToggleSpeakOverview = () => {
    if (!window.speechSynthesis) {
      onError("Trình duyệt không hỗ trợ Text-to-Speech.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!summary?.overview) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(summary.overview);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const styleOptions: { id: SummaryStyle; label: string; desc: string }[] = [
    { id: "executive", label: "Tóm tắt tổng quan", desc: "Súc tích, bức tranh toàn cảnh" },
    { id: "key_points", label: "Luận điểm cốt lõi", desc: "Gạch đầu dòng các ý chính" },
    { id: "action_items", label: "Kế hoạch hành động", desc: "Nhiệm vụ & việc cần làm" },
    { id: "meeting_notes", label: "Biên bản cuộc họp", desc: "Thảo luận, quyết định & phân công" },
    { id: "detailed", label: "Phân tích chi tiết", desc: "Đầy đủ luận cứ và bối cảnh" },
  ];

  // Action items progress
  const totalTasks = summary?.actionItems?.length || 0;
  const completedTasks = Object.values(checkedTasks).filter(Boolean).length;
  const taskProgressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden flex flex-col h-full transition-all duration-200">
      {/* Header bar */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              Tóm tắt nội dung tự động (AI Summary)
            </h3>
            <p className="text-xs text-slate-400">
              Phân tích thông minh, trích xuất ý chính & nhiệm vụ bằng Gemini AI
            </p>
          </div>
        </div>

        {/* Generate / Re-generate Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            title="Tùy chỉnh định dạng tóm tắt"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="btn-trigger-summary"
            onClick={() => onGenerateSummary(selectedStyle, selectedLength, targetLang)}
            disabled={!transcript.trim() || isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : summary ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{summary ? "Tóm tắt lại" : "Tóm tắt ngay"}</span>
          </button>
        </div>
      </div>

      {/* Config Drawer/Panel */}
      {showConfig && (
        <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/60 space-y-3.5">
          {/* Style pills */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              Phong cách đúc kết:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {styleOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedStyle(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedStyle === opt.id
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Length & Target Language */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Độ dài:</span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                {(["concise", "standard", "detailed"] as SummaryLength[]).map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setSelectedLength(len)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      selectedLength === len
                        ? "bg-emerald-600 text-white"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                    }`}
                  >
                    {len === "concise" ? "Ngắn gọn" : len === "standard" ? "Tiêu chuẩn" : "Chi tiết"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Ngôn ngữ tóm tắt:
              </span>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="auto">Tự động theo ngôn ngữ nói</option>
                <option value="vi-VN">🇻🇳 Tiếng Việt</option>
                <option value="en-US">🇺🇸 English</option>
                <option value="ja-JP">🇯🇵 日本語</option>
                <option value="fr-FR">🇫🇷 Français</option>
                <option value="zh-CN">🇨🇳 中文</option>
              </select>
            </div>

            {/* Auto Summarize Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSummarize}
                onChange={(e) => onToggleAutoSummarize(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                Tự động tóm tắt khi dừng ghi âm
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-5 overflow-y-auto">
        {isLoading ? (
          /* Loading State */
          <div className="space-y-4 py-8 max-w-lg mx-auto text-center">
            <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mb-2">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Đang phân tích và đúc kết nội dung...
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Gemini AI đang nhận diện các luận điểm then chốt, trích xuất việc cần làm và cấu trúc bản tóm tắt mạch lạc.
            </p>
            <div className="space-y-2 pt-2">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-4/5 mx-auto animate-pulse" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-3/5 mx-auto animate-pulse" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-2/3 mx-auto animate-pulse" />
            </div>
          </div>
        ) : summary ? (
          /* Result view */
          <div className="space-y-5">
            {/* Title & Meta Bar */}
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                  {summary.title}
                </h2>

                {/* Sentiment & Tone badge */}
                {summary.sentiment && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 shadow-xs">
                    <Smile className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{summary.sentiment}</span>
                  </span>
                )}
              </div>

              {/* Topic tags */}
              {summary.topics && summary.topics.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <Tag className="w-3 h-3 text-slate-400" />
                  {summary.topics.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* View Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("cards")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "cards"
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  Dạng Thẻ
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("mindmap")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                    activeTab === "mindmap"
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  <GitBranch className="w-3 h-3" />
                  <span>Sơ đồ ý</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("markdown")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "markdown"
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  Markdown
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  id="btn-speak-summary-tts"
                  onClick={() => {
                    if (!summary) return;
                    const keyPointsText = summary.keyPoints
                      ?.map((kp) => (typeof kp === "string" ? kp : `${kp.heading}: ${kp.detail}`))
                      .join(". ") || "";
                    const actionTasks = summary.actionItems?.length
                      ? ` Kế hoạch hành động: ${summary.actionItems.map((a) => a.task).join(", ")}.`
                      : "";
                    const fullTextToSpeak = `${summary.title}. Tổng quan: ${summary.overview}. Luận điểm cốt lõi: ${keyPointsText}.${actionTasks}`;
                    if (onOpenTTS) {
                      onOpenTTS(fullTextToSpeak, `Bản tóm tắt: ${summary.title}`);
                    } else {
                      handleToggleSpeakOverview();
                    }
                  }}
                  title="Đọc to bản tóm tắt bằng giọng nói (Text-to-Speech)"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shadow-2xs transition-all"
                >
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Đọc tóm tắt (TTS)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  title="In / Xuất tài liệu tóm tắt"
                  className="p-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  title="Sao chép toàn bộ tóm tắt"
                  className="p-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  title="Tải tệp Markdown (.md)"
                  className="p-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <FileDown className="w-3.5 h-3.5" />
                </button>

                {onOpenExportModal && (
                  <button
                    type="button"
                    id="btn-export-doc-summary"
                    onClick={onOpenExportModal}
                    title="Xuất bản ghi & tóm tắt ra tệp HTML offline, Word hoặc PDF"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-all shadow-xs"
                  >
                    <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Xuất tài liệu (HTML, Word, PDF)</span>
                  </button>
                )}

                {onOpenShareModal && (
                  <button
                    type="button"
                    id="btn-share-summary"
                    onClick={onOpenShareModal}
                    title="Chia sẻ bản ghi & tóm tắt qua liên kết hash"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 rounded-lg transition-all shadow-xs"
                  >
                    <Share2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Chia sẻ</span>
                  </button>
                )}
              </div>
            </div>

            {/* TAB 1: Structured Cards */}
            {activeTab === "cards" && (
              <div className="space-y-4">
                {/* Overview Card */}
                {summary.overview && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      Tóm tắt tổng quan
                    </h4>
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                      {summary.overview}
                    </p>
                  </div>
                )}

                {/* Key Points Card */}
                {summary.keyPoints && summary.keyPoints.length > 0 && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Các luận điểm then chốt ({summary.keyPoints.length})
                    </h4>
                    <div className="space-y-2.5">
                      {summary.keyPoints.map((point, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[10px]">
                            {idx + 1}
                          </span>
                          <div className="flex-1 leading-relaxed">
                            <span className="font-bold text-slate-800 dark:text-slate-100 mr-1">
                              {point.heading}:
                            </span>
                            <span className="text-slate-600 dark:text-slate-300 font-normal">
                              {point.detail}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items Checklist */}
                {summary.actionItems && summary.actionItems.length > 0 && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                        Kế hoạch hành động & Việc cần làm ({summary.actionItems.length})
                      </h4>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {completedTasks}/{totalTasks} hoàn thành ({taskProgressPercent}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${taskProgressPercent}%` }}
                      />
                    </div>

                    <div className="space-y-2">
                      {summary.actionItems.map((item, idx) => {
                        const isDone = !!checkedTasks[idx];
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleTask(idx)}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                              isDone
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 line-through opacity-75"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            <button
                              type="button"
                              className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                            >
                              {isDone ? (
                                <CheckSquare className="w-4 h-4 fill-emerald-100 dark:fill-emerald-900" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                            <div className="flex-1 text-xs">
                              <span className="font-semibold">{item.task}</span>
                              {item.assignee && item.assignee !== "Không xác định" && (
                                <span className="ml-2 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[10px] font-normal inline-block">
                                  👤 {item.assignee}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Mindmap Tree Flow */}
            {activeTab === "mindmap" && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-4">
                <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 rounded-xl">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    {summary.title}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {summary.keyPoints?.map((pt, i) => (
                    <div
                      key={i}
                      className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-xs"
                    >
                      <div className="font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-[10px] flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span>{pt.heading}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                        {pt.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Full Markdown Render */}
            {activeTab === "markdown" && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                <div className="markdown-body prose dark:prose-invert max-w-none text-xs">
                  <Markdown>{summary.formattedMarkdown}</Markdown>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty placeholder */
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Chưa có bản tóm tắt nào
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              Hãy ghi âm giọng nói hoặc tải lên tệp âm thanh, sau đó bấm nút{" "}
              <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                "Tóm tắt ngay"
              </strong>{" "}
              để nhận bản đúc kết thông minh.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

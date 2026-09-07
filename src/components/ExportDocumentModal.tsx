import React, { useState } from "react";
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
} from "lucide-react";
import { SummaryResult, SessionCategory } from "../types";
import { exportToDocx, exportToPdf, ExportDocumentOptions } from "../utils/documentExporter";

interface ExportDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  category: SessionCategory | string;
  languageName: string;
  transcript: string;
  summary: SummaryResult | null;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const ExportDocumentModal: React.FC<ExportDocumentModalProps> = ({
  isOpen,
  onClose,
  title,
  category,
  languageName,
  transcript,
  summary,
  onSuccess,
  onError,
}) => {
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(!!summary);
  const [includeActionItems, setIncludeActionItems] = useState(true);
  const [customTitle, setCustomTitle] = useState(title || "Bản ghi âm & Tóm tắt AI");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // Sync title when opening
  React.useEffect(() => {
    if (isOpen && title) {
      setCustomTitle(title);
      setIncludeSummary(!!summary);
    }
  }, [isOpen, title, summary]);

  if (!isOpen) return null;

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Xuất Tài Liệu (Export PDF / Docx)
              </h3>
              <p className="text-xs text-slate-400">
                Lưu trữ bản ghi và tóm tắt AI ra tệp ngoài ứng dụng
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
              Tiêu đề tài liệu xuất:
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Nhập tiêu đề tài liệu..."
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

          {/* Checklist of what to include */}
          <div>
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Nội dung bao gồm trong tài liệu:
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
                      ? "Bao gồm tổng quan điều hành, luận điểm cốt lõi và nhãn chủ đề"
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

              {/* Option 3: Transcript */}
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
                      Toàn bộ nội dung bản ghi âm (Transcript)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Lời thoại chi tiết và các đoạn phát biểu ({wordCount} từ)
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions: PDF & Word buttons */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
          >
            Hủy bỏ
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Word Button */}
            <button
              type="button"
              id="btn-export-docx"
              onClick={handleExportDocx}
              disabled={isExportingDocx || isExportingPdf}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
            >
              {isExportingDocx ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileCode className="w-4 h-4" />
              )}
              <span>{isExportingDocx ? "Đang xuất Word..." : "Xuất File Word (.docx)"}</span>
            </button>

            {/* PDF Button */}
            <button
              type="button"
              id="btn-export-pdf"
              onClick={handleExportPdf}
              disabled={isExportingPdf || isExportingDocx}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span>{isExportingPdf ? "Đang xuất PDF..." : "Xuất File PDF (.pdf)"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

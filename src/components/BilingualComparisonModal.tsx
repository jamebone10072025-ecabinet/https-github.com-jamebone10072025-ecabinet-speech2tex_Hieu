import React, { useState } from "react";
import { X, Copy, Download, Check, Languages, ArrowRightLeft } from "lucide-react";
import { SupportedLanguage } from "../types";
import { SUPPORTED_LANGUAGES } from "../data/languages";
import { translateContent } from "../services/apiService";

interface BilingualComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  originalLanguage: SupportedLanguage;
  onSuccessToast: (msg: string) => void;
  onError: (msg: string) => void;
}

export const BilingualComparisonModal: React.FC<BilingualComparisonModalProps> = ({
  isOpen,
  onClose,
  originalText,
  originalLanguage,
  onSuccessToast,
  onError,
}) => {
  const [targetLang, setTargetLang] = useState<string>("en-US");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleTranslate = async () => {
    if (!originalText.trim()) return;
    setIsTranslating(true);
    try {
      const target = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang);
      const res = await translateContent(
        originalText,
        target ? target.name : targetLang
      );
      setTranslatedText(res);
      onSuccessToast(`Đã dịch song ngữ sang ${target?.name || targetLang}!`);
    } catch (err: any) {
      onError(err.message || "Không thể dịch văn bản.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopyBilingual = async () => {
    const content = `[VĂN BẢN GỐC - ${originalLanguage.name}]\n${originalText}\n\n[BẢN DỊCH]\n${translatedText}`;
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      onSuccessToast("Đã sao chép văn bản song ngữ!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      onError("Không thể sao chép văn bản.");
    }
  };

  const handleDownloadBilingual = () => {
    const content = `=== BẢN GHI SONG NGỮ ===\n\n[Ngôn ngữ gốc: ${originalLanguage.name}]\n${originalText}\n\n-------------------------\n\n[Bản dịch]\n${translatedText}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bilingual-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccessToast("Đã tải tệp văn bản song ngữ!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Đối Chiếu Văn Bản Song Ngữ
              </h3>
              <p className="text-xs text-slate-400">Xem và so sánh văn bản gốc và bản dịch song song</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleTranslate}
              disabled={isTranslating}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {isTranslating ? "Đang dịch..." : "Dịch sang ngôn ngữ này"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dual Side-by-Side Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700 flex-1 overflow-y-auto">
          {/* Left Column: Original */}
          <div className="p-4 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>{originalLanguage.flag}</span>
                <span>Văn bản gốc ({originalLanguage.name})</span>
              </span>
            </div>
            <div className="flex-1 overflow-y-auto text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {originalText || "(Chưa có nội dung)"}
            </div>
          </div>

          {/* Right Column: Translated */}
          <div className="p-4 flex flex-col h-full bg-white dark:bg-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                Bản dịch đối ứng
              </span>
            </div>
            <div className="flex-1 overflow-y-auto text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {translatedText ? (
                translatedText
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-center">
                  <Languages className="w-8 h-8 mb-2 opacity-40" />
                  <p>Bấm "Dịch sang ngôn ngữ này" ở trên để tạo bản dịch song ngữ.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        {translatedText && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
            <button
              type="button"
              onClick={handleCopyBilingual}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Sao chép song ngữ</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBilingual}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải tệp song ngữ (.txt)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

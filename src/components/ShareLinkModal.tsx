import React, { useState, useMemo } from "react";
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  FileText,
  Layers,
  Link,
  Info,
} from "lucide-react";
import { SummaryResult, SessionCategory } from "../types";
import { generateShareableUrl } from "../utils/shareableLink";

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  category?: SessionCategory | string;
  languageName?: string;
  transcript: string;
  summary: SummaryResult | null;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  isOpen,
  onClose,
  title,
  category = "Cuộc họp",
  languageName = "Tiếng Việt",
  transcript,
  summary,
  onSuccess,
  onError,
}) => {
  const [includeSummary, setIncludeSummary] = useState(!!summary);
  const [copied, setCopied] = useState(false);

  // Sync state when opened
  React.useEffect(() => {
    if (isOpen) {
      setIncludeSummary(!!summary);
      setCopied(false);
    }
  }, [isOpen, summary]);

  // Compute shareable URL
  const { url: shareUrl, byteLength } = useMemo(() => {
    if (!isOpen) return { url: "", byteLength: 0 };
    return generateShareableUrl({
      title,
      category,
      language: languageName,
      transcript,
      summary,
      includeSummary,
    });
  }, [isOpen, title, category, languageName, transcript, summary, includeSummary]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for iframe environments
        const input = document.createElement("input");
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      onSuccess("Đã sao chép liên kết chia sẻ vào khay nhớ tạm!");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      onError("Không thể sao chép liên kết tự động. Vui lòng chọn và sao chép thủ công.");
    }
  };

  const handleOpenLink = () => {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Chia Sẻ Bản Ghi & Tóm Tắt (Shareable Link)
              </h3>
              <p className="text-xs text-slate-400">
                Tạo liên kết tạm thời qua URL Hash để người khác xem tức thì
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Overview Info Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Tiêu đề:</span>
              <strong className="text-slate-800 dark:text-slate-200 truncate max-w-[260px]">
                {title || "Bản ghi âm mới"}
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Danh mục & Ngôn ngữ:</span>
              <span className="text-slate-700 dark:text-slate-300">
                {category} • {languageName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Độ dài bản ghi:</span>
              <span className="text-slate-700 dark:text-slate-300">{wordCount} từ</span>
            </div>
          </div>

          {/* Include Summary Toggle */}
          {summary && (
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 cursor-pointer hover:border-purple-300 dark:hover:border-purple-800 transition-colors">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Đính kèm bản tóm tắt Gemini AI
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Người nhận sẽ xem được phân tích, luận điểm và danh sách việc cần làm
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeSummary}
                onChange={(e) => setIncludeSummary(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
              />
            </label>
          )}

          {/* Generated Link Input & Copy */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Đường dẫn chia sẻ (Temporary Hash Link):</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Kích thước nén: ~{(byteLength / 1024).toFixed(1)} KB
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-500 truncate"
                />
              </div>

              {/* Copy Button */}
              <button
                type="button"
                id="btn-copy-share-link"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Đã chép!" : "Sao chép link"}</span>
              </button>
            </div>
          </div>

          {/* Privacy & Technical Notice */}
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Bảo mật & Không cần đăng nhập</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Dữ liệu được nén trực tiếp vào phần hash (<code>#share=...</code>) của URL và giải mã ngay trên trình duyệt của người nhận. Không có dữ liệu nào bị tải lên hay lưu trữ ở máy chủ bên ngoài.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <button
            type="button"
            onClick={handleOpenLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mở thử trong tab mới</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

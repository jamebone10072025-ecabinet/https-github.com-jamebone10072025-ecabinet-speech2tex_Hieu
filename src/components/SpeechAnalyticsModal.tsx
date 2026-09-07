import React from "react";
import {
  X,
  Gauge,
  Activity,
  AlertTriangle,
  Award,
  Clock,
  FileText,
  Volume2,
  CheckCircle2,
} from "lucide-react";

interface SpeechAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: string;
  durationSeconds: number;
}

export const SpeechAnalyticsModal: React.FC<SpeechAnalyticsModalProps> = ({
  isOpen,
  onClose,
  transcript,
  durationSeconds,
}) => {
  if (!isOpen) return null;

  const words = transcript.trim() ? transcript.trim().split(/\s+/) : [];
  const totalWords = words.length;
  const totalChars = transcript.length;

  // Approximate duration if 0: estimate from normal speaking pace (140 wpm)
  const effectiveDurationMinutes =
    durationSeconds > 5 ? durationSeconds / 60 : Math.max(0.2, totalWords / 140);

  const wpm = Math.round(totalWords / effectiveDurationMinutes);

  // WPM rating
  let paceLabel = "Tốc độ vừa phải (Chuẩn)";
  let paceColor = "text-emerald-600 dark:text-emerald-400";
  let paceBg = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800";
  let paceDesc = "Tốc độ nói tự nhiên, người nghe tiếp thu và ghi nhận thông tin tốt nhất.";

  if (wpm < 110) {
    paceLabel = "Tốc độ chậm";
    paceColor = "text-blue-600 dark:text-blue-400";
    paceBg = "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800";
    paceDesc = "Nói chậm rãi, thích hợp cho giảng dạy hoặc hướng dẫn kỹ thuật chi tiết.";
  } else if (wpm > 175) {
    paceLabel = "Tốc độ nhanh";
    paceColor = "text-amber-600 dark:text-amber-400";
    paceBg = "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800";
    paceDesc = "Tốc độ nói khá nhanh, phù hợp tranh luận hoặc trao đổi thông tin dồn dập.";
  }

  // Detect filler words (Tiếng Việt & English)
  const fillerPatterns = [
    /\b(ừm|ờ|à|thì|là|kiểu như|cơ mà|thực ra|như là)\b/gi,
    /\b(um|uh|er|ah|like|you know|basically|actually)\b/gi,
  ];

  let fillerCount = 0;
  const foundFillers: Record<string, number> = {};

  fillerPatterns.forEach((pattern) => {
    const matches = transcript.match(pattern);
    if (matches) {
      fillerCount += matches.length;
      matches.forEach((m) => {
        const lower = m.toLowerCase();
        foundFillers[lower] = (foundFillers[lower] || 0) + 1;
      });
    }
  });

  // Vocabulary diversity (unique words / total words)
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u1EA0-\u1EF9]/gi, "")));
  const diversityPercent = totalWords > 0 ? Math.round((uniqueWords.size / totalWords) * 100) : 0;

  // Sentences count
  const sentences = transcript.split(/[.?!;:]+/).filter((s) => s.trim().length > 0);
  const avgWordsPerSentence = sentences.length > 0 ? Math.round(totalWords / sentences.length) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Chỉ Số & Phân Tích Giọng Nói (Speech Analytics)
              </h3>
              <p className="text-xs text-slate-400">Đánh giá tốc độ, sự mạch lạc và vốn từ vựng</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Main Pace Metric Card */}
          <div className={`p-4 rounded-2xl border ${paceBg}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Tốc độ phát âm (WPM)
                </span>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border ${paceColor}`}>
                {paceLabel}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {wpm}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">từ / phút (Words Per Minute)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{paceDesc}</p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700 text-center">
              <span className="text-[11px] text-slate-400 block mb-1">Tổng số từ</span>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalWords}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700 text-center">
              <span className="text-[11px] text-slate-400 block mb-1">Ký tự</span>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalChars}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700 text-center">
              <span className="text-[11px] text-slate-400 block mb-1">Số câu</span>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{sentences.length}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700 text-center">
              <span className="text-[11px] text-slate-400 block mb-1">Đa dạng từ</span>
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{diversityPercent}%</span>
            </div>
          </div>

          {/* Filler words analysis */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Từ đệm & ngập ngừng ({fillerCount})
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {fillerCount === 0 ? "Tuyệt vời! Không phát hiện từ đệm" : "Nên hạn chế để bài nói gãy gọn hơn"}
              </span>
            </div>

            {fillerCount > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(foundFillers).map(([word, count]) => (
                  <span
                    key={word}
                    className="px-2 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-medium"
                  >
                    "{word}": <strong className="font-bold">{count} lần</strong>
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Giọng nói mạch lạc, dứt khoát và không chứa các từ lặp dư thừa.</span>
              </div>
            )}
          </div>

          {/* Fluency Recommendations */}
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                Gợi ý cải thiện từ Gemini AI
              </span>
            </div>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>
                {avgWordsPerSentence > 20
                  ? "Các câu khá dài (trung bình > 20 từ). Hãy ngắt thành các câu ngắn hơn để tăng độ tập trung."
                  : "Độ dài câu trung bình lý tưởng, cấu trúc câu rõ ràng."}
              </li>
              <li>
                {diversityPercent > 55
                  ? "Vốn từ vựng phong phú và diễn đạt linh hoạt."
                  : "Có xu hướng lặp lại một số từ ngữ chính, có thể dùng thêm từ đồng nghĩa khi thuyết trình."}
              </li>
              <li>
                Duy trì tốc độ nói trong khoảng 130 - 155 WPM để đạt hiệu quả truyền tải tối ưu nhất.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

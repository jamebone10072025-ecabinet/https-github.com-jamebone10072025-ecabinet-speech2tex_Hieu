import React, { useState } from "react";
import {
  History,
  X,
  Search,
  Trash2,
  Calendar,
  Clock,
  ArrowRight,
  FileText,
  Sparkles,
  Download,
  Tag,
  Share2,
} from "lucide-react";
import { SpeechSessionItem, SessionCategory } from "../types";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SpeechSessionItem[];
  onSelectSession: (item: SpeechSessionItem) => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
  onShareSession?: (item: SpeechSessionItem) => void;
}

const CATEGORIES: ("Tất cả" | SessionCategory)[] = [
  "Tất cả",
  "Cuộc họp",
  "Phỏng vấn",
  "Ý tưởng",
  "Học tập",
  "Cá nhân",
];

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onDeleteSession,
  onClearAll,
  onShareSession,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"Tất cả" | SessionCategory>("Tất cả");

  if (!isOpen) return null;

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.transcript.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.summary?.overview &&
        s.summary.overview.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === "Tất cả" || s.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleString("vi-VN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleExportBackup = () => {
    if (sessions.length === 0) return;
    const blob = new Blob([JSON.stringify(sessions, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voice-transcripts-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Lịch sử ghi âm & tóm tắt ({sessions.length})
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={handleExportBackup}
                title="Xuất file sao lưu (JSON)"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-700/40">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Clear Bar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo từ khóa..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {sessions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử?")) {
                  onClearAll();
                }
              }}
              title="Xóa tất cả"
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredSessions.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs">
              <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p>Chưa có bản ghi âm hoặc tóm tắt nào phù hợp.</p>
            </div>
          ) : (
            filteredSessions.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl hover:border-indigo-400 transition-all group flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.timestamp)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.category && (
                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {item.category}
                        </span>
                      )}
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                        {item.language}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {item.title || "Bản ghi âm không tên"}
                  </h4>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {item.transcript}
                  </p>

                  {item.summary && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Sparkles className="w-3 h-3" />
                      <span>Đã có tóm tắt AI</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/40 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSession(item);
                      onClose();
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <span>Mở xem & chỉnh sửa</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {onShareSession && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShareSession(item);
                        }}
                        title="Chia sẻ liên kết"
                        className="p-1 rounded-md text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(item.id);
                      }}
                      title="Xóa bản ghi"
                      className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Sparkles,
  Globe,
  Download,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  FileText,
  Sliders,
  SlidersHorizontal,
  Headphones,
  ClipboardPaste,
  Trash2,
} from "lucide-react";
import { generateGeminiTTS } from "../services/apiService";

export interface TextToSpeechModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  currentTranscript?: string;
  currentSummaryText?: string;
  currentLanguageCode?: string;
  onSuccessToast: (msg: string) => void;
  onError: (msg: string) => void;
}

const GEMINI_VOICES = [
  { id: "Kore", name: "Kore", desc: "Nữ truyền cảm, ấm áp", gender: "Nữ" },
  { id: "Puck", name: "Puck", desc: "Nam thân thiện, tự nhiên", gender: "Nam" },
  { id: "Fenrir", name: "Fenrir", desc: "Nam trầm ổn, trang trọng", gender: "Nam" },
  { id: "Charon", name: "Charon", desc: "Nam điềm tĩnh, chuyên nghiệp", gender: "Nam" },
  { id: "Zephyr", name: "Zephyr", desc: "Trung tính, hiện đại", gender: "Trung tính" },
];

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const SAMPLE_TEXTS = [
  {
    title: "Tiếng Việt (Hội thảo & Tin tức)",
    text: "Xin chào quý vị đại biểu và các bạn đồng nghiệp. Chào mừng mọi người đến với buổi tọa đàm ứng dụng trí tuệ nhân tạo trong chuyển đổi số và nâng cao hiệu suất làm việc hôm nay.",
  },
  {
    title: "English (Business Overview)",
    text: "Welcome everyone to today's quarterly executive review. We will explore key market trends, customer insights, and strategic product roadmaps for the upcoming fiscal year.",
  },
  {
    title: "Tiếng Việt (Khai mạc ngắn)",
    text: "Hệ thống chuyển đổi văn bản thành giọng nói chất lượng cao hỗ trợ đa ngôn ngữ, ngữ điệu tự nhiên và âm thanh chuẩn phòng thu.",
  },
];

export const TextToSpeechModal: React.FC<TextToSpeechModalProps> = ({
  isOpen,
  onClose,
  initialText = "",
  currentTranscript = "",
  currentSummaryText = "",
  currentLanguageCode = "vi-VN",
  onSuccessToast,
  onError,
}) => {
  const [text, setText] = useState<string>(initialText || "");
  const [engine, setEngine] = useState<"gemini" | "browser">("gemini");
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [browserVoiceURI, setBrowserVoiceURI] = useState<string>("");
  const [availableBrowserVoices, setAvailableBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Audio state
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [hasCopied, setHasCopied] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize text when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialText) {
        setText(initialText);
      } else if (!text && currentTranscript) {
        setText(currentTranscript);
      }
    } else {
      stopPlayback();
    }
  }, [isOpen, initialText]);

  // Load browser voices
  useEffect(() => {
    if (!window.speechSynthesis) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableBrowserVoices(voices);
      if (voices.length > 0 && !browserVoiceURI) {
        // Try finding matching voice by language
        const langPrefix = (currentLanguageCode || "vi").split("-")[0];
        const matched = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
        if (matched) {
          setBrowserVoiceURI(matched.voiceURI);
        } else {
          setBrowserVoiceURI(voices[0].voiceURI);
        }
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [currentLanguageCode]);

  // Handle HTMLAudioElement playback speed & volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  };

  const handleBrowserSpeak = (textToSpeak: string) => {
    if (!window.speechSynthesis) {
      onError("Trình duyệt không hỗ trợ Web Speech Synthesis.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = playbackSpeed;
    utterance.pitch = pitch;
    utterance.volume = isMuted ? 0 : volume;

    if (browserVoiceURI && availableBrowserVoices.length > 0) {
      const v = availableBrowserVoices.find((item) => item.voiceURI === browserVoiceURI);
      if (v) utterance.voice = v;
    } else {
      utterance.lang = currentLanguageCode || "vi-VN";
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsLoadingAudio(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    utterance.onerror = (e) => {
      console.warn("TTS Web Speech error:", e);
      setIsPlaying(false);
      setIsLoadingAudio(false);
    };

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleGeminiSpeak = async (forceRegenerate: boolean = false) => {
    const trimmed = text.trim();
    if (!trimmed) {
      onError("Vui lòng nhập hoặc chọn văn bản cần đọc.");
      return;
    }

    // Reuse existing loaded audio if not forcing new generation
    if (audioBlobUrl && !forceRegenerate && audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsLoadingAudio(true);
    try {
      const res = await generateGeminiTTS(trimmed, selectedVoice);
      if (res.audioUrl) {
        setAudioBlobUrl(res.audioUrl);
        if (audioRef.current) {
          audioRef.current.src = res.audioUrl;
          audioRef.current.playbackRate = playbackSpeed;
          audioRef.current.volume = isMuted ? 0 : volume;
          audioRef.current.play();
          setIsPlaying(true);
        }
      }
    } catch (err: any) {
      onError(err.message || "Lỗi tạo giọng đọc AI Studio. Đang tự động chuyển sang giọng đọc trình duyệt...");
      setEngine("browser");
      handleBrowserSpeak(trimmed);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePlayToggle = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onError("Vui lòng nhập văn bản cần đọc.");
      return;
    }

    if (isPlaying) {
      if (engine === "gemini" && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else if (engine === "browser" && window.speechSynthesis) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
      }
    } else {
      if (engine === "gemini") {
        if (audioBlobUrl && audioRef.current) {
          audioRef.current.play();
          setIsPlaying(true);
        } else {
          handleGeminiSpeak();
        }
      } else {
        if (window.speechSynthesis && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setIsPlaying(true);
        } else {
          handleBrowserSpeak(trimmed);
        }
      }
    }
  };

  const handleDownloadAudio = () => {
    if (!audioBlobUrl) {
      onError("Chưa có bản ghi âm thanh để tải về. Vui lòng bấm 'Phát giọng đọc AI' trước.");
      return;
    }
    const a = document.createElement("a");
    a.href = audioBlobUrl;
    a.download = `speech-tts-${Date.now()}.wav`;
    a.click();
    onSuccessToast("Đã tải tệp âm thanh giọng đọc (.wav) thành công!");
  };

  const handleCopyText = async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
      onSuccessToast("Đã sao chép văn bản vào bộ nhớ tạm!");
    } catch {
      onError("Không thể sao chép văn bản.");
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setText(clipText);
        setAudioBlobUrl(null);
        onSuccessToast("Đã dán văn bản từ clipboard!");
      }
    } catch {
      onError("Trình duyệt không cho phép đọc clipboard trực tiếp. Bạn có thể nhấn phím Ctrl+V.");
    }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  const formatSeconds = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-text-to-speech-studio"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      {/* Hidden audio element for Gemini audio playback */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setIsPlaying(false);
          setIsLoadingAudio(false);
        }}
      />

      <div
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-3xl w-full p-6 space-y-5 my-8 transition-all animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Chuyển Văn Bản Thành Giọng Nói (Text-to-Speech Studio)
                </h2>
                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-md uppercase tracking-wider">
                  TTS AI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đọc văn bản thành tiếng với chất giọng AI Studio tự nhiên hoặc giọng đọc trình duyệt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Insert / Preset Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Nạp nhanh:
            </span>
            {currentTranscript && currentTranscript.trim() && (
              <button
                type="button"
                onClick={() => {
                  setText(currentTranscript.trim());
                  setAudioBlobUrl(null);
                  stopPlayback();
                  onSuccessToast("Đã nạp văn bản từ bản ghi âm lời nói!");
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-300 hover:text-indigo-600 rounded-lg font-semibold transition-all border border-slate-200 dark:border-slate-700"
              >
                <FileText className="w-3 h-3 text-indigo-600" />
                <span>Từ Bản Ghi Hiện Tại</span>
              </button>
            )}

            {currentSummaryText && currentSummaryText.trim() && (
              <button
                type="button"
                onClick={() => {
                  setText(currentSummaryText.trim());
                  setAudioBlobUrl(null);
                  stopPlayback();
                  onSuccessToast("Đã nạp văn bản từ bản tóm tắt!");
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 hover:text-emerald-600 rounded-lg font-semibold transition-all border border-slate-200 dark:border-slate-700"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Từ Bản Tóm Tắt AI</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-semibold transition-all border border-slate-200 dark:border-slate-700"
              title="Dán từ Clipboard"
            >
              <ClipboardPaste className="w-3 h-3" />
              <span>Dán</span>
            </button>
          </div>

          {/* Clear & Copy */}
          <div className="flex items-center gap-1.5">
            {text.trim() && (
              <>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors"
                  title="Sao chép nội dung"
                >
                  {hasCopied ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{hasCopied ? "Đã chép" : "Sao chép"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setText("");
                    setAudioBlobUrl(null);
                    stopPlayback();
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  title="Xóa toàn bộ văn bản"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Text Input Area */}
        <div className="relative">
          <textarea
            id="textarea-tts-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setAudioBlobUrl(null);
            }}
            placeholder="Nhập hoặc dán bất kỳ văn bản nào tại đây để chuyển đổi thành giọng nói truyền cảm..."
            rows={5}
            className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-y leading-relaxed font-sans"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
            <span>
              {wordCount.toLocaleString()} từ • {charCount.toLocaleString()} ký tự
            </span>
            {text.length === 0 && (
              <span className="italic text-slate-400">
                Mẹo: Bạn có thể chọn câu mẫu bên dưới để thử nghiệm ngay
              </span>
            )}
          </div>
        </div>

        {/* Quick Sample Selector if text is empty */}
        {text.length === 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs font-semibold text-slate-400 self-center">Mẫu thử:</span>
            {SAMPLE_TEXTS.map((sample, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setText(sample.text);
                  setAudioBlobUrl(null);
                }}
                className="px-2.5 py-1 text-xs bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-all border border-indigo-200/50 dark:border-indigo-800/50"
              >
                {sample.title}
              </button>
            ))}
          </div>
        )}

        {/* Voice Engine & Voice Selection Section */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Engine Tabs */}
            <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  setEngine("gemini");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  engine === "gemini"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Giọng AI Studio (Gemini 3.1)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  setEngine("browser");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  engine === "browser"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Giọng Trình Duyệt (Web Speech)</span>
              </button>
            </div>

            {/* Quality badge */}
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {engine === "gemini" ? (
                <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                  <Sparkles className="w-3 h-3" /> Chuẩn âm thanh phòng thu WAV 24kHz
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Globe className="w-3 h-3" /> Tổng hợp giọng đọc cục bộ của hệ điều hành
                </span>
              )}
            </div>
          </div>

          {/* Voice Selector depending on engine */}
          {engine === "gemini" ? (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-2">
                Chọn Giọng Đọc Gemini AI:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {GEMINI_VOICES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setSelectedVoice(v.id);
                      setAudioBlobUrl(null);
                      stopPlayback();
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedVoice === v.id
                        ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-300 dark:ring-indigo-800"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {v.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                        {v.gender}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      {v.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Giọng đọc hệ thống:
                  </label>
                  <select
                    value={browserVoiceURI}
                    onChange={(e) => setBrowserVoiceURI(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {availableBrowserVoices.length === 0 ? (
                      <option value="">(Đang tải danh sách giọng đọc...)</option>
                    ) : (
                      availableBrowserVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang}) {v.default ? "— Mặc định" : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="w-full sm:w-48">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Cao độ (Pitch): {pitch.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Speed & Volume Controls */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
            {/* Speed selection */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tốc độ đọc:
              </span>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                {SPEED_PRESETS.map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                      playbackSpeed === spd
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Volume & Mute */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                title={isMuted ? "Bật tiếng" : "Tắt tiếng"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-indigo-600" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-24 accent-indigo-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] font-mono text-slate-400 w-8">
                {isMuted ? "0%" : `${Math.round(volume * 100)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Audio Timeline for Gemini WAV */}
        {engine === "gemini" && duration > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>{formatSeconds(currentTime)}</span>
              <span>{formatSeconds(duration)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setCurrentTime(val);
                if (audioRef.current) {
                  audioRef.current.currentTime = val;
                }
              }}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>
        )}

        {/* Main Action Bar: Play / Stop / Download / Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              type="button"
              id="btn-modal-tts-play"
              onClick={handlePlayToggle}
              disabled={isLoadingAudio || !text.trim()}
              className={`px-5 py-2.5 rounded-2xl font-bold text-sm text-white shadow-md transition-all flex items-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                isLoadingAudio
                  ? "bg-slate-400"
                  : isPlaying
                  ? "bg-amber-500 hover:bg-amber-600 ring-4 ring-amber-200 dark:ring-amber-950"
                  : "bg-indigo-600 hover:bg-indigo-700 ring-4 ring-indigo-200 dark:ring-indigo-950"
              }`}
            >
              {isLoadingAudio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tổng hợp AI...</span>
                </>
              ) : isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Phát giọng đọc</span>
                </>
              )}
            </button>

            {/* Stop Button */}
            <button
              type="button"
              id="btn-modal-tts-stop"
              onClick={stopPlayback}
              disabled={!isPlaying && !audioBlobUrl}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
              title="Dừng đọc"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>

            {/* Soundwave indicator */}
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 h-10">
              {[40, 80, 50, 100, 60, 90, 70, 45].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isPlaying
                      ? "bg-indigo-600 dark:bg-indigo-400 animate-pulse"
                      : "bg-slate-300 dark:bg-slate-600"
                  }`}
                  style={{
                    height: isPlaying ? `${Math.max(20, Math.sin(Date.now() / 200 + i) * h)}%` : "20%",
                  }}
                />
              ))}
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 ml-2">
                {isLoadingAudio
                  ? "Đang khởi tạo âm thanh..."
                  : isPlaying
                  ? "Đang phát giọng nói"
                  : audioBlobUrl
                  ? "Sẵn sàng phát lại"
                  : "Chờ phát"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download audio button (available when audio is generated via Gemini) */}
            {audioBlobUrl && engine === "gemini" && (
              <button
                type="button"
                id="btn-modal-tts-download"
                onClick={handleDownloadAudio}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700"
                title="Tải tệp âm thanh giọng đọc (.wav)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải Tệp Âm Thanh (.wav)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

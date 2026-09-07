import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Sparkles,
  Cpu,
  Globe,
  Loader2,
  Download,
  X,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Headphones,
  Maximize2,
} from "lucide-react";
import { generateGeminiTTS } from "../services/apiService";

export interface TTSPlayerBarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sourceType: "transcript" | "summary";
  text: string;
  currentLanguageCode: string;
  onError: (msg: string) => void;
  onSuccessToast: (msg: string) => void;
  onOpenFullStudio?: (text: string, title: string) => void;
}

const GEMINI_VOICES = [
  { id: "Kore", name: "Kore", desc: "Nữ truyền cảm, ấm áp", gender: "female" },
  { id: "Puck", name: "Puck", desc: "Nam thân thiện, tự nhiên", gender: "male" },
  { id: "Fenrir", name: "Fenrir", desc: "Nam trầm ổn, trang trọng", gender: "male" },
  { id: "Charon", name: "Charon", desc: "Nam điềm tĩnh, chuyên nghiệp", gender: "male" },
  { id: "Zephyr", name: "Zephyr", desc: "Trung tính, điềm tĩnh", gender: "neutral" },
];

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export const TTSPlayerBar: React.FC<TTSPlayerBarProps> = ({
  isOpen,
  onClose,
  title,
  sourceType,
  text,
  currentLanguageCode,
  onError,
  onSuccessToast,
  onOpenFullStudio,
}) => {
  const [engine, setEngine] = useState<"gemini" | "browser">("gemini");
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [showFullText, setShowFullText] = useState<boolean>(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop playback when closed or text changed
  useEffect(() => {
    stopPlayback();
    setAudioBlobUrl(null);
    setCurrentTime(0);
    setDuration(0);
    // Auto-start reading when newly opened with text
    if (isOpen && text.trim()) {
      startPlayback();
    }
    return () => {
      stopPlayback();
    };
  }, [text, isOpen]);

  // Handle HTMLAudioElement playback speed changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
    if (window.speechSynthesis && isPlaying && engine === "browser") {
      // Browser speech synthesis doesn't update speed dynamically mid-utterance,
      // so restart if playing
      handleBrowserSpeak(text, playbackSpeed);
    }
  }, [playbackSpeed]);

  // Handle volume changes
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

  const handleBrowserSpeak = (textToSpeak: string, rate: number) => {
    if (!window.speechSynthesis) {
      onError("Trình duyệt không hỗ trợ Web Speech Synthesis.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = currentLanguageCode || "vi-VN";
    utterance.rate = rate;
    utterance.volume = isMuted ? 0 : volume;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsLoadingAudio(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    utterance.onerror = (e) => {
      console.warn("TTS Speech error:", e);
      setIsPlaying(false);
      setIsLoadingAudio(false);
    };

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleGeminiSpeak = async (forceRegenerate: boolean = false) => {
    if (!text.trim()) return;

    if (audioBlobUrl && !forceRegenerate && audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsLoadingAudio(true);
    try {
      const res = await generateGeminiTTS(text, selectedVoice);
      if (res.audioUrl) {
        setAudioBlobUrl(res.audioUrl);
        if (audioRef.current) {
          audioRef.current.src = res.audioUrl;
          audioRef.current.playbackRate = playbackSpeed;
          audioRef.current.play();
          setIsPlaying(true);
        }
      }
    } catch (err: any) {
      onError(err.message || "Lỗi tạo giọng đọc AI. Đang chuyển sang giọng đọc trình duyệt...");
      // Fallback to browser TTS if Gemini fails
      setEngine("browser");
      handleBrowserSpeak(text, playbackSpeed);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const startPlayback = () => {
    if (!text.trim()) {
      onError("Không có nội dung văn bản để đọc.");
      return;
    }

    if (engine === "gemini") {
      handleGeminiSpeak();
    } else {
      handleBrowserSpeak(text, playbackSpeed);
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      if (engine === "gemini" && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else if (engine === "browser" && window.speechSynthesis) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
      }
    } else {
      if (engine === "gemini" && audioRef.current && audioBlobUrl) {
        audioRef.current.play();
        setIsPlaying(true);
      } else if (engine === "browser" && window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else {
        startPlayback();
      }
    }
  };

  const handleEngineChange = (newEngine: "gemini" | "browser") => {
    stopPlayback();
    setEngine(newEngine);
    if (newEngine === "gemini") {
      handleGeminiSpeak();
    } else {
      handleBrowserSpeak(text, playbackSpeed);
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    if (engine === "gemini") {
      stopPlayback();
      setAudioBlobUrl(null);
      // Re-fetch with new voice
      setTimeout(() => {
        handleGeminiSpeak(true);
      }, 100);
    }
  };

  const handleDownloadAudio = () => {
    if (!audioBlobUrl) {
      onError("Chưa có tệp âm thanh sẵn sàng để tải về.");
      return;
    }
    const a = document.createElement("a");
    a.href = audioBlobUrl;
    a.download = `tts-${sourceType}-${Date.now()}.wav`;
    a.click();
    onSuccessToast("Đã tải tệp giọng đọc âm thanh (.wav) thành công!");
  };

  const formatSeconds = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  if (!isOpen) return null;

  return (
    <div
      id="tts-floating-player"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4 animate-in slide-in-from-bottom-5 duration-300"
    >
      {/* Hidden audio element for Gemini generated WAV */}
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

      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-indigo-200/80 dark:border-indigo-900/80 shadow-2xl p-4 transition-all">
        {/* Top Header: Title, Engine Selector, Close */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {title}
                </span>
                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0">
                  {sourceType === "transcript" ? "Bản ghi" : "Tóm tắt"}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block truncate">
                {text.slice(0, 75)}...
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Engine Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => handleEngineChange("gemini")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  engine === "gemini"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Giọng AI Studio</span>
              </button>
              <button
                type="button"
                onClick={() => handleEngineChange("browser")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  engine === "browser"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>Trình duyệt</span>
              </button>
            </div>

            {/* Open Full Studio */}
            {onOpenFullStudio && (
              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  onOpenFullStudio(text, title);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                title="Mở Studio TTS chuyên sâu (toàn màn hình)"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}

            {/* Collapse/Expand full text */}
            <button
              type="button"
              onClick={() => setShowFullText(!showFullText)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              title={showFullText ? "Thu gọn văn bản" : "Xem toàn văn"}
            >
              {showFullText ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={() => {
                stopPlayback();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Đóng trình đọc"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Full Text View */}
        {showFullText && (
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70 max-h-36 overflow-y-auto text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans animate-in fade-in">
            {text}
          </div>
        )}

        {/* Main Controls Area */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {/* Playback Button & Soundwave Indicator */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-tts-play-toggle"
              onClick={handleTogglePlay}
              disabled={isLoadingAudio}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md transition-all active:scale-95 ${
                isLoadingAudio
                  ? "bg-slate-400 cursor-not-allowed"
                  : isPlaying
                  ? "bg-amber-500 hover:bg-amber-600 ring-4 ring-amber-200 dark:ring-amber-950"
                  : "bg-indigo-600 hover:bg-indigo-700 ring-4 ring-indigo-200 dark:ring-indigo-950"
              }`}
            >
              {isLoadingAudio ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              id="btn-tts-stop"
              onClick={stopPlayback}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Dừng đọc"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>

            {/* Animated Soundwave EQ */}
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 h-9">
              {[40, 70, 90, 60, 100, 50, 80].map((h, i) => (
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
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 ml-1.5">
                {isLoadingAudio
                  ? "Đang tải giọng đọc AI..."
                  : isPlaying
                  ? "Đang phát tiếng..."
                  : "Sẵn sàng"}
              </span>
            </div>
          </div>

          {/* Configuration Controls: Voice Selector & Speed */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Voice dropdown if Gemini AI engine */}
            {engine === "gemini" && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Giọng:</span>
                <select
                  id="select-tts-voice"
                  value={selectedVoice}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {GEMINI_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.desc})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Speed pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                    playbackSpeed === speed
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Download WAV button if audio is generated */}
            {engine === "gemini" && audioBlobUrl && (
              <button
                type="button"
                onClick={handleDownloadAudio}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                title="Tải tệp âm thanh giọng đọc (.wav)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải Audio</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Timeline for Gemini Audio */}
        {engine === "gemini" && duration > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
              {formatSeconds(currentTime)}
            </span>
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
              className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <span className="text-[10px] font-mono text-slate-400 w-8">
              {formatSeconds(duration)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

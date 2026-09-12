import { useState, useEffect, useRef, useCallback } from "react";
import { insertTimestampToText } from "../utils/timestampUtils";

// Add SpeechRecognition types
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
  onstart?: () => void;
  onspeechstart?: () => void;
  onspeechend?: () => void;
  onaudiostart?: () => void;
  onaudioend?: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export type SpeechRecognitionState = "idle" | "listening" | "speaking" | "recovering";

export function useSpeechRecognition(
  initialLang: string = "vi-VN",
  initialTranscript: string = ""
) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechState, setSpeechState] = useState<SpeechRecognitionState>("idle");
  const [transcript, setTranscript] = useState<string>(initialTranscript);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [selectedLang, setSelectedLang] = useState<string>(initialLang);
  const [lastSpeechDetectedTime, setLastSpeechDetectedTime] = useState<number>(0);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldKeepListeningRef = useRef<boolean>(false);
  const isRecognitionActiveRef = useRef<boolean>(false);
  const restartTimerRef = useRef<any>(null);
  const finalTranscriptAccumulatorRef = useRef<string>(initialTranscript);
  const interimTranscriptRef = useRef<string>("");

  // Flush any pending interim text into final transcript accumulator
  const flushInterim = useCallback(() => {
    const pendingInterim = interimTranscriptRef.current.trim();
    if (pendingInterim) {
      const current = finalTranscriptAccumulatorRef.current.trim();
      const merged = current ? `${current} ${pendingInterim}` : pendingInterim;
      finalTranscriptAccumulatorRef.current = merged;
      setTranscript(merged);
      interimTranscriptRef.current = "";
      setInterimTranscript("");
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLang;

      recognition.onstart = () => {
        isRecognitionActiveRef.current = true;
        setIsListening(true);
        setSpeechState("listening");
      };

      recognition.onspeechstart = () => {
        setSpeechState("speaking");
        setLastSpeechDetectedTime(Date.now());
      };

      recognition.onspeechend = () => {
        if (shouldKeepListeningRef.current) {
          setSpeechState("listening");
        }
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalChunk += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }

        if (finalChunk.trim()) {
          finalTranscriptAccumulatorRef.current = (
            finalTranscriptAccumulatorRef.current + " " + finalChunk
          ).trim();
          setTranscript(finalTranscriptAccumulatorRef.current);
          setLastSpeechDetectedTime(Date.now());
        }

        interimTranscriptRef.current = interim;
        setInterimTranscript(interim);
        if (interim) {
          setSpeechState("speaking");
          setLastSpeechDetectedTime(Date.now());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error event:", event.error);
        if (event.error === "not-allowed") {
          setError("Quyền truy cập micro đã bị từ chối. Vui lòng cấp quyền trong trình duyệt.");
          setIsListening(false);
          setSpeechState("idle");
          shouldKeepListeningRef.current = false;
        } else if (event.error === "no-speech") {
          // Normal silence pause: keep listening if user hasn't explicitly stopped
          if (shouldKeepListeningRef.current) {
            setSpeechState("listening");
          }
        } else if (event.error === "network") {
          console.warn("Speech recognition network hiccup. Will auto-recover.");
          setSpeechState("recovering");
        } else if (event.error !== "aborted") {
          setError(`Lỗi nhận diện âm thanh: ${event.error}`);
        }
      };

      recognition.onend = () => {
        isRecognitionActiveRef.current = false;

        // If user didn't explicitly stop, auto-restart continuous listening with safe delay
        if (shouldKeepListeningRef.current) {
          setSpeechState("recovering");
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (shouldKeepListeningRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (err: any) {
                console.warn("Error auto-restarting speech recognition (retrying):", err?.message);
                // Second retry guard after short pause
                setTimeout(() => {
                  if (shouldKeepListeningRef.current && recognitionRef.current && !isRecognitionActiveRef.current) {
                    try {
                      recognitionRef.current.start();
                    } catch {
                      // Handled gracefully
                    }
                  }
                }, 300);
              }
            }
          }, 150);
        } else {
          // Explicitly ended: flush any pending interim text and reset state
          flushInterim();
          setIsListening(false);
          setSpeechState("idle");
          setInterimTranscript("");
        }
      };

      recognitionRef.current = recognition;
    } catch (err: any) {
      console.error("Lỗi khởi tạo SpeechRecognition:", err);
      setIsSupported(false);
    }

    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        shouldKeepListeningRef.current = false;
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [selectedLang, flushInterim]);

  const startListening = useCallback(() => {
    setError(null);
    if (!recognitionRef.current) {
      setError("Trình duyệt không hỗ trợ Web Speech API.");
      return;
    }
    try {
      shouldKeepListeningRef.current = true;
      if (!isRecognitionActiveRef.current) {
        recognitionRef.current.lang = selectedLang;
        recognitionRef.current.start();
      }
      setIsListening(true);
      setSpeechState("listening");
    } catch (e: any) {
      console.warn("Speech recognition start warning:", e);
      setIsListening(true);
    }
  }, [selectedLang]);

  const pauseListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    flushInterim();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setSpeechState("idle");
    setInterimTranscript("");
  }, [flushInterim]);

  const resumeListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      shouldKeepListeningRef.current = true;
      if (!isRecognitionActiveRef.current) {
        recognitionRef.current.lang = selectedLang;
        recognitionRef.current.start();
      }
      setIsListening(true);
      setSpeechState("listening");
    } catch (e: any) {
      console.warn("Resume listening warning:", e);
      setIsListening(true);
    }
  }, [selectedLang]);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    flushInterim();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setSpeechState("idle");
    setInterimTranscript("");
  }, [flushInterim]);

  const insertTimestamp = useCallback((seconds: number, customTag?: string) => {
    flushInterim();
    const current = finalTranscriptAccumulatorRef.current;
    const updated = insertTimestampToText(current, seconds, customTag);
    finalTranscriptAccumulatorRef.current = updated;
    setTranscript(updated);
    setInterimTranscript("");
  }, [flushInterim]);

  const resetTranscript = useCallback(() => {
    finalTranscriptAccumulatorRef.current = "";
    interimTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  const setManualTranscript = useCallback((newText: string) => {
    finalTranscriptAccumulatorRef.current = newText;
    setTranscript(newText);
  }, []);

  return {
    isListening,
    speechState,
    transcript,
    interimTranscript,
    error,
    isSupported,
    selectedLang,
    lastSpeechDetectedTime,
    setSelectedLang,
    startListening,
    pauseListening,
    resumeListening,
    stopListening,
    insertTimestamp,
    resetTranscript,
    setManualTranscript,
    flushInterim,
  };
}

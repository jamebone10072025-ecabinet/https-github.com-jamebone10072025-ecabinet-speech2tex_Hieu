import { useState, useEffect, useRef, useCallback } from "react";
import { insertTimestampToText, formatTimestamp } from "../utils/timestampUtils";

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
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function useSpeechRecognition(
  initialLang: string = "vi-VN",
  initialTranscript: string = ""
) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>(initialTranscript);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [selectedLang, setSelectedLang] = useState<string>(initialLang);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldKeepListeningRef = useRef<boolean>(false);
  const finalTranscriptAccumulatorRef = useRef<string>(initialTranscript);

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

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }

        if (final) {
          finalTranscriptAccumulatorRef.current = (
            finalTranscriptAccumulatorRef.current + " " + final
          ).trim();
          setTranscript(finalTranscriptAccumulatorRef.current);
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setError("Quyền truy cập micro đã bị từ chối. Vui lòng cấp quyền trong trình duyệt.");
          setIsListening(false);
          shouldKeepListeningRef.current = false;
        } else if (event.error === "no-speech") {
          // ignore silent pause
        } else if (event.error !== "aborted") {
          setError(`Lỗi nhận diện: ${event.error}`);
        }
      };

      recognition.onend = () => {
        // If user didn't explicitly stop, restart continuous listening
        if (shouldKeepListeningRef.current) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
          setInterimTranscript("");
        }
      };

      recognitionRef.current = recognition;
    } catch (err: any) {
      console.error("Lỗi khởi tạo SpeechRecognition:", err);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        shouldKeepListeningRef.current = false;
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [selectedLang]);

  const startListening = useCallback(() => {
    setError(null);
    if (!recognitionRef.current) {
      setError("Trình duyệt không hỗ trợ Web Speech API.");
      return;
    }
    try {
      shouldKeepListeningRef.current = true;
      recognitionRef.current.lang = selectedLang;
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e: any) {
      console.error("Cannot start speech recognition:", e);
      // Already running or error
      setIsListening(true);
    }
  }, [selectedLang]);

  const pauseListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const resumeListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      shouldKeepListeningRef.current = true;
      recognitionRef.current.lang = selectedLang;
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e: any) {
      console.warn("Resume listening warning:", e);
      setIsListening(true);
    }
  }, [selectedLang]);

  const insertTimestamp = useCallback((seconds: number, customTag?: string) => {
    const current = finalTranscriptAccumulatorRef.current;
    const updated = insertTimestampToText(current, seconds, customTag);
    finalTranscriptAccumulatorRef.current = updated;
    setTranscript(updated);
    setInterimTranscript("");
  }, []);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const resetTranscript = useCallback(() => {
    finalTranscriptAccumulatorRef.current = "";
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
    transcript,
    interimTranscript,
    error,
    isSupported,
    selectedLang,
    setSelectedLang,
    startListening,
    pauseListening,
    resumeListening,
    stopListening,
    insertTimestamp,
    resetTranscript,
    setManualTranscript,
  };
}

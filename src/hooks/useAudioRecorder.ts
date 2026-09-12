import { useState, useRef, useCallback, useEffect } from "react";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0); // 0 - 100
  const [isSilent, setIsSilent] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const levelIntervalRef = useRef<any>(null);
  const accumulatedDurationRef = useRef<number>(0);
  const segmentStartTimeRef = useRef<number>(0);
  const silentCounterRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setAudioUrl(null);
    audioChunksRef.current = [];
    setDuration(0);
    accumulatedDurationRef.current = 0;
    setIsPaused(false);
    setAudioLevel(0);
    setIsSilent(false);
    silentCounterRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Audio visualizer context
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      setAnalyserNode(analyser);

      // Level monitoring interval (calculates RMS 0-100)
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);

        // Detect prolonged silence (> 3.5s)
        if (normalized < 4) {
          silentCounterRef.current += 1;
          if (silentCounterRef.current > 35) {
            setIsSilent(true);
          }
        } else {
          silentCounterRef.current = 0;
          setIsSilent(false);
        }
      }, 100);

      // Determine supported mime type
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
        "audio/wav",
      ];
      const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (levelIntervalRef.current) {
          clearInterval(levelIntervalRef.current);
          levelIntervalRef.current = null;
        }
        setAudioLevel(0);

        const mime = selectedMime || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all tracks in stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        setAnalyserNode(null);
      };

      mediaRecorder.start(250); // collect 250ms chunks
      setIsRecording(true);
      setIsPaused(false);

      // Timer
      segmentStartTimeRef.current = Date.now();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        const elapsedSegment = Math.floor((Date.now() - segmentStartTimeRef.current) / 1000);
        setDuration(accumulatedDurationRef.current + elapsedSegment);
      }, 250);
    } catch (err: any) {
      console.error("Lỗi khi mở micro:", err);
      setError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Microphone bị từ chối quyền. Vui lòng cấp quyền truy cập micro trong trình duyệt."
          : `Không thể kích hoạt micro: ${err.message || err.name}`
      );
      setIsRecording(false);
      setIsPaused(false);
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.pause();
      } catch (e) {
        console.warn("Lỗi tạm dừng MediaRecorder:", e);
      }
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    setAudioLevel(0);
    const elapsedSegment = Math.floor((Date.now() - segmentStartTimeRef.current) / 1000);
    accumulatedDurationRef.current += elapsedSegment;
    setDuration(accumulatedDurationRef.current);
    setIsPaused(true);
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      try {
        mediaRecorderRef.current.resume();
      } catch (e) {
        console.warn("Lỗi tiếp tục MediaRecorder:", e);
      }
    }
    segmentStartTimeRef.current = Date.now();
    setIsPaused(false);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      const elapsedSegment = Math.floor((Date.now() - segmentStartTimeRef.current) / 1000);
      setDuration(accumulatedDurationRef.current + elapsedSegment);
    }, 250);
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (levelIntervalRef.current) {
        clearInterval(levelIntervalRef.current);
        levelIntervalRef.current = null;
      }
      setAudioLevel(0);
      setIsRecording(false);
      setIsPaused(false);

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.onstop = () => {
          const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
          const blob = new Blob(audioChunksRef.current, { type: mime });
          setAudioBlob(blob);
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);

          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }

          if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
          }
          setAnalyserNode(null);
          resolve(blob);
        };
        mediaRecorderRef.current.stop();
      } else {
        resolve(null);
      }
    });
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setAudioLevel(0);
    setIsSilent(false);
    accumulatedDurationRef.current = 0;
    setIsPaused(false);
    setError(null);
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (levelIntervalRef.current) {
        clearInterval(levelIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    analyserNode,
    audioLevel,
    isSilent,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
}

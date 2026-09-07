import React, { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyserNode,
  isRecording,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let bufferLength = 32;
    let dataArray = new Uint8Array(bufferLength);

    if (analyserNode) {
      analyserNode.fftSize = 64;
      bufferLength = analyserNode.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (isRecording && analyserNode) {
        analyserNode.getByteFrequencyData(dataArray);
      } else if (isRecording) {
        // Fallback synthetic wave when analyser isn't ready
        const time = Date.now() * 0.005;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.floor(
            40 + Math.sin(time + i * 0.3) * 35 + Math.random() * 20
          );
        }
      } else {
        // Idle flatline
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = 8;
        }
      }

      const barCount = 28;
      const barWidth = Math.max(3, (width - (barCount - 1) * 3) / barCount);
      let x = 0;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const value = isRecording ? dataArray[dataIndex] || 10 : 8;
        const percent = Math.min(1, Math.max(0.1, value / 255));
        const barHeight = Math.max(4, percent * height * 0.85);
        const y = (height - barHeight) / 2;

        // Gradient coloring
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isRecording) {
          gradient.addColorStop(0, "#ef4444"); // red-500
          gradient.addColorStop(0.5, "#f97316"); // orange-500
          gradient.addColorStop(1, "#eab308"); // yellow-500
        } else {
          gradient.addColorStop(0, "#94a3b8"); // slate-400
          gradient.addColorStop(1, "#cbd5e1"); // slate-300
        }

        ctx.fillStyle = gradient;
        // Rounded bar
        const radius = barWidth / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();

        x += barWidth + 3;
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isRecording]);

  return (
    <div className="w-full h-12 flex items-center justify-center bg-slate-900/60 rounded-xl px-4 border border-slate-700/60 overflow-hidden shadow-inner">
      <canvas
        ref={canvasRef}
        width={320}
        height={48}
        className="w-full max-w-sm h-full"
      />
    </div>
  );
};

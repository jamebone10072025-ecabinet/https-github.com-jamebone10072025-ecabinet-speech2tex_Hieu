/**
 * Generates SRT (SubRip) and VTT (WebVTT) subtitle formats from transcript text
 */

export function generateSrt(text: string, estimatedDurationSeconds: number = 60): string {
  const lines = text
    .split(/(?<=[.?!;:\n])\s+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return "";

  const secondsPerLine = Math.max(3, estimatedDurationSeconds / lines.length);
  let srtContent = "";

  lines.forEach((line, index) => {
    const startSec = index * secondsPerLine;
    const endSec = (index + 1) * secondsPerLine;

    srtContent += `${index + 1}\n`;
    srtContent += `${formatSrtTime(startSec)} --> ${formatSrtTime(endSec)}\n`;
    srtContent += `${line}\n\n`;
  });

  return srtContent.trim();
}

export function generateVtt(text: string, estimatedDurationSeconds: number = 60): string {
  const srt = generateSrt(text, estimatedDurationSeconds);
  const vtt = "WEBVTT\n\n" + srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return vtt;
}

function formatSrtTime(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);

  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`;
}

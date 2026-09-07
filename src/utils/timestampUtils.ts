/**
 * Utility functions for recording timestamps and formatting
 */

/**
 * Formats a duration in seconds into a standard [mm:ss] or [hh:mm:ss] timestamp tag.
 * Example: 30 -> "[00:30]", 75 -> "[01:15]", 3665 -> "[01:01:05]"
 */
export function formatTimestamp(totalSeconds: number): string {
  const safeSecs = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safeSecs / 3600);
  const mins = Math.floor((safeSecs % 3600) / 60);
  const secs = safeSecs % 60;

  if (hrs > 0) {
    return `[${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}]`;
  }
  return `[${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}]`;
}

/**
 * Inserts a timestamp tag into existing text with clean spacing and paragraph breaks.
 * Prevents immediately repeating the exact same timestamp.
 */
export function insertTimestampToText(
  currentText: string,
  totalSeconds: number,
  customTag?: string
): string {
  const tag = customTag || formatTimestamp(totalSeconds);
  const trimmed = currentText.trim();

  if (!trimmed) {
    return `${tag} `;
  }

  // If text already ends with this exact tag or tag with trailing space, don't duplicate
  if (trimmed.endsWith(tag) || currentText.endsWith(`${tag} `)) {
    return currentText;
  }

  // Append with double newline for clean readability
  return `${trimmed}\n\n${tag} `;
}

/**
 * Checks if a string contains any [mm:ss] or [hh:mm:ss] timestamp tags
 */
export function hasTimestamps(text: string): boolean {
  return /\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(text);
}

/**
 * Removes all [mm:ss] or [hh:mm:ss] timestamps from text (for clean plain-text copy)
 */
export function stripTimestamps(text: string): string {
  return text
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parses all timestamped segments from text
 */
export interface TimestampSegment {
  timestamp: string;
  seconds: number;
  content: string;
}

export function parseTimestampSegments(text: string): TimestampSegment[] {
  const regex = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;
  const segments: TimestampSegment[] = [];
  let match: RegExpExecArray | null;
  const matches: Array<{ tag: string; seconds: number; index: number }> = [];

  while ((match = regex.exec(text)) !== null) {
    let secs = 0;
    if (match[3] !== undefined) {
      // hh:mm:ss
      secs = parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
    } else {
      // mm:ss
      secs = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    matches.push({
      tag: match[0],
      seconds: secs,
      index: match.index,
    });
  }

  if (matches.length === 0) {
    if (text.trim()) {
      segments.push({
        timestamp: "[00:00]",
        seconds: 0,
        content: text.trim(),
      });
    }
    return segments;
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const startPos = current.index + current.tag.length;
    const endPos = next ? next.index : text.length;
    const content = text.slice(startPos, endPos).trim();

    segments.push({
      timestamp: current.tag,
      seconds: current.seconds,
      content,
    });
  }

  return segments;
}

import LZString from "lz-string";
import { SummaryResult, SessionCategory } from "../types";

export interface ShareablePayload {
  v: number; // schema version
  t: string; // title
  c?: SessionCategory | string; // category
  l?: string; // language
  tx: string; // transcript
  s?: SummaryResult | null; // summary
  ts: number; // timestamp
}

/**
 * Encodes session data into a compressed, URL-safe hash string and returns the full shareable URL
 */
export function generateShareableUrl(data: {
  title: string;
  category?: SessionCategory | string;
  language?: string;
  transcript: string;
  summary?: SummaryResult | null;
  includeSummary?: boolean;
}): { url: string; rawHash: string; byteLength: number } {
  const payload: ShareablePayload = {
    v: 1,
    t: data.title || "Bản ghi âm chia sẻ",
    c: data.category,
    l: data.language,
    tx: data.transcript,
    s: data.includeSummary !== false ? data.summary : null,
    ts: Date.now(),
  };

  const jsonStr = JSON.stringify(payload);
  const compressed = LZString.compressToEncodedURIComponent(jsonStr);
  const hash = `share=${compressed}`;

  // Build clean URL without existing hashes
  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  const url = `${base}#${hash}`;

  return {
    url,
    rawHash: hash,
    byteLength: new Blob([compressed]).size,
  };
}

/**
 * Parses and decompresses session data from current URL hash
 */
export function parseShareableHash(hashString?: string): ShareablePayload | null {
  const currentHash = hashString !== undefined ? hashString : window.location.hash;
  if (!currentHash) return null;

  // Look for #share=...
  const match = currentHash.match(/[#&]share=([^&]+)/);
  if (!match || !match[1]) return null;

  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(match[1]);
    if (!decompressed) return null;

    const parsed: ShareablePayload = JSON.parse(decompressed);
    if (!parsed || typeof parsed.tx !== "string") {
      return null;
    }
    return parsed;
  } catch (err) {
    console.error("Failed to parse shareable link hash:", err);
    return null;
  }
}

/**
 * Safely removes the hash from the current browser address bar without reloading
 */
export function clearShareHash(): void {
  if (window.location.hash) {
    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", cleanUrl);
  }
}

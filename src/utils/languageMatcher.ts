import { SUPPORTED_LANGUAGES } from "../data/languages";
import { SupportedLanguage } from "../types";

/**
 * Robustly matches any language code, ISO string, English name, or native name
 * to the corresponding SupportedLanguage in our application.
 */
export function findMatchingLanguage(
  codeOrName?: string | null,
  englishName?: string | null
): SupportedLanguage | null {
  const candidates = [codeOrName, englishName].filter(
    (c): c is string => typeof c === "string" && c.trim().length > 0
  );

  for (const raw of candidates) {
    const normalized = raw.trim().toLowerCase();

    // 1. Exact match by code or recognitionCode (e.g. "vi-vn", "en-us", "ja-jp")
    const exactCode = SUPPORTED_LANGUAGES.find(
      (l) =>
        l.code.toLowerCase() === normalized ||
        l.recognitionCode.toLowerCase() === normalized
    );
    if (exactCode) return exactCode;

    // 2. Primary subtag match (e.g. "vi" matches "vi-VN", "en" matches "en-US", "ja" matches "ja-JP", "ko" matches "ko-KR", "zh" matches "zh-CN", "fr" matches "fr-FR", etc.)
    const primary = normalized.split(/[-_]/)[0];
    if (primary && primary.length >= 2) {
      const subtagMatch = SUPPORTED_LANGUAGES.find((l) =>
        l.code.toLowerCase().startsWith(primary + "-")
      );
      if (subtagMatch) return subtagMatch;
    }

    // 3. Exact match by englishName or native name
    const exactName = SUPPORTED_LANGUAGES.find(
      (l) =>
        l.englishName.toLowerCase() === normalized ||
        l.name.toLowerCase() === normalized
    );
    if (exactName) return exactName;

    // 4. Substring / contains match
    const fuzzyMatch = SUPPORTED_LANGUAGES.find(
      (l) =>
        normalized.includes(l.englishName.toLowerCase()) ||
        normalized.includes(l.name.toLowerCase()) ||
        l.englishName.toLowerCase().includes(normalized) ||
        l.name.toLowerCase().includes(normalized)
    );
    if (fuzzyMatch) return fuzzyMatch;
  }

  return null;
}

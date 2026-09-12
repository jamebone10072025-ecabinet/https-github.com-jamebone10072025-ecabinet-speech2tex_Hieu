import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
// @ts-ignore
import html2pdf from "html2pdf.js";
import { SummaryResult, SessionCategory } from "../types";

export interface ExportDocumentOptions {
  title: string;
  category?: SessionCategory | string;
  dateStr?: string;
  languageName?: string;
  languageCode?: string;
  transcript: string;
  summary?: SummaryResult | null;
  includeTranscript?: boolean;
  includeSummary?: boolean;
  includeActionItems?: boolean;
  audioUrl?: string | null;
  embedAudio?: boolean;
  includeOfflineTTS?: boolean;
}

// Download blob helper
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Helper to escape HTML characters safely
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Convert audio URL or Blob to Base64 data URL for offline embedding
async function convertAudioUrlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Could not embed audio into HTML export:", err);
    return null;
  }
}

// Sanitize filename
function sanitizeFilename(title: string, ext: string): string {
  const clean = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${clean || "ban-ghi-am"}_${date}.${ext}`;
}

/**
 * Generate and download a Microsoft Word (.docx) document
 */
export async function exportToDocx(options: ExportDocumentOptions): Promise<void> {
  const {
    title,
    category = "Cuộc họp",
    dateStr = new Date().toLocaleString("vi-VN"),
    languageName = "Tiếng Việt",
    transcript,
    summary,
    includeTranscript = true,
    includeSummary = true,
    includeActionItems = true,
  } = options;

  const docChildren: any[] = [];

  // Title
  docChildren.push(
    new Paragraph({
      text: title || "Bản ghi âm & tóm tắt cuộc họp",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
    })
  );

  // Metadata Table (Category, Date, Language)
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Danh mục: ", bold: true, color: "475569" }),
                  new TextRun({ text: category, color: "0F172A" }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Thời gian: ", bold: true, color: "475569" }),
                  new TextRun({ text: dateStr, color: "0F172A" }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Ngôn ngữ: ", bold: true, color: "475569" }),
                  new TextRun({ text: languageName, color: "0F172A" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  docChildren.push(metaTable);
  docChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));

  // AI Summary Section
  if (includeSummary && summary) {
    docChildren.push(
      new Paragraph({
        text: "1. Tóm tắt nội dung thông minh (Gemini AI)",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 150 },
      })
    );

    // Summary Title & Sentiment
    if (summary.title) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Chủ đề: ", bold: true }),
            new TextRun({ text: summary.title, bold: true, color: "2563EB" }),
          ],
          spacing: { after: 100 },
        })
      );
    }

    // Overview
    if (summary.overview) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Tổng quan điều hành:", bold: true, italics: true }),
          ],
          spacing: { after: 80 },
        })
      );
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: summary.overview })],
          spacing: { after: 200 },
        })
      );
    }

    // Key points
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "Các luận điểm cốt lõi:", bold: true })],
          spacing: { after: 100 },
        })
      );
      summary.keyPoints.forEach((point) => {
        const pointText =
          typeof point === "string"
            ? point
            : point.heading && point.detail
            ? `${point.heading}: ${point.detail}`
            : point.heading || point.detail || "";
        docChildren.push(
          new Paragraph({
            text: `• ${pointText}`,
            spacing: { after: 60 },
          })
        );
      });
      docChildren.push(new Paragraph({ text: "", spacing: { after: 150 } }));
    }

    // Action items
    if (includeActionItems && summary.actionItems && summary.actionItems.length > 0) {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "Kế hoạch hành động & Phân công nhiệm vụ:", bold: true })],
          spacing: { after: 100 },
        })
      );
      summary.actionItems.forEach((item) => {
        const itemText = typeof item === "string" ? item : (item as any).task || JSON.stringify(item);
        docChildren.push(
          new Paragraph({
            text: `[ ] ${itemText}`,
            spacing: { after: 60 },
          })
        );
      });
      docChildren.push(new Paragraph({ text: "", spacing: { after: 150 } }));
    }

    // Topics
    if (summary.topics && summary.topics.length > 0) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Từ khóa chính: ", bold: true }),
            new TextRun({ text: summary.topics.join(", "), italics: true }),
          ],
          spacing: { after: 300 },
        })
      );
    }
  }

  // Full Transcript Section
  if (includeTranscript && transcript.trim()) {
    docChildren.push(
      new Paragraph({
        text: includeSummary && summary ? "2. Nội dung bản ghi chi tiết (Full Transcript)" : "Nội dung bản ghi (Transcript)",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 150 },
      })
    );

    // Split paragraphs
    const paragraphs = transcript.split(/\n\s*\n|\n/);
    paragraphs.forEach((p) => {
      if (p.trim()) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: p.trim() })],
            spacing: { after: 120 },
          })
        );
      }
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, sanitizeFilename(title, "docx"));
}

/**
 * Generate and download a PDF document using html2pdf
 */
export async function exportToPdf(options: ExportDocumentOptions): Promise<void> {
  const {
    title,
    category = "Cuộc họp",
    dateStr = new Date().toLocaleString("vi-VN"),
    languageName = "Tiếng Việt",
    transcript,
    summary,
    includeTranscript = true,
    includeSummary = true,
    includeActionItems = true,
  } = options;

  // Create temporary container for PDF rendering
  const container = document.createElement("div");
  container.style.width = "750px";
  container.style.padding = "36px";
  container.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  container.style.color = "#0f172a";
  container.style.backgroundColor = "#ffffff";
  container.style.lineHeight = "1.6";
  container.style.boxSizing = "border-box";

  // Build HTML representation
  let html = `
    <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #4f46e5; background: #eef2ff; padding: 4px 10px; border-radius: 9999px;">
          ${category}
        </span>
        <span style="font-size: 11px; color: #64748b;">${dateStr}</span>
      </div>
      <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; line-height: 1.3;">
        ${title || "Bản ghi âm & tóm tắt"}
      </h1>
      <p style="font-size: 12px; color: #64748b; margin: 0;">
        Ngôn ngữ: <strong>${languageName}</strong> • Xuất từ ứng dụng Voice to Text AI
      </p>
    </div>
  `;

  // Summary section
  if (includeSummary && summary) {
    html += `
      <div style="margin-bottom: 28px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; page-break-inside: avoid;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
          <h2 style="font-size: 15px; font-weight: 700; color: #1e293b; margin: 0;">
            1. Tóm tắt nội dung thông minh (Gemini AI)
          </h2>
          ${
            summary.sentiment
              ? `<span style="font-size: 11px; font-weight: 600; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 9999px;">${summary.sentiment}</span>`
              : ""
          }
        </div>

        ${
          summary.overview
            ? `<div style="margin-bottom: 16px;">
                <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0;">Tổng quan điều hành</p>
                <p style="font-size: 13px; color: #334155; margin: 0; line-height: 1.6; text-align: justify;">${summary.overview}</p>
              </div>`
            : ""
        }

        ${
          summary.keyPoints && summary.keyPoints.length > 0
            ? `<div style="margin-bottom: 16px;">
                <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0;">Luận điểm cốt lõi</p>
                <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #334155; line-height: 1.6;">
                  ${summary.keyPoints
                    .map((p) => {
                      const text =
                        typeof p === "string"
                          ? p
                          : p.heading && p.detail
                          ? `<strong>${p.heading}:</strong> ${p.detail}`
                          : p.heading || p.detail || "";
                      return `<li style="margin-bottom: 4px;">${text}</li>`;
                    })
                    .join("")}
                </ul>
              </div>`
            : ""
        }

        ${
          includeActionItems && summary.actionItems && summary.actionItems.length > 0
            ? `<div style="margin-bottom: 16px;">
                <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0;">Kế hoạch hành động & Phân công</p>
                <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #334155; line-height: 1.6; list-style-type: square;">
                  ${summary.actionItems.map((item) => {
                    const text = typeof item === "string" ? item : (item as any).task || JSON.stringify(item);
                    return `<li style="margin-bottom: 4px;">${text}</li>`;
                  }).join("")}
                </ul>
              </div>`
            : ""
        }

        ${
          summary.topics && summary.topics.length > 0
            ? `<div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
                <span style="font-size: 11px; color: #64748b;">Chủ đề chính: </span>
                ${summary.topics.map((t) => `<span style="display: inline-block; font-size: 11px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 6px; margin-right: 4px; color: #475569;">#${t}</span>`).join("")}
              </div>`
            : ""
        }
      </div>
    `;
  }

  // Full transcript section
  if (includeTranscript && transcript.trim()) {
    const formattedTranscript = transcript
      .trim()
      .split(/\n\s*\n|\n/)
      .map((p) => `<p style="font-size: 13px; color: #1e293b; line-height: 1.7; margin: 0 0 10px 0; text-align: justify;">${p.trim()}</p>`)
      .join("");

    html += `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
          ${includeSummary && summary ? "2. Toàn bộ nội dung bản ghi (Transcript)" : "Toàn bộ nội dung bản ghi (Transcript)"}
        </h2>
        <div style="background: #ffffff; padding: 4px 0;">
          ${formattedTranscript}
        </div>
      </div>
    `;
  }

  // Footer
  html += `
    <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
      Tài liệu được trích xuất tự động • Bản quyền thuộc về người dùng
    </div>
  `;

  container.innerHTML = html;
  document.body.appendChild(container);

  const opt = {
    margin: [10, 12, 10, 12] as [number, number, number, number],
    filename: sanitizeFilename(title, "pdf"),
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  try {
    await html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generate and download a standalone, self-contained HTML file that runs 100% offline
 * Includes embedded audio (Base64 data URI), offline browser TTS engine, interactive checklist, and search.
 */
export async function exportToHtml(options: ExportDocumentOptions): Promise<void> {
  const {
    title,
    category = "Cuộc họp",
    dateStr = new Date().toLocaleString("vi-VN"),
    languageName = "Tiếng Việt",
    languageCode = "vi-VN",
    transcript,
    summary,
    includeTranscript = true,
    includeSummary = true,
    includeActionItems = true,
    audioUrl,
    embedAudio = true,
    includeOfflineTTS = true,
  } = options;

  let embeddedAudioBase64: string | null = null;
  if (embedAudio && audioUrl) {
    embeddedAudioBase64 = await convertAudioUrlToBase64(audioUrl);
  }

  // Pre-format transcript paragraphs & timestamps
  const safeTitle = escapeHtml(title || "Bản ghi âm & tóm tắt");
  const safeCategory = escapeHtml(String(category));
  const safeDateStr = escapeHtml(dateStr);
  const safeLanguage = escapeHtml(languageName);
  const safeLangCode = escapeHtml(languageCode);

  // Prepare text for offline TTS reading
  let ttsTextSummary = "";
  if (summary) {
    const parts: string[] = [];
    if (summary.title) parts.push(`Tiêu đề: ${summary.title}.`);
    if (summary.overview) parts.push(`Tổng quan: ${summary.overview}`);
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      const kpStrs = summary.keyPoints.map((kp) =>
        typeof kp === "string"
          ? kp
          : kp.heading && kp.detail
          ? `${kp.heading}: ${kp.detail}`
          : kp.heading || kp.detail || ""
      );
      parts.push(`Các luận điểm chính: ${kpStrs.join(". ")}.`);
    }
    if (includeActionItems && summary.actionItems && summary.actionItems.length > 0) {
      const items = summary.actionItems
        .map((i) => (typeof i === "string" ? i : (i as any).task || ""))
        .filter(Boolean)
        .join(". ");
      parts.push(`Kế hoạch hành động: ${items}.`);
    }
    ttsTextSummary = parts.join("\n\n");
  }

  const rawFullText = [
    includeSummary && ttsTextSummary ? ttsTextSummary : "",
    includeTranscript && transcript ? `Toàn bộ bản ghi:\n${transcript}` : "",
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const fullTextToReadJson = JSON.stringify(rawFullText);
  const summaryTextToReadJson = JSON.stringify(ttsTextSummary);

  const htmlDoc = `<!DOCTYPE html>
<html lang="${safeLangCode || "vi"}" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - Ghi chép giọng nói offline</title>
  <meta name="description" content="Tài liệu tóm tắt và bản ghi âm giọng nói chạy offline độc lập">
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --primary-light: #eef2ff;
      --emerald: #059669;
      --emerald-light: #ecfdf5;
      --amber: #d97706;
      --radius: 16px;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07);
    }
    [data-theme="dark"] {
      --bg: #0b0f19;
      --card-bg: #141b2d;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --border: #242f49;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-light: #1e1b4b;
      --emerald: #10b981;
      --emerald-light: #064e3b;
      --amber: #f59e0b;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 24px 16px 48px;
      transition: background-color 0.2s, color 0.2s;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
    }
    header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    .badge-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .badge-primary {
      background: var(--primary-light);
      color: var(--primary);
    }
    .badge-emerald {
      background: var(--emerald-light);
      color: var(--emerald);
    }
    .badge-date {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-tool {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-tool:hover {
      background: var(--primary-light);
      color: var(--primary);
      border-color: var(--primary);
    }
    h1.doc-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--text);
      line-height: 1.3;
      margin-bottom: 8px;
    }
    .doc-meta-sub {
      font-size: 13px;
      color: var(--text-muted);
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
      gap: 8px;
    }
    .section-title {
      font-size: 17px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text);
    }
    /* Audio Player Box */
    .audio-player-box {
      background: var(--primary-light);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .audio-player-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--primary);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    audio {
      width: 100%;
      height: 40px;
      border-radius: 8px;
    }
    /* TTS Controller Bar */
    .tts-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: var(--shadow);
    }
    .tts-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tts-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--emerald);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tts-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .btn-tts {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      background: var(--primary);
      color: #ffffff;
      transition: all 0.15s;
    }
    .btn-tts:hover {
      background: var(--primary-hover);
    }
    .btn-tts-secondary {
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-tts-secondary:hover {
      background: var(--border);
    }
    .tts-speed-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .select-input {
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 12px;
      outline: none;
    }
    /* Overview & Points */
    .overview-text {
      font-size: 14px;
      line-height: 1.7;
      color: var(--text);
      margin-bottom: 16px;
      background: var(--bg);
      padding: 16px;
      border-radius: 12px;
      border-left: 4px solid var(--primary);
    }
    .key-points-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 18px;
    }
    .key-point-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 14px;
      line-height: 1.6;
    }
    .key-point-bullet {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary);
      margin-top: 8px;
      flex-shrink: 0;
    }
    /* Action items checklist */
    .action-items-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 18px;
    }
    .action-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 14px;
      line-height: 1.5;
      padding: 8px 12px;
      border-radius: 10px;
      background: var(--bg);
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }
    .action-item:hover {
      background: var(--primary-light);
    }
    .action-item input[type="checkbox"] {
      margin-top: 3px;
      accent-color: var(--primary);
      cursor: pointer;
      width: 16px;
      height: 16px;
    }
    .action-item.completed span {
      text-decoration: line-through;
      color: var(--text-muted);
    }
    /* Topics tags */
    .topics-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed var(--border);
    }
    .topic-tag {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-weight: 500;
    }
    /* Transcript Section */
    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .search-input {
      flex: 1;
      padding: 8px 14px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }
    .search-input:focus {
      border-color: var(--primary);
    }
    .transcript-body {
      font-size: 14px;
      line-height: 1.8;
      color: var(--text);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .transcript-paragraph {
      text-align: justify;
    }
    .timestamp-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      color: var(--primary);
      background: var(--primary-light);
      padding: 2px 6px;
      border-radius: 6px;
      margin-right: 6px;
      cursor: pointer;
      font-family: monospace;
    }
    .timestamp-badge:hover {
      text-decoration: underline;
    }
    .highlight {
      background-color: #fef08a;
      color: #854d0e;
      padding: 1px 3px;
      border-radius: 3px;
    }
    [data-theme="dark"] .highlight {
      background-color: #854d0e;
      color: #fef08a;
    }
    /* Footer */
    footer {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 24px;
    }
    /* Print Styles */
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
      }
      header, .card {
        box-shadow: none !important;
        border: 1px solid #ccc !important;
        page-break-inside: avoid;
      }
      .header-actions, .audio-player-box, .tts-box, .search-box, .btn-tool {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header>
      <div class="header-top">
        <div class="badge-group">
          <span class="badge badge-primary">${safeCategory}</span>
          ${
            summary && summary.sentiment
              ? `<span class="badge badge-emerald">${escapeHtml(summary.sentiment)}</span>`
              : ""
          }
          <span class="badge-date">${safeDateStr}</span>
        </div>
        <div class="header-actions">
          <button class="btn-tool" onclick="toggleTheme()" id="btn-theme" title="Chuyển chế độ sáng / tối">
            🌙 Chế độ tối
          </button>
          <button class="btn-tool" onclick="window.print()" title="In hoặc lưu PDF">
            🖨️ In tài liệu
          </button>
          <button class="btn-tool" onclick="copyEntireDocument()" title="Sao chép toàn bộ">
            📋 Sao chép
          </button>
        </div>
      </div>
      <h1 class="doc-title">${safeTitle}</h1>
      <p class="doc-meta-sub">Ngôn ngữ: <strong>${safeLanguage}</strong> • Tệp chạy offline độc lập (Zero-Dependencies)</p>
    </header>

    ${
      embeddedAudioBase64
        ? `
    <!-- Embedded Audio Player (Offline Base64) -->
    <div class="audio-player-box">
      <div class="audio-player-title">
        <span>🎙️ Bản ghi âm giọng nói đính kèm (Phát offline)</span>
        <span style="font-size: 11px; opacity: 0.8;">Âm thanh nhúng trực tiếp</span>
      </div>
      <audio id="embedded-audio" controls preload="metadata">
        <source src="${embeddedAudioBase64}" type="audio/webm">
        Trình duyệt của bạn không hỗ trợ phát âm thanh trực tiếp.
      </audio>
      <div style="display: flex; gap: 8px; align-items: center; font-size: 11px; margin-top: 4px;">
        <button class="btn-tool" style="padding: 3px 8px;" onclick="seekAudio(-10)">⏪ -10s</button>
        <button class="btn-tool" style="padding: 3px 8px;" onclick="seekAudio(10)">+10s ⏩</button>
        <span style="margin-left: auto;">Tốc độ phát:</span>
        <select class="select-input" onchange="setAudioSpeed(this.value)">
          <option value="1" selected>1.0x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="1.75">1.75x</option>
          <option value="2">2.0x</option>
        </select>
      </div>
    </div>`
        : ""
    }

    ${
      includeOfflineTTS
        ? `
    <!-- Offline Text-to-Speech (TTS) Engine -->
    <div class="tts-box">
      <div class="tts-header">
        <div class="tts-title">
          <span>🔊 Bộ đọc giọng nói offline (Text-to-Speech trình duyệt)</span>
        </div>
        <div class="tts-speed-wrap">
          <span>Tốc độ:</span>
          <select class="select-input" id="tts-rate" onchange="updateTTSRate(this.value)">
            <option value="0.8">0.8x</option>
            <option value="1.0" selected>1.0x</option>
            <option value="1.2">1.2x</option>
            <option value="1.4">1.4x</option>
          </select>
          <span style="margin-left: 8px;">Giọng đọc:</span>
          <select class="select-input" id="tts-voice-select" style="max-width: 160px;">
            <option value="">Giọng mặc định</option>
          </select>
        </div>
      </div>
      <div class="tts-controls">
        ${
          includeSummary && summary
            ? `<button class="btn-tts" onclick="speakText('summary')" id="btn-tts-sum">
                ▶️ Đọc tóm tắt
              </button>`
            : ""
        }
        <button class="btn-tts btn-tts-secondary" onclick="speakText('all')" id="btn-tts-all">
          ▶️ Đọc toàn bộ
        </button>
        <button class="btn-tts btn-tts-secondary" onclick="pauseOrResumeTTS()" id="btn-tts-pause" style="display: none;">
          ⏸️ Tạm dừng
        </button>
        <button class="btn-tts btn-tts-secondary" onclick="stopTTS()" id="btn-tts-stop" style="display: none;">
          ⏹️ Dừng đọc
        </button>
        <span id="tts-status" style="font-size: 12px; color: var(--text-muted); margin-left: 8px;"></span>
      </div>
    </div>`
        : ""
    }

    ${
      includeSummary && summary
        ? `
    <!-- AI Summary Section -->
    <section class="card" id="summary-section">
      <div class="section-header">
        <div class="section-title">
          <span>✨ Tóm tắt nội dung thông minh</span>
        </div>
        <button class="btn-tool" onclick="copySummaryText()">Sao chép tóm tắt</button>
      </div>

      ${
        summary.title
          ? `<h2 style="font-size: 16px; font-weight: 700; color: var(--primary); margin-bottom: 12px;">${escapeHtml(summary.title)}</h2>`
          : ""
      }

      ${
        summary.overview
          ? `<div class="overview-text">${escapeHtml(summary.overview)}</div>`
          : ""
      }

      ${
        summary.keyPoints && summary.keyPoints.length > 0
          ? `
        <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">Luận điểm then chốt:</h3>
        <ul class="key-points-list">
          ${summary.keyPoints
            .map((kp) => {
              const content =
                typeof kp === "string"
                  ? escapeHtml(kp)
                  : kp.heading && kp.detail
                  ? `<strong>${escapeHtml(kp.heading)}:</strong> ${escapeHtml(kp.detail)}`
                  : escapeHtml(kp.heading || kp.detail || "");
              return `<li class="key-point-item"><span class="key-point-bullet"></span><span>${content}</span></li>`;
            })
            .join("")}
        </ul>`
          : ""
      }

      ${
        includeActionItems && summary.actionItems && summary.actionItems.length > 0
          ? `
        <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">Kế hoạch hành động & Phân công (Interactive Checklist):</h3>
        <div class="action-items-list" id="checklist">
          ${summary.actionItems
            .map((item, index) => {
              const text = typeof item === "string" ? item : (item as any).task || JSON.stringify(item);
              return `<label class="action-item" id="item-${index}">
                <input type="checkbox" onchange="toggleItem(${index})" id="chk-${index}">
                <span id="txt-${index}">${escapeHtml(text)}</span>
              </label>`;
            })
            .join("")}
        </div>`
          : ""
      }

      ${
        summary.topics && summary.topics.length > 0
          ? `
        <div class="topics-wrap">
          <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Chủ đề chính:</span>
          ${summary.topics
            .map((t) => `<span class="topic-tag">#${escapeHtml(t)}</span>`)
            .join("")}
        </div>`
          : ""
      }
    </section>`
        : ""
    }

    ${
      includeTranscript && transcript.trim()
        ? `
    <!-- Transcript Section -->
    <section class="card" id="transcript-section">
      <div class="section-header">
        <div class="section-title">
          <span>📝 Toàn bộ nội dung bản ghi (Transcript)</span>
        </div>
        <button class="btn-tool" onclick="copyTranscriptText()">Sao chép bản ghi</button>
      </div>

      <div class="search-box">
        <input 
          type="text" 
          id="search-input" 
          class="search-input" 
          placeholder="🔍 Tìm kiếm từ khóa trong bản ghi..." 
          oninput="handleSearch(this.value)"
        />
        <span id="search-count" style="font-size: 12px; color: var(--text-muted); white-space: nowrap;"></span>
      </div>

      <div class="transcript-body" id="transcript-content">
        ${transcript
          .split(/\n\s*\n|\n/)
          .filter((p) => p.trim())
          .map((para) => {
            // Highlight timestamps [00:15]
            const formattedPara = escapeHtml(para).replace(
              /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g,
              (match, timeStr) => {
                return `<span class="timestamp-badge" onclick="jumpToTime('${timeStr}')" title="Nhấp để tua tới ${timeStr}">${match}</span>`;
              }
            );
            return `<p class="transcript-paragraph">${formattedPara}</p>`;
          })
          .join("")}
      </div>
    </section>`
        : ""
    }

    <footer>
      Tài liệu được xuất từ <strong>Ghi chép giọng nói AI</strong> • Hoạt động hoàn toàn offline không cần internet
    </footer>
  </div>

  <script>
    // Embedded Data for Offline TTS & Search
    const SUMMARY_TEXT = ${summaryTextToReadJson};
    const FULL_TEXT = ${fullTextToReadJson};
    let currentSpeechUtterance = null;
    let ttsRate = 1.0;
    let availableVoices = [];

    // Dark/Light mode toggle
    function toggleTheme() {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('offline_doc_theme', next);
      document.getElementById('btn-theme').innerText = next === 'dark' ? '☀️ Chế độ sáng' : '🌙 Chế độ tối';
    }

    // Initialize Theme from localStorage or system preference
    (function initTheme() {
      const saved = localStorage.getItem('offline_doc_theme');
      if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        if (saved === 'dark') {
          const btn = document.getElementById('btn-theme');
          if (btn) btn.innerText = '☀️ Chế độ sáng';
        }
      }
    })();

    // Audio controls
    function seekAudio(delta) {
      const audio = document.getElementById('embedded-audio');
      if (audio) {
        audio.currentTime = Math.max(0, Math.min(audio.duration || 99999, audio.currentTime + delta));
        audio.play().catch(() => {});
      }
    }

    function setAudioSpeed(speed) {
      const audio = document.getElementById('embedded-audio');
      if (audio) {
        audio.playbackRate = parseFloat(speed);
      }
    }

    function jumpToTime(timeStr) {
      const audio = document.getElementById('embedded-audio');
      if (!audio) return;
      const parts = timeStr.split(':').map(Number);
      let seconds = 0;
      if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      audio.currentTime = seconds;
      audio.play().catch(() => {});
    }

    // Offline Browser Speech Synthesis (TTS)
    function populateVoices() {
      if (!('speechSynthesis' in window)) return;
      availableVoices = window.speechSynthesis.getVoices();
      const select = document.getElementById('tts-voice-select');
      if (!select) return;
      select.innerHTML = '<option value="">Giọng mặc định</option>';
      availableVoices.forEach((voice, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = voice.name + ' (' + voice.lang + ')';
        // Auto-select Vietnamese if available
        if (voice.lang.includes('vi') || voice.lang.includes('VN')) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = populateVoices;
      populateVoices();
    }

    function updateTTSRate(rate) {
      ttsRate = parseFloat(rate);
      if (currentSpeechUtterance && window.speechSynthesis.speaking) {
        // restart speech with new rate
        const text = currentSpeechUtterance.text;
        stopTTS();
        speakRaw(text);
      }
    }

    function speakText(mode) {
      const text = mode === 'summary' ? SUMMARY_TEXT : FULL_TEXT;
      speakRaw(text);
    }

    function speakRaw(text) {
      if (!('speechSynthesis' in window)) {
        alert('Trình duyệt không hỗ trợ Web Speech Synthesis.');
        return;
      }
      window.speechSynthesis.cancel();
      if (!text || !text.trim()) {
        alert('Không có nội dung văn bản để đọc.');
        return;
      }

      currentSpeechUtterance = new SpeechSynthesisUtterance(text);
      currentSpeechUtterance.rate = ttsRate;
      currentSpeechUtterance.lang = '${safeLangCode || "vi-VN"}';

      const voiceSelect = document.getElementById('tts-voice-select');
      if (voiceSelect && voiceSelect.value !== '') {
        const vIndex = parseInt(voiceSelect.value, 10);
        if (availableVoices[vIndex]) {
          currentSpeechUtterance.voice = availableVoices[vIndex];
        }
      }

      const statusEl = document.getElementById('tts-status');
      const pauseBtn = document.getElementById('btn-tts-pause');
      const stopBtn = document.getElementById('btn-tts-stop');

      currentSpeechUtterance.onstart = function() {
        if (statusEl) statusEl.textContent = '🔊 Đang đọc...';
        if (pauseBtn) { pauseBtn.style.display = 'inline-flex'; pauseBtn.innerText = '⏸️ Tạm Dừng'; }
        if (stopBtn) stopBtn.style.display = 'inline-flex';
      };

      currentSpeechUtterance.onpause = function() {
        if (statusEl) statusEl.textContent = '⏸️ Đã tạm dừng';
        if (pauseBtn) pauseBtn.innerText = '▶️ Tiếp Tục';
      };

      currentSpeechUtterance.onresume = function() {
        if (statusEl) statusEl.textContent = '🔊 Đang đọc...';
        if (pauseBtn) pauseBtn.innerText = '⏸️ Tạm Dừng';
      };

      currentSpeechUtterance.onend = function() {
        if (statusEl) statusEl.textContent = '✅ Đã đọc xong';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
      };

      currentSpeechUtterance.onerror = function() {
        if (statusEl) statusEl.textContent = '';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
      };

      window.speechSynthesis.speak(currentSpeechUtterance);
    }

    function pauseOrResumeTTS() {
      if (!('speechSynthesis' in window)) return;
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      } else if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
      }
    }

    function stopTTS() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const statusEl = document.getElementById('tts-status');
        const pauseBtn = document.getElementById('btn-tts-pause');
        const stopBtn = document.getElementById('btn-tts-stop');
        if (statusEl) statusEl.textContent = '';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
      }
    }

    // Interactive Checklist (with local storage)
    const CHECKLIST_STORAGE_KEY = 'checklist_${sanitizeFilename(title, "chk")}';
    function toggleItem(index) {
      const chk = document.getElementById('chk-' + index);
      const item = document.getElementById('item-' + index);
      if (chk && item) {
        if (chk.checked) {
          item.classList.add('completed');
        } else {
          item.classList.remove('completed');
        }
        saveChecklistState();
      }
    }

    function saveChecklistState() {
      const state = {};
      const chks = document.querySelectorAll('#checklist input[type="checkbox"]');
      chks.forEach(function(c, i) {
        state[i] = c.checked;
      });
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
    }

    (function loadChecklistState() {
      try {
        const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
        if (saved) {
          const state = JSON.parse(saved);
          Object.keys(state).forEach(function(idx) {
            const chk = document.getElementById('chk-' + idx);
            const item = document.getElementById('item-' + idx);
            if (chk && item && state[idx]) {
              chk.checked = true;
              item.classList.add('completed');
            }
          });
        }
      } catch(e) {}
    })();

    // Search in Transcript
    let originalTranscriptHtml = null;
    function handleSearch(query) {
      const contentEl = document.getElementById('transcript-content');
      const countEl = document.getElementById('search-count');
      if (!contentEl) return;

      if (!originalTranscriptHtml) {
        originalTranscriptHtml = contentEl.innerHTML;
      }

      if (!query || !query.trim()) {
        contentEl.innerHTML = originalTranscriptHtml;
        if (countEl) countEl.textContent = '';
        return;
      }

      const q = query.trim();
      let escaped = '';
      for (let i = 0; i < q.length; i++) {
        const ch = q.charAt(i);
        if ('-[]{}()*+?.,\\\\^$|#'.indexOf(ch) !== -1) {
          escaped += '\\\\' + ch;
        } else {
          escaped += ch;
        }
      }
      const regex = new RegExp('(' + escaped + ')', 'gi');
      let matches = 0;

      // Temporary div to inspect text nodes safely
      const temp = document.createElement('div');
      temp.innerHTML = originalTranscriptHtml;

      function highlightNode(node) {
        if (node.nodeType === 3) {
          const text = node.nodeValue;
          if (regex.test(text)) {
            const span = document.createElement('span');
            span.innerHTML = text.replace(regex, function(m) {
              matches++;
              return '<span class="highlight">' + m + '</span>';
            });
            node.parentNode.replaceChild(span, node);
          }
        } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName)) {
          for (let i = 0; i < node.childNodes.length; i++) {
            highlightNode(node.childNodes[i]);
          }
        }
      }

      highlightNode(temp);
      contentEl.innerHTML = temp.innerHTML;
      if (countEl) {
        countEl.textContent = matches > 0 ? matches + ' kết quả' : 'Không tìm thấy';
      }
    }

    // Clipboard helpers
    function copyText(str, msg) {
      navigator.clipboard.writeText(str).then(function() {
        alert(msg || 'Đã sao chép vào bộ nhớ tạm!');
      }).catch(function() {
        alert('Không thể sao chép tự động. Vui lòng chọn và nhấn Ctrl+C.');
      });
    }

    function copySummaryText() {
      copyText(SUMMARY_TEXT, 'Đã sao chép bản tóm tắt thành công!');
    }

    function copyTranscriptText() {
      const transcriptEl = document.getElementById('transcript-content');
      if (transcriptEl) {
        copyText(transcriptEl.innerText, 'Đã sao chép toàn bộ bản ghi âm!');
      }
    }

    function copyEntireDocument() {
      copyText(FULL_TEXT, 'Đã sao chép toàn bộ nội dung tài liệu!');
    }
  </script>
</body>
</html>`;

  const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, sanitizeFilename(title, "html"));
}

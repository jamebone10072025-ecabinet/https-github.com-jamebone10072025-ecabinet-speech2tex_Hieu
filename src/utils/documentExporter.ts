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
  transcript: string;
  summary?: SummaryResult | null;
  includeTranscript?: boolean;
  includeSummary?: boolean;
  includeActionItems?: boolean;
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
      text: title || "Bản Ghi Âm & Tóm Tắt Cuộc Họp",
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
        text: "1. Tóm Tắt Nội Dung Thông Minh (Gemini AI)",
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
        docChildren.push(
          new Paragraph({
            text: `• ${point}`,
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
        text: includeSummary && summary ? "2. Nội Dung Bản Ghi Chi Tiết (Full Transcript)" : "Nội Dung Bản Ghi (Transcript)",
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
        ${title || "Bản Ghi Âm & Tóm Tắt"}
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
            1. Tóm Tắt Nội Dung Thông Minh (Gemini AI)
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
                  ${summary.keyPoints.map((p) => `<li style="margin-bottom: 4px;">${p}</li>`).join("")}
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
          ${includeSummary && summary ? "2. Toàn Bộ Nội Dung Bản Ghi (Transcript)" : "Toàn Bộ Nội Dung Bản Ghi (Transcript)"}
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

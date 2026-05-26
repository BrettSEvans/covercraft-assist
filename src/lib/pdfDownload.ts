/**
 * pdfDownload.ts
 *
 * Converts an HTML string to a PDF blob using html2canvas + jsPDF, then
 * triggers a native OS "Save As" dialog so the user can rename the file and
 * choose a save location.
 *
 * Strategy:
 *  1. Prefer the File System Access API (showSaveFilePicker) — Chrome 86+,
 *     Edge 86+.  Shows a true OS file-picker with the suggested filename.
 *  2. Fall back to an <a download="…"> anchor click — works everywhere.
 *     Most browsers surface this through their own download UI; users with
 *     "Ask where to save each file" enabled will see the OS dialog.
 */

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ---------------------------------------------------------------------------
// Shared OS-dialog download helper (also used by docxExport)
// ---------------------------------------------------------------------------

interface SaveOptions {
  suggestedName: string;
  mimeType: string;
  extension: string;
  description: string;
}

/**
 * Attempt to show a real OS Save-As dialog via the File System Access API.
 * Falls back to a programmatic anchor-download on unsupported browsers or
 * if the user cancels (AbortError).
 */
export async function triggerFileSave(blob: Blob, opts: SaveOptions): Promise<void> {
  // ── File System Access API (Chrome/Edge) ─────────────────────────────────
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: opts.suggestedName,
        types: [
          {
            description: opts.description,
            accept: { [opts.mimeType]: ["." + opts.extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      // User dismissed the dialog — do nothing
      if (err?.name === "AbortError") return;
      // Any other error (e.g. permission denied) → fall through to anchor
    }
  }

  // ── Anchor-download fallback ──────────────────────────────────────────────
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay so the download has time to start
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

/** US Letter dimensions in points (1 pt = 1/72 inch). */
const LETTER_W_PT = 612;
const LETTER_H_PT = 792;

/** Width in CSS pixels that represents an 8.5-inch page at 96 dpi. */
const PAGE_WIDTH_PX = 816;

/**
 * Inject the font-override and print styles into the HTML so the PDF
 * matches what the iframe preview shows.
 */
function prepareHtml(html: string): string {
  const overrideStyle = `<style>
    * { font-family: Arial, sans-serif !important; }
    body {
      font-size: 11pt;
      margin: 0;
      padding: 0.5in;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1${overrideStyle}`);
  }
  return overrideStyle + html;
}

/**
 * Render an HTML string to a multi-page Letter-size PDF blob.
 * Shows the user an OS Save-As dialog with the given filename pre-filled.
 */
export async function downloadHtmlAsPdf(html: string, fileName: string): Promise<void> {
  // ── 1. Mount a hidden container at page width ─────────────────────────────
  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "left:-9999px",
    "top:0",
    `width:${PAGE_WIDTH_PX}px`,
    "background:#fff",
    "z-index:-1",
  ].join(";");
  container.innerHTML = prepareHtml(html);
  document.body.appendChild(container);

  try {
    // ── 2. Render to canvas ─────────────────────────────────────────────────
    const canvas = await html2canvas(container, {
      scale: 2,                 // 2× for crisp text
      useCORS: true,
      backgroundColor: "#ffffff",
      width: PAGE_WIDTH_PX,
      windowWidth: PAGE_WIDTH_PX,
      logging: false,
    });

    // ── 3. Build the PDF ────────────────────────────────────────────────────
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
      compress: true,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    // Total rendered height in PDF points
    const totalImgHeightPt = (canvas.height / canvas.width) * LETTER_W_PT;

    let remainingHeightPt = totalImgHeightPt;
    let pageYOffsetPt = 0;
    let firstPage = true;

    while (remainingHeightPt > 0) {
      if (!firstPage) pdf.addPage();

      // Draw the full image shifted upward so the correct slice is visible
      pdf.addImage(
        imgData,
        "JPEG",
        0,                    // x
        -pageYOffsetPt,       // y (negative = scroll image up)
        LETTER_W_PT,          // width
        totalImgHeightPt,     // height (full image, clipped by page)
      );

      pageYOffsetPt += LETTER_H_PT;
      remainingHeightPt -= LETTER_H_PT;
      firstPage = false;
    }

    // ── 4. Trigger OS Save-As dialog ────────────────────────────────────────
    const blob = pdf.output("blob");
    const safeName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    await triggerFileSave(blob, {
      suggestedName: safeName,
      mimeType: "application/pdf",
      extension: "pdf",
      description: "PDF Document",
    });
  } finally {
    document.body.removeChild(container);
  }
}

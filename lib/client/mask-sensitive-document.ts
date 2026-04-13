"use client";

import { PDFDocument, rgb } from "pdf-lib";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

/**
 * Simulated PII zones (ФИО, ИНН, адрес): black bars on typical header / patient blocks.
 * Real detection would run on-device with a model; here we only *imitate* masking for Privacy 1.0 UX.
 */
export async function maskFileForPrivacyPreview(file: File): Promise<{
  blob: Blob;
  mimeOut: string;
}> {
  if (file.type === "application/pdf") {
    const buf = await file.arrayBuffer();
    const masked = await maskPdfSimulatedPii(buf);
    const pdfBytes = new Uint8Array(masked.byteLength);
    pdfBytes.set(masked);
    return {
      blob: new Blob([pdfBytes], { type: "application/pdf" }),
      mimeOut: "application/pdf",
    };
  }

  if (IMAGE_TYPES.has(file.type)) {
    const blob = await maskRasterImageSimulatedPii(file);
    return { blob, mimeOut: "image/png" };
  }

  throw new Error("Формат файла колдоого алынбайт (PDF, PNG, JPG, WEBP).");
}

async function maskPdfSimulatedPii(arrayBuffer: ArrayBuffer): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const black = rgb(0, 0, 0);
  const pages = pdf.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const band = height * 0.14;
    page.drawRectangle({
      x: 0,
      y: height - band,
      width,
      height: band,
      color: black,
    });
    page.drawRectangle({
      x: width * 0.04,
      y: height * 0.42,
      width: width * 0.52,
      height: height * 0.09,
      color: black,
    });
    page.drawRectangle({
      x: width * 0.58,
      y: height * 0.72,
      width: width * 0.38,
      height: height * 0.12,
      color: black,
    });
  }

  return pdf.save();
}

async function maskRasterImageSimulatedPii(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas колдоосу жок");
  ctx.drawImage(bmp, 0, 0);
  bmp.close();

  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h * 0.14);
  ctx.fillRect(w * 0.04, h * 0.28, w * 0.55, h * 0.1);
  ctx.fillRect(w * 0.58, h * 0.06, w * 0.38, h * 0.11);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("PNG экспорт катасы"));
      },
      "image/png",
      0.92,
    );
  });
}

export function isSupportedAnalysisMime(mime: string): boolean {
  return mime === "application/pdf" || IMAGE_TYPES.has(mime);
}

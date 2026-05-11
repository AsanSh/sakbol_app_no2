import "server-only";

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

function pdftoppmAvailable(): boolean {
  try {
    const r = spawnSync("/bin/sh", ["-c", "command -v pdftoppm >/dev/null 2>&1"], { stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}

/**
 * Сканированный PDF (без текстового слоя): рендер первых страниц через Poppler `pdftoppm`,
 * затем Tesseract (rus+eng). Нужен пакет `poppler-utils` в образе Docker / на сервере.
 * Без pdftoppm возвращает пустую строку (мягкая деградация).
 */
export async function extractTextFromScannedPdfPages(
  buffer: Buffer,
  options?: { maxPages?: number; scaleTo?: number },
): Promise<string> {
  if (buffer.length === 0) return "";
  if (!pdftoppmAvailable()) {
    return "";
  }

  const maxPages = Math.min(8, Math.max(1, options?.maxPages ?? 4));
  const scaleTo = options?.scaleTo ?? 2000;

  const tmp = path.join(os.tmpdir(), `sakbol-pdf-ocr-${randomUUID()}`);
  const pdfPath = path.join(tmp, "doc.pdf");
  const outPrefix = path.join(tmp, "page");

  try {
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(pdfPath, buffer);

    const args = [
      "-png",
      "-f",
      "1",
      "-l",
      String(maxPages),
      "-scale-to",
      String(scaleTo),
      pdfPath,
      outPrefix,
    ];
    const run = spawnSync("pdftoppm", args, {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    if (run.status !== 0) {
      console.warn(
        "[pdf-poppler-ocr] pdftoppm exit",
        run.status,
        (run.stderr as string)?.slice?.(0, 400) ?? run.stderr,
      );
      return "";
    }

    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("rus+eng");
    await worker.setParameters({ preserve_interword_spaces: "1" });

    const parts: string[] = [];
    for (let i = 1; i <= maxPages; i++) {
      const imgPath = `${outPrefix}-${i}.png`;
      if (!fs.existsSync(imgPath)) break;
      const imgBuf = fs.readFileSync(imgPath);
      const {
        data: { text },
      } = await worker.recognize(imgBuf);
      const t = String(text ?? "").trim();
      if (t) parts.push(t);
    }
    await worker.terminate();

    return parts.join("\n\n").trim().slice(0, 60_000);
  } catch (e) {
    console.warn("[pdf-poppler-ocr]", e instanceof Error ? e.message : String(e));
    return "";
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

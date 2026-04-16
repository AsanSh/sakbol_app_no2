/**
 * Собирает data/lab-reference-chunks.json из PDF (корень репо).
 * node scripts/build-lab-reference.cjs
 *
 * LAB_REF_PDF — путь к PDF
 * LAB_REF_MAX_CHARS — обрезка (0 = вся книга); для меньшего артефакта: 400000
 */
const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

const root = path.join(__dirname, "..");
const pdfPath =
  process.env.LAB_REF_PDF ||
  path.join(root, "khiggins_rasshifrovka_laboratornykh_analizov.pdf");
const outDir = path.join(root, "data");
const outFile = path.join(outDir, "lab-reference-chunks.json");

const MAX_CHARS = Number(process.env.LAB_REF_MAX_CHARS || "0") || null;
const CHUNK_TARGET = 900;
const CHUNK_OVERLAP = 120;

function chunkText(text) {
  const cleaned = text.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n");
  const chunks = [];
  let i = 0;
  let id = 0;
  while (i < cleaned.length) {
    let end = Math.min(i + CHUNK_TARGET, cleaned.length);
    if (end < cleaned.length) {
      const slice = cleaned.slice(i, end);
      const lastPara = slice.lastIndexOf("\n\n");
      if (lastPara > CHUNK_TARGET * 0.4) end = i + lastPara + 2;
    }
    const piece = cleaned.slice(i, end).trim();
    if (piece.length > 80) {
      chunks.push({ id: String(id++), text: piece });
    }
    i = Math.max(end - CHUNK_OVERLAP, i + 1);
    if (i >= cleaned.length) break;
  }
  return chunks;
}

async function main() {
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found:", pdfPath);
    process.exit(1);
  }
  const buf = fs.readFileSync(pdfPath);
  const data = await pdf(buf);
  let text = data.text || "";
  if (MAX_CHARS && text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
    console.warn("Truncated to LAB_REF_MAX_CHARS=", MAX_CHARS);
  }
  const chunks = chunkText(text);
  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    source: "Higgins — Understanding Laboratory Investigations (RU transl.)",
    pagesApprox: data.numpages,
    chunkCount: chunks.length,
    chunks,
  };
  fs.writeFileSync(outFile, JSON.stringify(payload), "utf8");
  console.log("Wrote", outFile, "chunks:", chunks.length, "bytes:", fs.statSync(outFile).size);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

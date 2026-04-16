import { readFile } from "fs/promises";
import path from "path";

/** Пути к Noto Sans (кириллица) для pdf-lib + fontkit — иначе Helvetica падает на «Гемоглобин». */
export async function loadNotoSansCyrillicFonts(): Promise<{
  regular: Uint8Array;
  bold: Uint8Array;
}> {
  const dir = path.join(
    process.cwd(),
    "node_modules/@fontsource/noto-sans/files",
  );
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, "noto-sans-cyrillic-400-normal.woff2")),
    readFile(path.join(dir, "noto-sans-cyrillic-700-normal.woff2")),
  ]);
  return { regular: new Uint8Array(regular), bold: new Uint8Array(bold) };
}

import { readFile } from "fs/promises";
import path from "path";

const FONT_FILES = {
  regular: "noto-sans-cyrillic-400-normal.woff2",
  bold: "noto-sans-cyrillic-700-normal.woff2",
} as const;

/**
 * Noto Sans (кириллица) для pdf-lib + fontkit.
 * На Vercel в serverless нет `node_modules/@fontsource/.../files`, поэтому
 * шрифты лежат в `lib/pdf-fonts/bundled/` (копия из @fontsource/noto-sans).
 */
export async function loadNotoSansCyrillicFonts(): Promise<{
  regular: Uint8Array;
  bold: Uint8Array;
}> {
  const cwd = process.cwd();
  const bundledDir = path.join(cwd, "lib/pdf-fonts/bundled");
  const nodeDir = path.join(cwd, "node_modules/@fontsource/noto-sans/files");

  async function loadOne(which: keyof typeof FONT_FILES): Promise<Uint8Array> {
    const name = FONT_FILES[which];
    const paths = [
      path.join(bundledDir, name),
      path.join(nodeDir, name),
    ];
    let lastErr: unknown;
    for (const p of paths) {
      try {
        const buf = await readFile(p);
        return new Uint8Array(buf);
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(
      `PDF font missing (${name}). Expected at lib/pdf-fonts/bundled/ or node_modules. ${lastErr instanceof Error ? lastErr.message : ""}`,
    );
  }

  const [regular, bold] = await Promise.all([loadOne("regular"), loadOne("bold")]);
  return { regular, bold };
}

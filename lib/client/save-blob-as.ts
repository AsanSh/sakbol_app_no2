/**
 * Сохранение Blob: в поддерживаемых браузерах — системный диалог «Куда сохранить»
 * (File System Access API), иначе — скачивание через <a download>.
 */
export async function saveBlobWithPickerOrDownload(
  blob: Blob,
  suggestedName: string,
  pickerTypes?: Array<{ description: string; accept: Record<string, string[]> }>,
): Promise<void> {
  const w = window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle>;
  };

  const types =
    pickerTypes ??
    ([
      {
        description: "PDF",
        accept: { "application/pdf": [".pdf"] },
      },
    ] as const);

  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName,
        types: types as Array<{ description: string; accept: Record<string, string[]> }>,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

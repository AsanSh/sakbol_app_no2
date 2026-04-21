import "server-only";

import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import type { HealthDocumentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  HEALTH_DOCS_MAX_BYTES,
  HEALTH_DOC_ALLOWED_MIME,
  extForMime,
  publicDocumentDownloadPath,
  writeHealthDocumentToDisk,
} from "@/lib/health-documents-storage";

export type CreateHealthDocResult =
  | { ok: true; id: string; fileUrl: string }
  | { ok: false; error: string };

export async function createHealthDocumentForProfile(input: {
  profileId: string;
  title: string;
  category: HealthDocumentCategory;
  documentDate: Date | null;
  buffer: Buffer;
  mime: string;
}): Promise<CreateHealthDocResult> {
  const mime = input.mime || "application/octet-stream";
  if (!HEALTH_DOC_ALLOWED_MIME.has(mime)) {
    return { ok: false, error: `Unsupported mime: ${mime}` };
  }
  if (input.buffer.length === 0 || input.buffer.length > HEALTH_DOCS_MAX_BYTES) {
    return { ok: false, error: "File size invalid" };
  }

  const id = randomUUID();

  let fileUrl: string;
  let fileData: Buffer | null = null;
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      const ext = extForMime(mime);
      const blob = await put(`health-docs/${id}.${ext}`, input.buffer, {
        access: "public",
        contentType: mime,
      });
      fileUrl = blob.url;
    } else {
      await writeHealthDocumentToDisk(id, input.buffer, mime);
      fileUrl = publicDocumentDownloadPath(id);
      fileData = input.buffer;
    }
    await prisma.healthDocument.create({
      data: {
        id,
        profileId: input.profileId,
        title: input.title.slice(0, 500),
        fileUrl,
        category: input.category,
        documentDate: input.documentDate,
        mimeType: mime,
        bytes: input.buffer.length,
        fileData,
      },
    });
    return { ok: true, id, fileUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "create failed" };
  }
}

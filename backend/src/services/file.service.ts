import { eq } from 'drizzle-orm';
import { db, contextFiles } from '../db';
import { nanoid } from 'nanoid';
import { mkdir, writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export class FileService {
  async init(): Promise<void> {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }
  }

  async uploadFile(
    threatModelId: string,
    file: File,
    fileType: 'prd' | 'diagram' | 'screenshot' | 'other'
  ): Promise<{
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    fileType: string;
    storagePath: string;
    createdAt: string;
  }> {
    await this.init();

    const filename = `${nanoid()}-${file.name}`;
    const storagePath = join(UPLOAD_DIR, filename);

    // Write file to disk
    const buffer = await file.arrayBuffer();
    await writeFile(storagePath, Buffer.from(buffer));

    // Extract text for text-based files
    let extractedText: string | null = null;
    if (file.type.startsWith('text/') || file.type === 'application/json') {
      extractedText = await file.text();
    } else if (file.type === 'application/pdf') {
      // For PDF, we'd need a PDF parser - for now, store null
      extractedText = null;
    }

    // Save to database
    const [record] = await db
      .insert(contextFiles)
      .values({
        threatModelId,
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        fileType,
        storagePath,
        extractedText,
      })
      .returning();

    return {
      id: record.id,
      filename: record.filename,
      originalName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
      fileType: record.fileType,
      storagePath: record.storagePath,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async deleteFile(fileId: string): Promise<boolean> {
    const [file] = await db
      .select()
      .from(contextFiles)
      .where(eq(contextFiles.id, fileId))
      .limit(1);

    if (!file) return false;

    // Delete from disk
    try {
      await unlink(file.storagePath);
    } catch (err) {
      console.warn('Could not delete file from disk:', err);
    }

    // Delete from database
    await db.delete(contextFiles).where(eq(contextFiles.id, fileId));

    return true;
  }

  async getFile(fileId: string): Promise<{
    data: Buffer;
    filename: string;
    mimeType: string;
  } | null> {
    const [file] = await db
      .select()
      .from(contextFiles)
      .where(eq(contextFiles.id, fileId))
      .limit(1);

    if (!file) return null;

    try {
      const data = await readFile(file.storagePath);
      return {
        data,
        filename: file.originalName,
        mimeType: file.mimeType,
      };
    } catch {
      return null;
    }
  }

  async getExtractedText(fileId: string): Promise<string | null> {
    const [file] = await db
      .select({ extractedText: contextFiles.extractedText })
      .from(contextFiles)
      .where(eq(contextFiles.id, fileId))
      .limit(1);

    return file?.extractedText ?? null;
  }

  async getFilesByThreatModelId(threatModelId: string): Promise<any[]> {
    return db
      .select()
      .from(contextFiles)
      .where(eq(contextFiles.threatModelId, threatModelId));
  }
}

export const fileService = new FileService();

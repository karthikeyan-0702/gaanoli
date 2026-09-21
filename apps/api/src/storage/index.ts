import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { StorageStats } from '@gatube/shared';
import { config } from '../config/index.js';
import { logger } from '../middleware/logger.js';

export interface StorageService {
  saveFile(key: string, data: Buffer | Uint8Array): Promise<string>;
  getFileStream(key: string): Promise<Readable>;
  deleteFile(key: string): Promise<boolean>;
  fileExists(key: string): Promise<boolean>;
  getStats(): Promise<StorageStats>;
  getAbsolutePath(key: string): string;
}

export class LocalStorageService implements StorageService {
  private baseDir: string;

  constructor(baseDir = config.STORAGE_LOCAL_PATH) {
    this.baseDir = path.resolve(baseDir);
    this.ensureDirectory(this.baseDir);
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public getAbsolutePath(key: string): string {
    const safeKey = key.replace(/^[/\\]+/, '');
    const fullPath = path.resolve(this.baseDir, safeKey);

    // Path traversal defense
    const relative = path.relative(this.baseDir, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Security Exception: Path traversal detected for key "${key}"`);
    }

    return fullPath;
  }

  public async saveFile(key: string, data: Buffer | Uint8Array): Promise<string> {
    const filePath = this.getAbsolutePath(key);
    this.ensureDirectory(path.dirname(filePath));
    await fs.promises.writeFile(filePath, data);
    logger.debug('Saved file to local storage', { key, bytes: data.length });
    return filePath;
  }

  public async getFileStream(key: string): Promise<Readable> {
    const filePath = this.getAbsolutePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  public async deleteFile(key: string): Promise<boolean> {
    const filePath = this.getAbsolutePath(key);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    await fs.promises.unlink(filePath);
    logger.debug('Deleted file from local storage', { key });
    return true;
  }

  public async fileExists(key: string): Promise<boolean> {
    const filePath = this.getAbsolutePath(key);
    return fs.existsSync(filePath);
  }

  public async getStats(): Promise<StorageStats> {
    let totalBytes = 0;
    let fileCount = 0;

    const traverse = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          traverse(fullPath);
        } else if (entry.isFile()) {
          const stats = fs.statSync(fullPath);
          totalBytes += stats.size;
          fileCount += 1;
        }
      }
    };

    traverse(this.baseDir);

    const maxBytes = config.MAX_UPLOAD_SIZE_BYTES * 50; // allow 50x upload limit for total storage
    const availableBytes = Math.max(0, maxBytes - totalBytes);

    return {
      usedBytes: totalBytes,
      maxBytes,
      availableBytes,
      fileCount
    };
  }
}

export const storageService = new LocalStorageService();

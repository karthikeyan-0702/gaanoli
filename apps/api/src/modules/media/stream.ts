import { Request, Response } from 'express';
import fs from 'fs';

export function streamMediaFile(filePath: string, req: Request, res: Response, mimeType = 'video/mp4'): void {
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Media file not found' } });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (!match[1] && !match[2])) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const startPart = match[1] ?? '';
    const endPart = match[2] ?? '';
    let start = startPart ? Number.parseInt(startPart, 10) : Math.max(0, fileSize - Number.parseInt(endPart, 10));
    let end = endPart ? Number.parseInt(endPart, 10) : fileSize - 1;

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < 0) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    end = Math.min(end, fileSize - 1);

    if (start >= fileSize || start > end) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType
    });

    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes'
    });

    fs.createReadStream(filePath).pipe(res);
  }
}

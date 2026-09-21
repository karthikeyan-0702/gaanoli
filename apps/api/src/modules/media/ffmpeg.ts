import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { logger } from '../../middleware/logger.js';
import { config } from '../../config/index.js';

const execFileAsync = promisify(execFile);

export interface MediaProbeResult {
  durationSeconds: number;
  width?: number;
  height?: number;
  formatName: string;
  bitrateKbps?: number;
  videoCodec?: string;
  audioCodec?: string;
}

export async function checkMediaTools(): Promise<void> {
  try {
    await execFileAsync(config.FFMPEG_PATH, ['-version']);
    await execFileAsync(config.FFPROBE_PATH, ['-version']);
  } catch (error) {
    throw new Error(
      `FFmpeg runtime is unavailable (${config.FFMPEG_PATH}, ${config.FFPROBE_PATH}): ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
  }
}

export async function probeMedia(filePath: string): Promise<MediaProbeResult> {
  try {
    const { stdout } = await execFileAsync(config.FFPROBE_PATH, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]);

    const data = JSON.parse(stdout);
    const duration = parseFloat(data.format?.duration || '0');
    const bitrate = data.format?.bit_rate ? Math.round(parseInt(data.format.bit_rate, 10) / 1000) : undefined;
    const formatName = data.format?.format_name || 'unknown';

    const videoStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
    const audioStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio');

    return {
      durationSeconds: Math.round(duration),
      width: videoStream?.width,
      height: videoStream?.height,
      formatName,
      bitrateKbps: bitrate,
      videoCodec: videoStream?.codec_name,
      audioCodec: audioStream?.codec_name
    };
  } catch (error) {
    logger.warn('ffprobe execution failed, falling back to basic inspection', {
      error: error instanceof Error ? error.message : error,
      filePath
    });
    return {
      durationSeconds: 0,
      formatName: path.extname(filePath).replace('.', '') || 'mp4'
    };
  }
}

export async function generateThumbnail(videoPath: string, outputPath: string): Promise<string> {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Capture single frame at 1 second or 10%
    await execFileAsync(config.FFMPEG_PATH, [
      '-ss', '00:00:01',
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      outputPath
    ]);
    logger.debug('Generated thumbnail with ffmpeg', { videoPath, outputPath });
    return outputPath;
  } catch (error) {
    logger.warn('Failed to generate thumbnail using ffmpeg', {
      error: error instanceof Error ? error.message : error,
      videoPath
    });
    return '';
  }
}

import { execFile } from 'child_process';
import { access, mkdir, rename, unlink } from 'fs/promises';
import { constants } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { promisify } from 'util';
import { config } from '../config.js';
import { logger } from '../logger.js';

const execFileAsync = promisify(execFile);

const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.m4v', '.avi', '.mov']);
const AUDIO_CODECS_TO_FIX = new Set(['aac', 'eac3', 'truehd', 'mlp', 'dts', 'flac', 'opus']);

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  channels?: number;
  profile?: string;
}

interface ProbeResult {
  streams?: ProbeStream[];
}

export interface CompatibilityResult {
  filePath: string;
  changed: boolean;
  reason: string;
}

function isVideoFile(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(extname(filePath).toLowerCase());
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function probeMedia(filePath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'stream=codec_type,codec_name,channels,profile',
    '-of',
    'json',
    filePath,
  ]);

  return JSON.parse(stdout) as ProbeResult;
}

function needsAudioFix(probe: ProbeResult): boolean {
  const audioStreams = (probe.streams ?? []).filter((stream) => stream.codec_type === 'audio');

  return audioStreams.some((stream) => {
    const codec = stream.codec_name?.toLowerCase();
    const channels = stream.channels ?? 0;
    return Boolean(codec && AUDIO_CODECS_TO_FIX.has(codec) && channels > 2);
  });
}

function compatibleOutputPath(filePath: string): string {
  const extension = extname(filePath);
  const baseName = basename(filePath, extension);
  return join(dirname(filePath), `${baseName}.plex-ac3.mkv`);
}

async function uniqueArchivePath(filePath: string): Promise<string> {
  await mkdir(config.plexCompatibleAudioArchiveDir, { recursive: true });

  const extension = extname(filePath);
  const baseName = basename(filePath, extension);
  let candidate = join(config.plexCompatibleAudioArchiveDir, basename(filePath));
  let counter = 1;

  while (await pathExists(candidate)) {
    candidate = join(config.plexCompatibleAudioArchiveDir, `${baseName}.${counter}${extension}`);
    counter += 1;
  }

  return candidate;
}

async function archiveOriginal(filePath: string): Promise<void> {
  if (!config.plexCompatibleAudioArchiveDir) {
    return;
  }

  const archivePath = await uniqueArchivePath(filePath);
  await rename(filePath, archivePath);
  logger.info({ from: filePath, to: archivePath }, 'Archived original media file after Plex-compatible copy was created');
}

async function convertAudioToAc3(inputPath: string, outputPath: string): Promise<void> {
  const tempPath = `${outputPath}.tmp`;

  if (await pathExists(tempPath)) {
    await unlink(tempPath);
  }

  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-map',
      '0:v?',
      '-map',
      '0:a?',
      '-map',
      '0:s?',
      '-c:v',
      'copy',
      '-c:a',
      'ac3',
      '-b:a',
      '640k',
      '-ac',
      '6',
      '-c:s',
      'copy',
      '-max_muxing_queue_size',
      '1024',
      tempPath,
    ]);

    await rename(tempPath, outputPath);
  } catch (error) {
    if (await pathExists(tempPath)) {
      await unlink(tempPath);
    }
    throw error;
  }
}

export async function createPlexCompatibleAudioCopy(filePath: string): Promise<CompatibilityResult> {
  if (!isVideoFile(filePath)) {
    return { filePath, changed: false, reason: 'not a video file' };
  }

  const outputPath = compatibleOutputPath(filePath);
  if (filePath === outputPath || await pathExists(outputPath)) {
    return { filePath: outputPath, changed: false, reason: 'compatible copy already exists' };
  }

  let probe: ProbeResult;
  try {
    probe = await probeMedia(filePath);
  } catch (error) {
    logger.warn({ error, filePath }, 'Failed to inspect media compatibility');
    return { filePath, changed: false, reason: 'ffprobe failed' };
  }

  if (!needsAudioFix(probe)) {
    return { filePath, changed: false, reason: 'audio is already compatible' };
  }

  logger.info({ inputPath: filePath, outputPath }, 'Creating Plex-compatible AC3 audio copy');

  try {
    await convertAudioToAc3(filePath, outputPath);
    await archiveOriginal(filePath);
    logger.info({ inputPath: filePath, outputPath }, 'Created Plex-compatible AC3 audio copy');
    return { filePath: outputPath, changed: true, reason: 'converted multichannel audio to AC3' };
  } catch (error) {
    logger.error({ error, inputPath: filePath, outputPath }, 'Failed to create Plex-compatible AC3 audio copy');
    return { filePath, changed: false, reason: 'ffmpeg failed' };
  }
}

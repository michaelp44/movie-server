import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

const FORBIDDEN_SEGMENTS = new Set([
  '.aws',
  '.git',
  '.gnupg',
  '.ssh',
  '.wwebjs_auth',
  '.wwebjs_cache',
  'node_modules',
]);

const FORBIDDEN_EXTENSIONS = ['.key', '.p12', '.pem', '.pfx'];

function isInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot));
}

export async function resolveExistingPathInside(root: string, requestedPath: string): Promise<string> {
  const realRoot = await realpath(root);
  const candidate = await realpath(resolve(realRoot, requestedPath));

  if (!isInside(realRoot, candidate)) {
    throw new Error('Path is outside the configured workspace root');
  }

  return candidate;
}

export async function resolveExistingFileInside(root: string, requestedPath: string): Promise<string> {
  const candidate = await resolveExistingPathInside(root, requestedPath);
  const details = await stat(candidate);
  if (!details.isFile()) {
    throw new Error('Requested path is not a file');
  }
  return candidate;
}

export function assertSafeAgentReadablePath(root: string, candidate: string): void {
  const pathFromRoot = relative(root, candidate);
  const normalized = pathFromRoot.replaceAll('\\', '/');
  const segments = normalized.split('/').map((segment) => segment.toLowerCase());
  const fileName = segments.at(-1) ?? '';

  if (
    segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment)) ||
    segments.some((segment, index) => segment === 'data' && segments[index + 1] === 'whatsapp-agent') ||
    fileName === '.env' ||
    fileName.startsWith('.env.') ||
    fileName.includes('credentials') ||
    fileName.includes('secret') ||
    FORBIDDEN_EXTENSIONS.some((extension) => fileName.endsWith(extension))
  ) {
    throw new Error('Reading sensitive files is blocked');
  }
}

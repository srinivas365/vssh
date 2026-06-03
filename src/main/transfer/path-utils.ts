import path from 'node:path';
import type { FolderCopyMode } from '@shared/types';

export function basenameForPath(input: string): string {
  const trimmed = input.replace(/[\\/]+$/, '');
  return path.posix.basename(trimmed.replace(/\\/g, '/'));
}

export function joinRemotePath(directory: string, child: string): string {
  const cleanDir = directory === '/' ? '/' : directory.replace(/\/+$/, '');
  const cleanChild = child.replace(/^\/+/, '');
  return cleanDir === '/' ? `/${cleanChild}` : `${cleanDir}/${cleanChild}`;
}

export function computeFinalDestination(
  destinationDirectory: string,
  sourcePath: string,
  sourceType: 'file' | 'directory',
  folderMode: FolderCopyMode,
): string {
  if (sourceType === 'directory' && folderMode === 'contents-only') return destinationDirectory;
  return joinRemotePath(destinationDirectory, basenameForPath(sourcePath));
}

export function shouldCopyContentsOnly(sourceType: 'file' | 'directory', folderMode: FolderCopyMode): boolean {
  return sourceType === 'directory' && folderMode === 'contents-only';
}

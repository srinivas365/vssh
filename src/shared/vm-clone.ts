import type { Vm, VmInput } from './types';

/** Bump a numeric suffix or append " copy". */
export function nextCloneLabel(label: string): string {
  const trailing = label.match(/^(.*?)(\d+)(\D*)$/);
  if (trailing && trailing[3] === '') {
    const num = parseInt(trailing[2], 10) + 1;
    return `${trailing[1]}${String(num).padStart(trailing[2].length, '0')}`;
  }

  const copyMatch = label.match(/^(.+?) copy(?: (\d+))?$/);
  if (copyMatch) {
    const n = copyMatch[2] ? parseInt(copyMatch[2], 10) + 1 : 2;
    return `${copyMatch[1]} copy ${n}`;
  }

  return `${label} copy`;
}

export function buildCloneInput(source: Vm): VmInput {
  return {
    folderId: source.folderId,
    label: nextCloneLabel(source.label),
    host: source.host,
    port: source.port,
    username: source.username,
    authMethod: source.authMethod,
    keyPath: source.keyPath,
    autoSubmitEnabled: source.autoSubmitEnabled,
  };
}

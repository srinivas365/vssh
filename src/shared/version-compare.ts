export function normalizeVersionTag(tag: string): string {
  return tag.trim().replace(/^v/i, '');
}

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const partsA = normalizeVersionTag(a).split('.').map((n) => Number.parseInt(n, 10) || 0);
  const partsB = normalizeVersionTag(b).split('.').map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const av = partsA[i] ?? 0;
    const bv = partsB[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}

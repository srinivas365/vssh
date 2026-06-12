import { compareSemver, normalizeVersionTag } from '@shared/version-compare';
import type { UpdateCheckResult } from '@shared/types';

const GITHUB_OWNER = 'srinivas365';
const GITHUB_REPO = 'vssh';
const FETCH_TIMEOUT_MS = 10_000;

export interface GitHubRelease {
  tag_name: string;
  html_url: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
}

type FetchFn = typeof fetch;

export async function fetchLatestRelease(
  currentVersion: string,
  fetchImpl: FetchFn = fetch,
): Promise<GitHubRelease | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `vssh/${currentVersion}`,
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const release = await response.json() as GitHubRelease;
    if (release.draft || release.prerelease) return null;
    return release;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkForUpdates(
  currentVersion: string,
  fetchImpl?: FetchFn,
): Promise<UpdateCheckResult> {
  const normalizedCurrent = normalizeVersionTag(currentVersion);

  try {
    const release = await fetchLatestRelease(currentVersion, fetchImpl);
    if (!release) {
      return { status: 'current', currentVersion: normalizedCurrent };
    }

    const latestVersion = normalizeVersionTag(release.tag_name);
    if (compareSemver(latestVersion, normalizedCurrent) <= 0) {
      return { status: 'current', currentVersion: normalizedCurrent };
    }

    return {
      status: 'available',
      currentVersion: normalizedCurrent,
      latestVersion,
      releaseNotes: release.body?.trim() || 'No release notes provided.',
      releaseUrl: release.html_url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update check failed';
    return { status: 'error', message };
  }
}

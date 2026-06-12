import { describe, expect, it } from 'vitest';
import { checkForUpdates } from '../../src/main/updates/github-releases';
import type { GitHubRelease } from '../../src/main/updates/github-releases';

function mockFetch(release: GitHubRelease | null, status = 200): typeof fetch {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => release,
  }) as Response;
}

const baseRelease: GitHubRelease = {
  tag_name: 'v0.3.0',
  html_url: 'https://github.com/srinivas365/vssh/releases/tag/v0.3.0',
  body: 'Bug fixes',
  draft: false,
  prerelease: false,
};

describe('checkForUpdates', () => {
  it('reports an available update when GitHub has a newer tag', async () => {
    const result = await checkForUpdates('0.2.8', mockFetch(baseRelease));
    expect(result).toEqual({
      status: 'available',
      currentVersion: '0.2.8',
      latestVersion: '0.3.0',
      releaseNotes: 'Bug fixes',
      releaseUrl: baseRelease.html_url,
    });
  });

  it('reports current when versions match', async () => {
    const result = await checkForUpdates('0.3.0', mockFetch(baseRelease));
    expect(result).toEqual({ status: 'current', currentVersion: '0.3.0' });
  });

  it('ignores draft and prerelease releases', async () => {
    const draft = await checkForUpdates('0.2.8', mockFetch({ ...baseRelease, draft: true }));
    expect(draft).toEqual({ status: 'current', currentVersion: '0.2.8' });

    const prerelease = await checkForUpdates('0.2.8', mockFetch({ ...baseRelease, prerelease: true }));
    expect(prerelease).toEqual({ status: 'current', currentVersion: '0.2.8' });
  });

  it('returns an error when the network request fails', async () => {
    const result = await checkForUpdates('0.2.8', mockFetch(null, 503));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('503');
    }
  });
});

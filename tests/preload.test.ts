import { expect, it, vi } from 'vitest';
import { createGitHubClient } from '../src/github';
import { startPreload } from '../src/preload';
import type { IndexView } from '../src/types';
import { context, entry, sha } from './fixtures';
import { deferred, requests, setHttpHandler } from './gm';
const scope = { id: 'anonymous', login: null, authenticated: false };
async function complete() {
  let latest: IndexView | undefined;
  startPreload(context, scope, createGitHubClient(null), value => { latest = value; }, new AbortController().signal);
  await vi.waitFor(() => expect(latest?.state).toBe('complete'));
  return latest!;
}
it('truncatedRootRequiresEnumeration', async () => {
  setHttpHandler(async ({ url }) => {
    const u = new URL(url), id = u.pathname.split('/').pop();
    if (id === sha(2)) return { body: { sha: sha(2), truncated: u.searchParams.has('recursive'), tree: u.search ? [entry('a', 'tree', 4)] : [entry('a', 'tree', 4), entry('missing', 'tree', 5)] } };
    return { body: { sha: id, truncated: false, tree: [entry('found.ts')] } };
  });
  const result = await complete();
  expect([...result.entries.keys()].sort()).toEqual(['a', 'a/found.ts', 'missing', 'missing/found.ts']);
});
it('nonRecursiveTruncationStaysIncomplete', async () => {
  setHttpHandler(async () => ({ body: { sha: sha(2), truncated: true, tree: [] } }));
  let latest: IndexView | undefined;
  startPreload(context, scope, createGitHubClient(null), value => { latest = value; }, new AbortController().signal);
  await vi.waitFor(() => expect(latest?.state).toBe('partial'));
  expect(latest?.state).toBe('partial'); expect(latest?.pending).toBe(0); expect(requests).toHaveLength(2);
});
it('sameShaRetainsBothPaths', async () => {
  setHttpHandler(async ({ url }) => {
    const u = new URL(url), id = u.pathname.split('/').pop();
    return { body: { sha: id, truncated: id === sha(2) && !!u.search, tree: id === sha(2) ? u.search ? [] : [entry('a', 'tree', 4), entry('b', 'tree', 4)] : [entry('file.ts')] } };
  });
  const result = await complete(); expect(result.entries.has('a/file.ts')).toBe(true); expect(result.entries.has('b/file.ts')).toBe(true);
  expect(requests.filter(r => r.url.includes(sha(4)))).toHaveLength(1);
});
it('preloadContinuesAcrossBatches', async () => {
  let concurrent = 0, peak = 0;
  setHttpHandler(async ({ url }) => {
    concurrent++; peak = Math.max(peak, concurrent); await Promise.resolve(); concurrent--;
    const u = new URL(url), id = u.pathname.split('/').pop();
    return { headers: 'X-RateLimit-Remaining: 1000', body: { sha: id, truncated: id === sha(2) && !!u.search, tree: id === sha(2) ? u.search ? [] : Array.from({ length: 43 }, (_, i) => entry('d' + i, 'tree', i + 10)) : [entry('file.ts')] } };
  });
  const result = await complete(); expect(result.entries.has('d42/file.ts')).toBe(true); expect(requests).toHaveLength(45); expect(peak).toBeLessThanOrEqual(2);
});
it('quotaPauseBlocksEarlyResume', async () => {
  setHttpHandler(async () => ({ headers: 'X-RateLimit-Remaining: 5\r\nX-RateLimit-Reset: ' + Math.ceil((Date.now() + 60000) / 1000), body: { sha: sha(2), truncated: true, tree: [entry('loaded.ts')] } }));
  let latest: IndexView | undefined;
  const loader = startPreload(context, scope, createGitHubClient(null), value => { latest = value; }, new AbortController().signal);
  await vi.waitFor(() => expect(latest?.state).toBe('paused'));
  loader.resume(); await Promise.resolve();
  expect(latest?.entries.has('loaded.ts')).toBe(true); expect(requests).toHaveLength(1);
});
it('a second in-flight failure cannot remove an active Retry-After barrier', async () => {
  const late = deferred<{ body: unknown; status: number }>();
  setHttpHandler(async ({ url }) => {
    const u = new URL(url), id = u.pathname.split('/').pop();
    if (id === sha(2)) return { body: { sha: id, truncated: !!u.search, tree: u.search ? [] : [entry('a', 'tree', 4), entry('b', 'tree', 5)] } };
    if (id === sha(4)) return { status: 429, headers: 'Retry-After: 60\r\nX-RateLimit-Remaining: 100', body: {} };
    return late.promise;
  });
  let latest: IndexView | undefined;
  const loader = startPreload(context, scope, createGitHubClient(null), value => { latest = value; }, new AbortController().signal);
  await vi.waitFor(() => expect(latest?.state).toBe('paused'));
  const blockedUntil = latest!.resumeAt!;
  late.resolve({ status: 500, body: {} });
  await new Promise(done => setTimeout(done, 0));
  loader.resume(); await Promise.resolve();
  expect(latest?.resumeAt).toBeGreaterThanOrEqual(blockedUntil);
  expect(requests).toHaveLength(4);
});

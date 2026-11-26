import { expect, it, vi } from 'vitest';
import { createGitHubClient } from '../src/github';
import { renderText } from '../src/i18n';
import { startPreload } from '../src/preload';
import { readTreeBlock, writeTreeBlock } from '../src/storage';
import type { IndexView } from '../src/types';
import { context, entry, sha } from './fixtures';
import { GM, deferred, requests, setHttpHandler, values, type Reply } from './gm';
const scope = { id: 'anonymous', login: null, authenticated: false };
async function complete() {
  let latest: IndexView | undefined;
  const controller = new AbortController();
  startPreload(context, scope, createGitHubClient(null), value => { latest = value; }, controller.signal);
  try { await vi.waitFor(() => expect(latest?.state).toBe('complete')); return latest!; }
  finally { controller.abort(); await navigator.locks.request('opsgittrees:storage', async () => undefined); }
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
  await vi.waitFor(() => { expect(latest?.state).toBe('partial'); expect(latest?.pending).toBe(0); });
  expect(requests).toHaveLength(2);
});
it('sameShaRetainsBothPaths', async () => {
  setHttpHandler(async ({ url }) => {
    const u = new URL(url), id = u.pathname.split('/').pop();
    return { body: { sha: id, truncated: id === sha(2) && !!u.search, tree: id === sha(2) ? u.search ? [] : [entry('a', 'tree', 4), entry('b', 'tree', 4), entry('submodule', 'commit', 6), entry('leaf.ts')] : [entry('file.ts')] } };
  });
  const result = await complete(); expect(result.entries.has('a/file.ts')).toBe(true); expect(result.entries.has('b/file.ts')).toBe(true);
  expect(requests.filter(r => r.url.includes(sha(4)))).toHaveLength(1);
  expect(requests).toHaveLength(3);
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
  await vi.waitFor(() => { expect(latest?.state).toBe('paused'); expect(latest?.pending).toBe(1); });
  loader.resume(); await Promise.resolve();
  expect(latest?.entries.has('loaded.ts')).toBe(true); expect(requests).toHaveLength(1);
});
it('a second in-flight failure cannot remove an active Retry-After barrier', async () => {
  const rate = deferred<Reply>(), late = deferred<Reply>();
  setHttpHandler(async ({ url }) => {
    const u = new URL(url), id = u.pathname.split('/').pop();
    if (id === sha(2)) return { body: { sha: id, truncated: !!u.search, tree: u.search ? [] : [entry('a', 'tree', 4), entry('b', 'tree', 5)] } };
    if (id === sha(4)) return rate.promise;
    rate.resolve({ status: 429, headers: 'Retry-After: 60\r\nX-RateLimit-Remaining: 100', body: {} });
    return late.promise;
  });
  let latest: IndexView | undefined;
  const controller = new AbortController(), client = createGitHubClient(null), calls = vi.spyOn(client, 'getTree');
  const loader = startPreload(context, scope, client, value => { latest = value; }, controller.signal);
  try {
    await vi.waitFor(() => expect(latest?.state).toBe('paused'));
    const blockedUntil = latest!.resumeAt!;
    late.resolve({ status: 500, body: {} });
    await Promise.allSettled(calls.mock.results.map(result => result.value));
    await navigator.locks.request('opsgittrees:storage', async () => undefined);
    loader.resume(); await Promise.resolve();
    expect(latest?.resumeAt).toBeGreaterThanOrEqual(blockedUntil);
    expect(requests).toHaveLength(4);
  } finally {
    controller.abort(); rate.resolve({ status: 429, body: {} }); late.resolve({ status: 500, body: {} });
    await Promise.allSettled(calls.mock.results.map(result => result.value));
    await navigator.locks.request('opsgittrees:storage', async () => undefined);
  }
});
it('refreshRestoresOnlyCommittedBlocks', async () => {
  const oldReply = deferred<Reply>(), nextReply = deferred<Reply>();
  let secondLoad = false, latest: IndexView | undefined, oldChanges = 0;
  setHttpHandler(async ({ url }) => {
    const u = new URL(url), id = u.pathname.split('/').pop();
    if (id === sha(2)) return { body: { sha: id, truncated: !!u.search, tree: u.search ? [] : [entry('a', 'tree', 4), entry('b', 'tree', 5)] } };
    if (id === sha(4)) return { body: { sha: id, truncated: false, tree: [entry('file.ts')] } };
    return secondLoad ? nextReply.promise : oldReply.promise;
  });
  const oldController = new AbortController(), nextController = new AbortController();
  const oldClient = createGitHubClient(null), oldCalls = vi.spyOn(oldClient, 'getTree');
  const nextClient = createGitHubClient(null), nextCalls = vi.spyOn(nextClient, 'getTree');
  startPreload(context, scope, oldClient, () => { oldChanges++; }, oldController.signal);
  try {
    await vi.waitFor(async () => {
      expect(await readTreeBlock(context, scope, sha(2), false)).toMatchObject({ kind: 'response' });
      expect(await readTreeBlock(context, scope, sha(4), true)).toMatchObject({ kind: 'response' });
      expect(requests.some(request => request.url.includes(sha(5)))).toBe(true);
    });
    oldController.abort();
    const changesAtAbort = oldChanges;
    oldReply.resolve({ body: { sha: sha(5), truncated: false, tree: [entry('stale.ts')] } });
    await Promise.allSettled(oldCalls.mock.results.map(result => result.value));
    await navigator.locks.request('opsgittrees:storage', async () => undefined);
    expect(oldChanges).toBe(changesAtAbort);
    expect(await readTreeBlock(context, scope, sha(5), true)).toBeNull();
    requests.length = 0; secondLoad = true;
    startPreload(context, scope, nextClient, value => { latest = value; }, nextController.signal);
    await vi.waitFor(() => expect(latest?.entries.has('a/file.ts')).toBe(true));
    await vi.waitFor(() => expect(requests.map(request => new URL(request.url).pathname.split('/').pop())).toEqual([sha(5)]));
    nextReply.resolve({ body: { sha: sha(5), truncated: false, tree: [entry('fresh.ts')] } });
    await vi.waitFor(() => expect(latest?.state).toBe('complete'));
    expect(latest?.entries.has('b/fresh.ts')).toBe(true);
    expect(latest?.entries.has('b/stale.ts')).toBe(false);
  } finally {
    oldController.abort(); nextController.abort();
    oldReply.resolve({ body: {} }); nextReply.resolve({ body: {} });
    await Promise.allSettled([...oldCalls.mock.results, ...nextCalls.mock.results].map(result => result.value));
    await navigator.locks.request('opsgittrees:storage', async () => undefined);
  }
});
it.each(['split', 'enumeration', 'terminal'] as const)('splitAndEnumerationSkipRecursiveRefetch: %s', async kind => {
  if (kind === 'split') {
    await GM.setValue('ogt:cache:v2:' + JSON.stringify(['tree', context.repoId, sha(2), true, 'public']), JSON.stringify({ schema: 2, kind: 'split', repoId: context.repoId, scope: 'public', private: false, usedAt: Date.now(), treeSha: sha(2), recursive: true }));
  } else {
    await writeTreeBlock(context, scope, sha(2), false, { sha: sha(2), truncated: kind === 'terminal', tree: kind === 'terminal' ? [entry('known.ts')] : [entry('a', 'tree', 4)] });
  }
  setHttpHandler(async ({ url }) => {
    const u = new URL(url), id = u.pathname.split('/').pop();
    return { body: { sha: id, truncated: false, tree: id === sha(2) ? [entry('a', 'tree', 4)] : [entry('file.ts')] } };
  });
  let latest: IndexView | undefined;
  startPreload(context, scope, createGitHubClient(null), value => { latest = value; }, new AbortController().signal);
  await vi.waitFor(() => { expect(latest?.pending).toBe(0); expect(latest?.state).toBe(kind === 'terminal' ? 'partial' : 'complete'); });
  expect(requests.map(request => new URL(request.url).pathname.split('/').pop())).toEqual(kind === 'split' ? [sha(2), sha(4)] : kind === 'enumeration' ? [sha(4)] : []);
  if (kind === 'split') expect(new URL(requests[0]!.url).search).toBe('');
  expect(latest?.entries.has(kind === 'terminal' ? 'known.ts' : 'a/file.ts')).toBe(true);
});
it.each([
  { barrier: 'quota', missing: false }, { barrier: 'quota', missing: true },
  { barrier: 'retry', missing: false }, { barrier: 'retry', missing: true },
])('quotaDoesNotBlockCachedWork: $barrier missing=$missing', async ({ barrier, missing }) => {
  await writeTreeBlock(context, scope, sha(2), false, { sha: sha(2), truncated: false, tree: [entry('a', 'tree', 4), entry('b', 'tree', 5), entry('c', 'tree', 6)] });
  for (const id of missing ? [5, 6] : [4, 5, 6]) await writeTreeBlock(context, scope, sha(id), true, { sha: sha(id), truncated: false, tree: [entry('file.ts')] });
  const client = createGitHubClient(null), until = Date.now() + 60000;
  if (barrier === 'quota') { client.quota.remaining = 5; client.quota.resumeAt = until; }
  else client.quota.blockedUntil = until;
  let latest: IndexView | undefined;
  const loader = startPreload(context, scope, client, value => { latest = value; }, new AbortController().signal);
  await vi.waitFor(() => {
    expect(latest?.state).toBe(missing ? 'paused' : 'complete');
    expect(latest?.entries.has('b/file.ts')).toBe(true); expect(latest?.entries.has('c/file.ts')).toBe(true);
    expect(latest?.pending).toBe(missing ? 1 : 0);
  });
  loader.resume(); await Promise.resolve();
  expect(requests).toHaveLength(0);
});
it.each(['read', 'write'] as const)('cacheFailureDoesNotFailPreload: rejected %s', async operation => {
  const originalRead = GM.getValue, originalWrite = GM.setValue;
  const fault = operation === 'read'
    ? vi.spyOn(GM, 'getValue').mockImplementation(async (key, fallback) => { if (key.startsWith('ogt:cache:v2:')) throw new Error('Storage unavailable'); return originalRead(key, fallback); })
    : vi.spyOn(GM, 'setValue').mockImplementation(async (key, value) => { if (key.startsWith('ogt:cache:v2:')) throw new Error('Storage unavailable'); await originalWrite(key, value); });
  try {
    setHttpHandler(async ({ url }) => {
      const u = new URL(url), id = u.pathname.split('/').pop();
      return { body: { sha: id, truncated: id === sha(2) && !!u.search, tree: id === sha(2) ? u.search ? [entry('loaded.ts')] : [entry('child', 'tree', 4)] : [entry('file.ts')] } };
    });
    const result = await complete();
    expect([...result.entries.keys()]).toEqual(expect.arrayContaining(['loaded.ts', 'child/file.ts']));
    expect(renderText(result.reason!)).toMatch(/persistent.*memory/i);
    expect(requests).toHaveLength(3);
  } finally { fault.mockRestore(); }
});
it.each(['truncated', 'rate', 'network'] as const)('cache warnings do not override %s reasons', async failure => {
  const original = GM.setValue;
  const fault = vi.spyOn(GM, 'setValue').mockImplementation(async (key, value) => { if (key.startsWith('ogt:cache:v2:')) throw new Error('Storage unavailable'); await original(key, value); });
  try {
    setHttpHandler(async ({ url }) => {
      if (new URL(url).search) return { body: { sha: sha(2), truncated: true, tree: [entry('loaded.ts')] } };
      if (failure === 'truncated') return { body: { sha: sha(2), truncated: true, tree: [] } };
      return { status: failure === 'rate' ? 429 : 500, headers: failure === 'rate' ? 'Retry-After: 60' : '', body: {} };
    });
    let latest: IndexView | undefined;
    startPreload(context, scope, createGitHubClient(null), value => { latest = value; }, new AbortController().signal);
    await vi.waitFor(() => { expect(latest?.state).toBe(failure === 'truncated' ? 'partial' : failure === 'rate' ? 'paused' : 'failed'); expect(latest?.pending).toBe(failure === 'truncated' ? 0 : 1); });
    expect(latest?.entries.has('loaded.ts')).toBe(true);
    expect(renderText(latest!.reason!)).toMatch(failure === 'truncated' ? /truncated.*non-recursive/i : failure === 'rate' ? /rate limit/i : /HTTP 500/);
    expect(requests).toHaveLength(2);
  } finally { fault.mockRestore(); }
});
it.each(['write', 'lock'] as const)('slowStorageKeepsPathsAndUsesIdleSlot: %s', async waitOn => {
  const entered = deferred<void>(), release = deferred<void>(), enumeration = deferred<Reply>();
  const original = GM.setValue;
  let blocked = false;
  const fault = waitOn === 'write' ? vi.spyOn(GM, 'setValue').mockImplementation(async (key, value) => {
    if (!blocked && key.startsWith('ogt:cache:v2:')) { blocked = true; entered.resolve(); await release.promise; }
    await original(key, value);
  }) : undefined;
  const held = waitOn === 'lock' ? navigator.locks.request('opsgittrees:storage', async () => { entered.resolve(); await release.promise; }) : undefined;
  if (held) await entered.promise;
  setHttpHandler(async ({ url }) => {
    const u = new URL(url), id = u.pathname.split('/').pop();
    if (id === sha(2)) return u.search ? { body: { sha: id, truncated: true, tree: [entry('ready.ts')] } } : enumeration.promise;
    return { body: { sha: id, truncated: false, tree: [entry('file.ts')] } };
  });
  let latest: IndexView | undefined;
  const controller = new AbortController(), client = createGitHubClient(null), calls = vi.spyOn(client, 'getTree');
  startPreload(context, scope, client, value => { latest = value; }, controller.signal);
  try {
    await entered.promise;
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(latest?.entries.has('ready.ts')).toBe(true);
    expect(new URL(requests[1]!.url).search).toBe('');
    enumeration.resolve({ body: { sha: sha(2), truncated: false, tree: [entry('child', 'tree', 4)] } });
    await vi.waitFor(() => expect(latest?.entries.has('child')).toBe(true));
    expect(requests).toHaveLength(2);
    release.resolve(); await held;
    await vi.waitFor(() => expect(latest?.state).toBe('complete'));
    expect(latest?.entries.has('child/file.ts')).toBe(true); expect(requests).toHaveLength(3);
  } finally {
    controller.abort(); release.resolve(); enumeration.resolve({ body: {} }); await held;
    await Promise.allSettled(calls.mock.results.map(result => result.value));
    await navigator.locks.request('opsgittrees:storage', async () => undefined);
    fault?.mockRestore();
  }
});
it.each(['write', 'lock'] as const)('abortDuringStorageWaitStopsFollowupWork: %s', async waitOn => {
  const entered = deferred<void>(), release = deferred<void>(), enumeration = deferred<Reply>();
  const original = GM.setValue;
  let blocked = false;
  const fault = waitOn === 'write' ? vi.spyOn(GM, 'setValue').mockImplementation(async (key, value) => {
    if (!blocked && key.startsWith('ogt:cache:v2:')) { blocked = true; entered.resolve(); await release.promise; }
    await original(key, value);
  }) : undefined;
  const held = waitOn === 'lock' ? navigator.locks.request('opsgittrees:storage', async () => { entered.resolve(); await release.promise; }) : undefined;
  if (held) await entered.promise;
  setHttpHandler(async ({ url }) => new URL(url).search ? { body: { sha: sha(2), truncated: true, tree: [entry('ready.ts')] } } : enumeration.promise);
  let latest: IndexView | undefined, changes = 0;
  const controller = new AbortController(), client = createGitHubClient(null), calls = vi.spyOn(client, 'getTree');
  startPreload(context, scope, client, value => { latest = value; changes++; }, controller.signal);
  try {
    await entered.promise;
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(latest?.entries.has('ready.ts')).toBe(true);
    controller.abort();
    const changesAtAbort = changes;
    release.resolve(); enumeration.resolve({ body: { sha: sha(2), truncated: false, tree: [entry('late.ts'), entry('child', 'tree', 4)] } });
    await held;
    await Promise.allSettled(calls.mock.results.map(result => result.value));
    await navigator.locks.request('opsgittrees:storage', async () => undefined);
    expect(requests).toHaveLength(2); expect(changes).toBe(changesAtAbort);
    expect(latest?.entries.has('late.ts')).toBe(false);
  } finally {
    controller.abort(); release.resolve(); enumeration.resolve({ body: {} }); await held;
    await Promise.allSettled(calls.mock.results.map(result => result.value));
    await navigator.locks.request('opsgittrees:storage', async () => undefined);
    fault?.mockRestore();
  }
});
it.each(['permission', 'scope'] as const)('private cache work stops after %s changes', async failure => {
  const privateContext = { ...context, visibility: 'private' as const }, privateScope = { id: 'current', login: 'test', authenticated: true };
  values.set('ogt:credentials:v1', { id: privateScope.id, login: privateScope.login, token: 'test-token' });
  await writeTreeBlock(privateContext, privateScope, sha(2), false, { sha: sha(2), truncated: false, tree: [entry('a', 'tree', 4), entry('b', 'tree', 5)] });
  await writeTreeBlock(privateContext, privateScope, sha(5), true, { sha: sha(5), truncated: false, tree: [entry('secret.ts')] });
  const entered = deferred<void>(), release = deferred<void>(), denial = deferred<Reply>();
  const original = GM.getValue;
  const fault = vi.spyOn(GM, 'getValue').mockImplementation(async (key, fallback) => {
    if (key.startsWith('ogt:cache:v2:') && key.includes(sha(5))) { entered.resolve(); await release.promise; }
    return original(key, fallback);
  });
  setHttpHandler(async () => denial.promise);
  const controller = new AbortController(), client = createGitHubClient('test-token'), calls = vi.spyOn(client, 'getTree');
  let latest: IndexView | undefined;
  startPreload(privateContext, privateScope, client, value => { latest = value; }, controller.signal);
  try {
    await entered.promise;
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    if (failure === 'scope') values.set('ogt:credentials:v1', { id: 'replacement', login: null, token: null });
    denial.resolve({ status: 403, body: {} });
    await vi.waitFor(() => expect(latest?.state).toBe('failed'));
    release.resolve();
    await Promise.allSettled(calls.mock.results.map(result => result.value));
    await navigator.locks.request('opsgittrees:storage', async () => undefined);
    expect([...latest!.entries.keys()]).toEqual([]); expect(latest?.canResume).toBe(false);
    expect(requests).toHaveLength(1);
  } finally {
    controller.abort(); release.resolve(); denial.resolve({ status: 403, body: {} });
    await Promise.allSettled(calls.mock.results.map(result => result.value));
    fault.mockRestore();
  }
});

import { expect, it, vi } from 'vitest';
import { clearToken, configureToken, readAuthScope } from '../src/credentials';
import { purgePrivateData, readCommitTree, readSettings, readTree, readTreeBlock, readView, StorageLimitError, writeCommitTree, writeSettings, writeTree, writeTreeBlock, writeView } from '../src/storage';
import type { TreeResponse, ViewState } from '../src/types';
import { context, entry, sha } from './fixtures';
import { deferred, GM, setHttpHandler, values } from './gm';
async function authorize() { setHttpHandler(async () => ({ body: { id: 1, login: 'api-user' } })); return await configureToken('unit-test-token'); }
const privateContext = { ...context, visibility: 'private' as const };
const cachePrefix = 'ogt:cache:v2:';
const commitKey = (scope = 'public') => cachePrefix + JSON.stringify(['commit', context.repoId, context.commitSha, scope]);
const blockKey = (scope = 'public', treeSha = context.rootTreeSha, recursive = true) => cachePrefix + JSON.stringify(['tree', context.repoId, treeSha, recursive, scope]);
const response: TreeResponse = { sha: context.rootTreeSha, truncated: false, tree: [entry('cached.ts')] };
const responseRecord = () => ({ schema: 2, kind: 'response', repoId: context.repoId, scope: 'public', private: false, usedAt: 1, treeSha: context.rootTreeSha, recursive: true, response });
const splitRecord = (scope: string, treeSha = sha(4)) => ({ schema: 2, kind: 'split', repoId: context.repoId, scope, private: scope !== 'public', usedAt: 1, treeSha, recursive: true });
it('treeBlockIdentityAndValidation', async () => {
  const scope = await readAuthScope();
  await writeCommitTree(context, scope); await writeTreeBlock(context, scope, context.rootTreeSha, true, response);
  expect(await readCommitTree(context, scope)).toBe(context.rootTreeSha);
  expect(await readCommitTree({ ...context, commitSha: sha(9) }, scope)).toBeNull();
  expect(await readCommitTree({ ...context, repoId: 2 }, scope)).toBeNull();
  expect(await readTreeBlock(context, scope, context.rootTreeSha, true)).toEqual({ kind: 'response', response });
  expect(await readTreeBlock({ ...context, repoId: 2 }, scope, context.rootTreeSha, true)).toBeNull();
  expect(await readTreeBlock(context, scope, sha(9), true)).toBeNull();
  expect(await readTreeBlock(context, scope, context.rootTreeSha, false)).toBeNull();
  expect(await readTreeBlock({ ...context, commitSha: sha(9), rootTreeSha: sha(8) }, scope, context.rootTreeSha, true)).toEqual({ kind: 'response', response });
  const empty: TreeResponse = { sha: sha(5), truncated: false, tree: [] };
  await writeTreeBlock(context, scope, sha(5), false, empty);
  expect(await readTreeBlock(context, scope, sha(5), false)).toEqual({ kind: 'response', response: empty });
  values.set(blockKey('public', sha(4)), JSON.stringify(splitRecord('public')));
  expect(await readTreeBlock(context, scope, sha(4), true)).toEqual({ kind: 'split' });
  expect(await readTreeBlock(context, scope, sha(4), false)).toBeNull();
  for (const broken of [
    null, '{', { ...responseRecord(), schema: 1 }, { ...responseRecord(), kind: 'other' },
    { ...responseRecord(), repoId: 2 }, { ...responseRecord(), scope: 'other' }, { ...responseRecord(), private: true },
    { ...responseRecord(), usedAt: null }, { ...responseRecord(), treeSha: sha(8) }, { ...responseRecord(), recursive: false },
    { ...responseRecord(), response: { ...response, sha: sha(8) } },
    { ...responseRecord(), response: { ...response, truncated: 'false' } },
    { ...responseRecord(), response: { ...response, tree: [entry('../unsafe.ts')] } },
    { ...responseRecord(), response: { ...response, tree: [{ ...entry('bad.ts'), sha: 'bad' }] } },
    { ...splitRecord('public', context.rootTreeSha), response },
  ]) {
    values.set(blockKey(), typeof broken === 'string' ? broken : JSON.stringify(broken));
    expect(await readTreeBlock(context, scope, context.rootTreeSha, true)).toBeNull();
  }
  values.set(blockKey('public', sha(4), false), JSON.stringify({ ...splitRecord('public'), recursive: false }));
  expect(await readTreeBlock(context, scope, sha(4), false)).toBeNull();
  for (const changed of [{ schema: 1 }, { repoId: 2 }, { scope: 'other' }, { private: true }, { commitSha: sha(9) }, { treeSha: 'bad' }]) {
    values.set(commitKey(), JSON.stringify({ schema: 2, kind: 'commit', repoId: context.repoId, scope: 'public', private: false, usedAt: 1, commitSha: context.commitSha, treeSha: context.rootTreeSha, ...changed }));
    expect(await readCommitTree(context, scope)).toBeNull();
  }
});
it('privateCacheRequiresCurrentScope', async () => {
  const scope = await authorize();
  await writeCommitTree(privateContext, scope); await writeTreeBlock(privateContext, scope, context.rootTreeSha, true, response);
  const state: ViewState = { browsing: { expanded: ['private'], scrollTop: 0, anchorPath: null, anchorOffset: 0 }, search: null };
  await writeView(privateContext, scope, state);
  values.set(blockKey(scope.id, sha(4)), JSON.stringify(splitRecord(scope.id)));
  const legacyKey = 'ogt:data:v1:' + JSON.stringify(['tree', context.repoId, context.rootTreeSha, scope.id]);
  values.set(legacyKey, JSON.stringify({ schema: 1, scope: scope.id, private: true, usedAt: 1, entries: [entry('legacy-private.ts')] }));
  expect(await readCommitTree(privateContext, scope)).toBe(context.rootTreeSha);
  expect(await readTreeBlock(privateContext, scope, context.rootTreeSha, true)).toEqual({ kind: 'response', response });
  await clearToken();
  expect(await readCommitTree(privateContext, scope)).toBeNull();
  expect(await readTreeBlock(privateContext, scope, context.rootTreeSha, true)).toBeNull();
  expect(await readCommitTree(privateContext, await readAuthScope())).toBeNull();
  expect(await readTreeBlock(privateContext, await readAuthScope(), context.rootTreeSha, true)).toBeNull();
  await expect(writeCommitTree(privateContext, scope)).rejects.toMatchObject({ name: 'AbortError' });
  await expect(writeTreeBlock(privateContext, scope, context.rootTreeSha, true, response)).rejects.toMatchObject({ name: 'AbortError' });
  expect(await readTreeBlock(privateContext, scope, sha(4), true)).toBeNull();
  expect(await readView(privateContext, scope)).toBeNull();
  const next = await authorize();
  expect(await readCommitTree(privateContext, next)).toBeNull();
  expect(await readTreeBlock(privateContext, next, context.rootTreeSha, true)).toBeNull();
  await writeCommitTree(privateContext, next); await writeTreeBlock(privateContext, next, context.rootTreeSha, true, response);
  values.set(blockKey(next.id, sha(4)), JSON.stringify(splitRecord(next.id)));
  await writeView(privateContext, next, state);
  const currentLegacyKey = 'ogt:data:v1:' + JSON.stringify(['tree', context.repoId, context.rootTreeSha, next.id]);
  values.set(currentLegacyKey, JSON.stringify({ schema: 1, scope: next.id, private: true, usedAt: 1, entries: [entry('current-private.ts')] }));
  await writeCommitTree(context, next); await writeTreeBlock(context, next, context.rootTreeSha, true, response);
  values.set(blockKey('public', sha(4)), JSON.stringify(splitRecord('public')));
  await writeTree(context, next, [entry('legacy-public.ts')]);
  await purgePrivateData();
  expect([...values.keys()].filter(key => key.includes(scope.id))).toEqual([]);
  expect(values.has(legacyKey)).toBe(false);
  expect(await readCommitTree(privateContext, next)).toBe(context.rootTreeSha);
  expect(await readTreeBlock(privateContext, next, context.rootTreeSha, true)).toEqual({ kind: 'response', response });
  expect(await readTreeBlock(privateContext, next, sha(4), true)).toEqual({ kind: 'split' });
  expect(values.has(currentLegacyKey)).toBe(true); expect(await readView(privateContext, next)).toEqual(state);
  expect(await readCommitTree(context, next)).toBe(context.rootTreeSha);
  expect(await readTreeBlock(context, next, context.rootTreeSha, true)).toEqual({ kind: 'response', response });
  expect(await readTreeBlock(context, next, sha(4), true)).toEqual({ kind: 'split' });
  expect(await readTree(context, next)).toEqual([entry('legacy-public.ts')]);
  await purgePrivateData();
});
it('visibilityChangeStopsPublicReuse', async () => {
  const scope = await authorize(); await writeCommitTree(context, scope); await writeTreeBlock(context, scope, context.rootTreeSha, true, response);
  expect(await readCommitTree(privateContext, scope)).toBeNull();
  expect(await readTreeBlock(privateContext, scope, context.rootTreeSha, true)).toBeNull();
  values.set(commitKey(scope.id), values.get(commitKey())); values.set(blockKey(scope.id), values.get(blockKey()));
  expect(await readCommitTree(privateContext, scope)).toBeNull();
  expect(await readTreeBlock(privateContext, scope, context.rootTreeSha, true)).toBeNull();
});
it.each(['commit', 'response'] as const)('lateWriteCannotReviveClearedScope: %s', async kind => {
  const scope = await authorize(); const entered = deferred<void>(), release = deferred<void>();
  const original = GM.setValue;
  vi.spyOn(GM, 'setValue').mockImplementation(async (key, value) => { if (key.startsWith(cachePrefix)) { entered.resolve(); await release.promise; } await original(key, value); });
  const writing = kind === 'commit' ? writeCommitTree(privateContext, scope) : writeTreeBlock(privateContext, scope, context.rootTreeSha, true, response);
  const rejected = expect(writing).rejects.toMatchObject({ name: 'AbortError' });
  let cleanup: Promise<void> | undefined;
  try { await entered.promise; await clearToken(); cleanup = purgePrivateData(); }
  finally { release.resolve(); await Promise.all([rejected, cleanup]); }
  expect(await readCommitTree(privateContext, scope)).toBeNull(); expect(await readTreeBlock(privateContext, scope, context.rootTreeSha, true)).toBeNull();
  expect([...values.keys()].filter(key => key.startsWith(cachePrefix))).toEqual([]);
});
it.each(['commit', 'response'] as const)('private cache reads reject a scope revoked during GM retrieval: %s', async kind => {
  const scope = await authorize(); await writeCommitTree(privateContext, scope); await writeTreeBlock(privateContext, scope, context.rootTreeSha, true, response);
  const entered = deferred<void>(), release = deferred<void>(), original = GM.getValue;
  vi.spyOn(GM, 'getValue').mockImplementation(async (key, fallback) => {
    const result = await original(key, fallback);
    if (key === (kind === 'commit' ? commitKey(scope.id) : blockKey(scope.id))) { entered.resolve(); await release.promise; }
    return result;
  });
  const reading = kind === 'commit' ? readCommitTree(privateContext, scope) : readTreeBlock(privateContext, scope, context.rootTreeSha, true);
  try { await entered.promise; await clearToken(); }
  finally { release.resolve(); await reading; }
  expect(await reading).toBeNull();
});
it.each(['commit', 'response'] as const)('rejected GM writes are not reported as persisted: %s', async kind => {
  const scope = await readAuthScope(); const failure = new Error('Storage write rejected');
  vi.spyOn(GM, 'setValue').mockRejectedValueOnce(failure);
  await expect(kind === 'commit' ? writeCommitTree(context, scope) : writeTreeBlock(context, scope, context.rootTreeSha, true, response)).rejects.toBe(failure);
  expect(await readCommitTree(context, scope)).toBeNull(); expect(await readTreeBlock(context, scope, context.rootTreeSha, true)).toBeNull();
});
it('single-record admission uses the total application budget for old and new records', async () => {
  const scope = await readAuthScope(); const entries = [entry('x'.repeat(3 * 1024 * 1024))];
  await writeTree(context, scope, entries); expect(await readTree(context, scope)).toEqual(entries);
  await writeTreeBlock(context, scope, context.rootTreeSha, true, { ...response, tree: entries });
  expect(await readTreeBlock(context, scope, context.rootTreeSha, true)).toEqual({ kind: 'response', response: { ...response, tree: entries } });
  const oversized = [entry('x'.repeat(9 * 1024 * 1024))];
  await expect(writeTree(context, scope, oversized)).rejects.toBeInstanceOf(StorageLimitError);
  await expect(writeTreeBlock(context, scope, context.rootTreeSha, true, { ...response, tree: oversized })).rejects.toBeInstanceOf(StorageLimitError);
  expect(await readTreeBlock(context, scope, context.rootTreeSha, true)).toEqual({ kind: 'response', response: { ...response, tree: entries } });
});
it('reading state stays isolated by branch and includes both snapshots', async () => {
  const scope = await readAuthScope();
  const state: ViewState = { browsing: { expanded: ['docs'], scrollTop: 24, anchorPath: 'docs/a.md', anchorOffset: 0 }, search: { query: 'auth', view: { expanded: ['src/auth'], scrollTop: 48, anchorPath: 'src/auth/a.ts', anchorOffset: 0 }, collapsed: ['src/auth/hidden'] } };
  await writeView(context, scope, state);
  expect(await readView({ ...context, refName: 'dev' }, scope)).toBeNull();
  expect(await readView(context, scope)).toEqual(state);
});
it('an old cleanup cannot delete records written under a replacement credential', async () => {
  let next = await authorize();
  const entered = deferred<void>(), release = deferred<void>();
  const original = GM.listValues;
  vi.spyOn(GM, 'listValues').mockImplementationOnce(async () => { entered.resolve(); await release.promise; return original(); });
  const oldCleanup = purgePrivateData();
  let writing: Promise<void> | undefined;
  const state: ViewState = { browsing: { expanded: ['src'], scrollTop: 24, anchorPath: 'src', anchorOffset: 0 }, search: null };
  try {
    await entered.promise; next = await configureToken('replacement-token');
    writing = writeView(privateContext, next, state);
  } finally { release.resolve(); await Promise.all([oldCleanup, writing]); }
  expect(await readView(privateContext, next)).toEqual(state);
});
it('cleanup compares the current value before deleting a stale-scope record', async () => {
  const scope = await authorize(); await writeCommitTree(privateContext, scope);
  const key = commitKey(scope.id), stale = values.get(key);
  await clearToken();
  const replacement = JSON.stringify({ schema: 2, kind: 'commit', repoId: context.repoId, scope: scope.id, private: true, usedAt: 2, commitSha: context.commitSha, treeSha: sha(8) });
  const original = GM.getValue; let scanned = false;
  vi.spyOn(GM, 'getValue').mockImplementation(async (name, fallback) => {
    if (name === key && !scanned) { scanned = true; values.set(key, replacement); return stale as never; }
    return original(name, fallback);
  });
  await purgePrivateData(); expect(values.get(key)).toBe(replacement);
});
it('page-exit view persistence submits synchronously even while the storage lock is held', async () => {
  const scope = await readAuthScope(), entered = deferred<void>(), release = deferred<void>();
  const holder = navigator.locks.request('opsgittrees:storage', async () => { entered.resolve(); await release.promise; });
  const state: ViewState = { browsing: { expanded: ['docs'], scrollTop: 12, anchorPath: 'docs', anchorOffset: 0 }, search: null };
  let writing: Promise<void> | undefined;
  try {
    await entered.promise; writing = writeView(context, scope, state);
    expect([...values.keys()].some(key => key.startsWith('ogt:data:v1:["view",'))).toBe(true);
  } finally { release.resolve(); await Promise.all([holder, writing]); }
  expect(await readView(context, scope)).toEqual(state);
});

it('concurrent changes to different preferences preserve both choices', async () => {
  await Promise.all([writeSettings({ shortcutsEnabled: false }), writeSettings({ width: 340 }), writeSettings({ language: 'zh-CN' })]);
  expect(await readSettings()).toMatchObject({ shortcutsEnabled: false, width: 340, language: 'zh-CN' });
});

import { expect, it, vi } from 'vitest';
import { clearToken, configureToken, readAuthScope } from '../src/credentials';
import { purgePrivateData, readSettings, readTree, readView, writeSettings, writeTree, writeView } from '../src/storage';
import type { ViewState } from '../src/types';
import { context, entry } from './fixtures';
import { deferred, GM, setHttpHandler, values } from './gm';
async function authorize() { setHttpHandler(async () => ({ body: { id: 1, login: 'api-user' } })); return await configureToken('unit-test-token'); }
const privateContext = { ...context, visibility: 'private' as const };
it('privateCacheRequiresCurrentScope', async () => {
  const scope = await authorize(); await writeTree(privateContext, scope, [entry('private.ts')]);
  expect((await readTree(privateContext, scope))?.[0]?.path).toBe('private.ts');
  await clearToken();
  expect(await readTree(privateContext, scope)).toBeNull();
  expect(await readTree(privateContext, await readAuthScope())).toBeNull();
  await purgePrivateData(); expect([...values.keys()].filter(k => k.startsWith('ogt:data:'))).toEqual([]);
});
it('visibilityChangeStopsPublicReuse', async () => {
  const scope = await authorize(); await writeTree(context, scope, [entry('previously-public.ts')]);
  expect(await readTree(privateContext, scope)).toBeNull();
});
it('lateWriteCannotReviveClearedScope', async () => {
  const scope = await authorize(); const entered = deferred<void>(), release = deferred<void>();
  const original = GM.setValue;
  vi.spyOn(GM, 'setValue').mockImplementation(async (key, value) => { if (key.startsWith('ogt:data:')) { entered.resolve(); await release.promise; } await original(key, value); });
  const writing = writeTree(privateContext, scope, [entry('private.ts')]);
  await entered.promise; await clearToken(); await purgePrivateData(); release.resolve();
  await expect(writing).rejects.toMatchObject({ name: 'AbortError' });
  expect(await readTree(privateContext, scope)).toBeNull(); expect([...values.keys()].filter(k => k.startsWith('ogt:data:'))).toEqual([]);
});
it('reading state stays isolated by branch and includes both snapshots', async () => {
  const scope = await readAuthScope();
  const state: ViewState = { browsing: { expanded: ['docs'], scrollTop: 24, anchorPath: 'docs/a.md', anchorOffset: 0 }, search: { query: 'auth', view: { expanded: ['src/auth'], scrollTop: 48, anchorPath: 'src/auth/a.ts', anchorOffset: 0 }, collapsed: ['src/auth/hidden'] } };
  await writeView(context, scope, state);
  expect(await readView({ ...context, refName: 'dev' }, scope)).toBeNull();
  expect(await readView(context, scope)).toEqual(state);
});
it('an old cleanup cannot delete records written under a replacement credential', async () => {
  await authorize();
  const entered = deferred<void>(), release = deferred<void>();
  const original = GM.listValues;
  vi.spyOn(GM, 'listValues').mockImplementationOnce(async () => { entered.resolve(); await release.promise; return original(); });
  const oldCleanup = purgePrivateData();
  await entered.promise;
  const next = await configureToken('replacement-token');
  const state: ViewState = { browsing: { expanded: ['src'], scrollTop: 24, anchorPath: 'src', anchorOffset: 0 }, search: null };
  await writeView(privateContext, next, state);
  release.resolve(); await oldCleanup;
  expect(await readView(privateContext, next)).toEqual(state);
});

it('concurrent changes to different preferences preserve both choices', async () => {
  await Promise.all([writeSettings({ shortcutsEnabled: false }), writeSettings({ width: 340 }), writeSettings({ language: 'zh-CN' })]);
  expect(await readSettings()).toMatchObject({ shortcutsEnabled: false, width: 340, language: 'zh-CN' });
});

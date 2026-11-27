import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { application, startApplication } from '../src/main';
import { clearToken, configureToken, readAuthScope } from '../src/credentials';
import { mountSidebar } from '../src/sidebar';
import { defaultSettings, readSettings, readView, writeSettings, writeView } from '../src/storage';
import * as storage from '../src/storage';
import { TreeIndex } from '../src/tree-index';
import type { SidebarHandle } from '../src/types';
import { codePage, context, entry, sha } from './fixtures';
import { setLanguage } from '../src/i18n';
import { deferred, GM, GM_setValue, menus, requests, setHttpHandler, values } from './gm';
beforeAll(async () => {
  (await application)?.stop();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});
let app: Awaited<ReturnType<typeof startApplication>> | undefined;
let sidebar: SidebarHandle | undefined;
afterEach(async () => { app?.stop(); app = undefined; sidebar?.destroy(); sidebar = undefined; setLanguage('auto'); await new Promise(done => setTimeout(done, 0)); });
const root = () => document.querySelector('#opsgittrees')!.shadowRoot!;
const query = () => root().querySelector<HTMLInputElement>('input[type="search"]')!;
const viewport = () => root().querySelector<HTMLElement>('.viewport')!;
const status = () => root().querySelector('.status')!.textContent || '';
const paths = () => [...root().querySelectorAll<HTMLElement>('[data-path]')].map(el => el.dataset.path);
async function search(value: string) { query().value = value; query().dispatchEvent(new Event('input', { bubbles: true })); await new Promise(done => setTimeout(done, 100)); }
function data() { const index = new TreeIndex(); index.add([entry('docs', 'tree'), entry('docs/help.md'), entry('src/auth', 'tree'), ...Array.from({ length: 40 }, (_, i) => entry('src/auth/file' + String(i).padStart(2, '0') + '.ts'))]); return index.view('complete'); }
function api() { setHttpHandler(async ({ url }) => { const u = new URL(url); if (u.pathname.endsWith('/repo')) return { body: { id: 1, visibility: 'public' } }; if (u.pathname.includes('/git/commits/')) return { body: { sha: u.pathname.split('/').pop(), tree: { sha: sha(2) } } }; return { body: { sha: sha(2), truncated: false, tree: [...data().entries.values()].map(value => ({ ...value, sha: value.sha || sha(3) })) } }; }); }

it('initial loading releases the tree when paths arrive, even while background loading continues', () => {
  sidebar = mountSidebar(defaultSettings); sidebar.setContext({ kind: 'code', context });
  const loading = root().querySelector<HTMLElement>('.tree-loading');
  expect(loading?.hidden).toBe(false); expect(viewport().getAttribute('aria-busy')).toBe('true');
  sidebar.setIndex({ ...data(), state: 'loading', pending: 1 });
  expect(loading?.hidden).toBe(true); expect(viewport().getAttribute('aria-busy')).toBe('false');
  expect(root().querySelector<HTMLElement>('.canvas')!.hidden).toBe(false); expect(paths()).toContain('docs');
});
it('a failed load stops the whole-tree loading indicator and a new load can restart it', () => {
  sidebar = mountSidebar(defaultSettings); sidebar.setContext({ kind: 'code', context });
  const loading = root().querySelector<HTMLElement>('.tree-loading');
  sidebar.setIndex({ entries: new Map(), children: new Map(), state: 'failed', pending: 0, reason: 'Connection failed' });
  expect(loading?.hidden).toBe(true); expect(viewport().getAttribute('aria-busy')).toBe('false');
  expect(root().querySelector('.status')?.getAttribute('title')).toContain('Connection failed');
  expect(root().querySelector('.tree-message')?.textContent || '').toContain('Connection failed');
  sidebar.setIndex({ entries: new Map(), children: new Map(), state: 'loading', pending: 0 });
  expect(loading?.hidden).toBe(false);
  sidebar.setIndex(data()); expect(loading?.hidden).toBe(true); expect(viewport().getAttribute('aria-busy')).toBe('false');
  expect(root().querySelector<HTMLElement>('.tree-message')?.hidden).toBe(true);
});

it('searchRoundTripRestoresBothViews', async () => {
  sidebar = mountSidebar(defaultSettings); sidebar.setContext({ kind: 'code', context }); sidebar.setIndex(data());
  sidebar.restoreView({ browsing: { expanded: ['docs'], scrollTop: 24, anchorPath: 'docs/help.md', anchorOffset: 0 }, search: null });
  await search('auth'); root().querySelector<HTMLButtonElement>('[data-path="src/auth"]')!.click();
  viewport().scrollTop = 48; viewport().dispatchEvent(new Event('scroll')); await new Promise(done => setTimeout(done, 0));
  const file = root().querySelector<HTMLAnchorElement>('[data-path="src/auth/file00.ts"]')!;
  expect(file.href).toBe('https://github.com/example/repo/blob/main/src/auth/file00.ts');
  file.addEventListener('click', event => event.preventDefault()); file.click();
  const before = sidebar.getView(), scope = await readAuthScope(); await writeView(context, scope, before); sidebar.destroy();
  sidebar = mountSidebar(defaultSettings); sidebar.setContext({ kind: 'code', context }); sidebar.restoreView((await readView(context, scope))!); sidebar.setIndex(data());
  expect(query().value).toBe('auth'); expect(sidebar.getView()).toEqual(before); expect(viewport().scrollTop).toBe(48);
  expect(root().querySelector<HTMLElement>('.search-bar')!.hidden).toBe(false);
  root().querySelector<HTMLButtonElement>('[aria-label="Clear search"]')!.click();
  expect(sidebar.getView().browsing.expanded).toEqual(['docs']); expect(viewport().scrollTop).toBe(24); expect(paths()).toContain('docs/help.md'); expect(paths()).not.toContain('src/auth');
});
it('fileNavigationKeepsQueryAndScroll and reuses the same preload', async () => {
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  await search('auth'); root().querySelector<HTMLButtonElement>('[data-path="src/auth"]')!.click(); viewport().scrollTop = 48; viewport().dispatchEvent(new Event('scroll')); await new Promise(done => setTimeout(done, 0));
  codePage('src/auth/file00.ts'); document.dispatchEvent(new Event('turbo:load'));
  await vi.waitFor(() => expect(root().querySelector('.current')?.getAttribute('data-path')).toBe('src/auth/file00.ts'));
  expect(query().value).toBe('auth'); expect(viewport().scrollTop).toBe(48); expect(requests.filter(r => r.url.includes('/git/trees/'))).toHaveLength(1);
});
it.each([
  { view: 'root', url: '/example/repo', endpoint: '/example/repo', route: 'codeViewRepoRoute', path: '/', ref: 'main', file: 'https://github.com/example/repo/blob/main/docs/help.md' },
  { view: 'tree', url: '/example/repo/tree/feature/a/src/auth', endpoint: '/example/repo/tree/feature/a/src/auth', route: 'codeViewTreeRoute', path: 'src/auth', ref: 'feature/a', file: 'https://github.com/example/repo/blob/feature%2Fa/docs/help.md' },
  { view: 'blob', url: '/example/repo/blob/feature/a/src/auth/file00.ts', endpoint: '/example/repo/_layout/feature/a/src/auth/file00.ts', route: 'codeViewBlobLayoutRoute', path: 'src/auth/file00.ts', ref: 'feature/a', file: 'https://github.com/example/repo/blob/feature%2Fa/docs/help.md' },
])('logged-in $view page loads the tree and checks repository access without embedded JSON', async ({ url, endpoint, route, path, ref, file }) => {
  history.replaceState(null, '', url); api();
  const payloads: Record<string, object> = {
    '/example/repo/_layout': { codeViewLayoutRoute: { repo: { name: 'repo', ownerLogin: 'example', isEmpty: false } } },
    [endpoint]: { [route]: { path, refInfo: { name: ref, refType: 'branch', currentOid: sha(1) } } },
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const payload = payloads[target.pathname];
    const response = new Response(JSON.stringify({ payload }), { status: payload ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
    Object.defineProperty(response, 'url', { value: target.href }); return response;
  });
  app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  root().querySelector<HTMLButtonElement>('[data-path="docs"]')!.click();
  expect(root().querySelector<HTMLAnchorElement>('[data-path="docs/help.md"]')!.href).toBe(file);
  root().querySelector<HTMLButtonElement>('[aria-label="Open navigation settings"]')!.click();
  root().querySelector<HTMLButtonElement>('[aria-label="Open Token configuration dialog"]')!.click();
  const dialog = document.querySelector('#opsgittrees-credentials')!.shadowRoot!;
  [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Check current repository')!.click();
  await vi.waitFor(() => expect(dialog.querySelector('.result')?.getAttribute('data-kind')).toBe('success'));
});
it('stale SPA embedded data resolves the actual page and keeps the current reading state', async () => {
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  await search('auth'); root().querySelector<HTMLButtonElement>('[data-path="src/auth"]')!.click();
  viewport().scrollTop = 48; viewport().dispatchEvent(new Event('scroll')); await new Promise(done => setTimeout(done, 0));
  const doc = document.implementation.createHTMLDocument();
  const source = document.querySelector('react-app')!.cloneNode(true) as Element;
  const script = source.querySelector('script')!;
  script.textContent = JSON.stringify({ payload: { codeViewLayoutRoute: { repo: { name: 'repo', ownerLogin: 'example', isEmpty: false } }, codeViewBlobLayoutRoute: { path: 'src/auth/file00.ts', refInfo: { name: 'main', refType: 'branch', currentOid: sha(1) } } } });
  doc.body.append(source);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, url: 'https://github.com/example/repo/blob/main/src/auth/file00.ts', headers: new Headers({ 'Content-Type': 'text/html' }), text: async () => doc.documentElement.outerHTML } as Response);
  history.replaceState(null, '', '/example/repo/blob/main/src/auth/file00.ts'); document.dispatchEvent(new Event('turbo:load'));
  await vi.waitFor(() => expect(root().querySelector('.current')?.getAttribute('data-path')).toBe('src/auth/file00.ts'));
  expect(query().value).toBe('auth'); expect(viewport().scrollTop).toBe(48); expect(requests.filter(r => r.url.includes('/git/trees/'))).toHaveLength(1);
});
it('branchSwitchRestoresOnlyItsOwnState', async () => {
  const scope = await readAuthScope();
  await writeView(context, scope, { browsing: { expanded: ['docs'], scrollTop: 0, anchorPath: 'docs', anchorOffset: 0 }, search: null });
  await writeView({ ...context, refName: 'dev' }, scope, { browsing: { expanded: ['src', 'src/auth'], scrollTop: 0, anchorPath: 'docs', anchorOffset: 0 }, search: null });
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete')); expect(paths()).toContain('docs/help.md'); expect(paths()).not.toContain('src/auth/file00.ts');
  codePage('', 'dev'); document.dispatchEvent(new Event('turbo:load'));
  await vi.waitFor(() => expect(paths()).toContain('src/auth/file00.ts')); expect(paths()).not.toContain('docs/help.md');
  codePage(); document.dispatchEvent(new Event('turbo:load')); await vi.waitFor(() => expect(paths()).toContain('docs/help.md')); expect(paths()).not.toContain('src/auth/file00.ts');
});
it('staleContextResolutionCannotReattachSidebar', async () => {
  codePage(); const reply = deferred<{ body: unknown }>(); setHttpHandler(() => reply.promise);
  const starting = startApplication(); await vi.waitFor(() => expect(requests).toHaveLength(1));
  history.replaceState(null, '', '/example/repo/issues'); document.dispatchEvent(new Event('turbo:load'));
  await vi.waitFor(() => expect(document.querySelector('#opsgittrees')).toBeNull());
  reply.resolve({ body: { id: 1, visibility: 'public' } }); app = await starting;
  expect(document.querySelector('#opsgittrees')).toBeNull(); expect(document.body.style.marginLeft).toBe('');
});
it('disabledShortcutsStayDisabledAfterReload but manager menu still reopens', async () => {
  await writeSettings({ ...defaultSettings, collapsed: true, shortcutsEnabled: false }); codePage(); api();
  app = await startApplication();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', altKey: true, shiftKey: true, bubbles: true })); expect(root().querySelector('.shell')?.classList.contains('collapsed')).toBe(true);
  app.stop(); app = await startApplication();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', altKey: true, shiftKey: true, bubbles: true })); expect(root().querySelector('.shell')?.classList.contains('collapsed')).toBe(true);
  menus.get('OpsGitTrees: Open file navigation')!(); expect(root().querySelector('.shell')?.classList.contains('collapsed')).toBe(false);
});
it('clearedGenerationRejectsLatePrivateResults', async () => {
  setHttpHandler(async () => ({ body: { id: 1, login: 'api-user' } })); await configureToken('private-test-token');
  codePage(); const tree = deferred<{ body: unknown }>();
  setHttpHandler(async options => { if (!options.headers?.Authorization) return { status: 404, body: {} }; if (options.url.includes('/git/trees/')) return tree.promise; if (options.url.includes('/git/commits/')) return { body: { sha: sha(1), tree: { sha: sha(2) } } }; return { body: { id: 1, visibility: 'private' } }; });
  app = await startApplication(); await vi.waitFor(() => expect(requests.some(r => r.url.includes('/git/trees/'))).toBe(true));
  await clearToken(); await vi.waitFor(() => expect(root().querySelector('.identity')?.textContent).toContain('No Token'));
  tree.resolve({ body: { sha: sha(2), truncated: false, tree: [entry('sensitive.ts')] } }); await new Promise(done => setTimeout(done, 0));
  expect(paths()).not.toContain('sensitive.ts'); expect([...values.entries()].some(([key, value]) => (key.startsWith('ogt:data:') || key.startsWith('ogt:cache:')) && JSON.stringify(value).includes('sensitive.ts'))).toBe(false);
});
it('same-version persistent cache avoids commit and tree requests but still verifies metadata', async () => {
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  app.stop(); requests.length = 0; app = await startApplication();
  await vi.waitFor(() => expect(status()).toContain('Complete'));
  expect(requests.map(r => new URL(r.url).pathname)).toEqual(['/repos/example/repo']);
  await search('help.md'); expect(paths()).toContain('docs/help.md');
});
it('privateCacheStillChecksContents on a warm hit and refuses cached paths after denial', async () => {
  let denied = false;
  setHttpHandler(async ({ url }) => {
    const path = new URL(url).pathname;
    if (path === '/user') return { body: { id: 1, login: 'api-user' } };
    if (path === '/repos/example/repo') return { body: { id: 1, visibility: 'private' } };
    if (path.includes('/git/commits/')) return denied ? { status: 403, body: {} } : { body: { sha: sha(1), tree: { sha: sha(2) } } };
    return { body: { sha: sha(2), truncated: false, tree: [entry('sensitive.ts')] } };
  });
  await configureToken('private-test-token'); codePage(); app = await startApplication();
  await vi.waitFor(() => expect(paths()).toContain('sensitive.ts'));
  await vi.waitFor(() => expect(status()).toContain('Complete'));

  app.stop(); requests.length = 0; app = await startApplication();
  await vi.waitFor(() => expect(status()).toContain('Complete'));
  expect(paths()).toContain('sensitive.ts');
  expect(requests.map(r => new URL(r.url).pathname)).toEqual(['/repos/example/repo', '/repos/example/repo/git/commits/' + sha(1)]);
  app.stop(); denied = true; requests.length = 0; app = await startApplication();
  await search('sensitive.ts'); expect(paths()).not.toContain('sensitive.ts');
  expect(requests.map(r => new URL(r.url).pathname)).toEqual(['/repos/example/repo', '/repos/example/repo/git/commits/' + sha(1)]);
});
it('ignores malformed saved view and continues loading the repository tree', async () => {
  const key = 'ogt:data:v1:' + JSON.stringify(['view', context.repoId, context.refKind, context.refName, 'public']);
  values.set(key, JSON.stringify({ schema: 1, scope: 'public', private: false, usedAt: 1, view: { browsing: {} } }));
  codePage(); api(); app = await startApplication();
  await vi.waitFor(() => expect(status()).toContain('Complete'));
  expect(paths()).toContain('docs');
});

it('does not store a private commit mapping that navigation never reads', async () => {
  setHttpHandler(async ({ url }) => {
    const path = new URL(url).pathname;
    if (path === '/user') return { body: { id: 1, login: 'api-user' } };
    if (path === '/repos/example/repo') return { body: { id: 1, visibility: 'private' } };
    if (path.includes('/git/commits/')) return { body: { sha: sha(1), tree: { sha: sha(2) } } };
    return { body: { sha: sha(2), truncated: false, tree: [entry('private.ts')] } };
  });
  await configureToken('private-test-token'); codePage(); app = await startApplication();
  await vi.waitFor(() => expect(status()).toContain('Complete'));
  const scope = await readAuthScope();
  const key = 'ogt:cache:v2:' + JSON.stringify(['commit', context.repoId, context.commitSha, scope.id]);
  expect(values.has(key)).toBe(false);
});
it('a repository becoming private cannot reuse its old public directory block', async () => {
  let privateNow = false;
  setHttpHandler(async ({ url }) => {
    const path = new URL(url).pathname;
    if (path === '/user') return { body: { id: 1, login: 'api-user' } };
    if (path === '/repos/example/repo') return { body: { id: 1, visibility: privateNow ? 'private' : 'public' } };
    if (path.includes('/git/commits/')) return { body: { sha: sha(1), tree: { sha: sha(2) } } };
    return privateNow ? { status: 403, body: {} } : { body: { sha: sha(2), truncated: false, tree: [entry('formerly-public.ts')] } };
  });
  codePage(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  expect(paths()).toContain('formerly-public.ts'); app.stop();
  await configureToken('private-test-token'); privateNow = true; requests.length = 0; app = await startApplication();
  await search('formerly-public'); expect(paths()).not.toContain('formerly-public.ts');
  expect(requests.filter(r => r.url.includes('/git/trees/'))).toHaveLength(1);
});
it('commitSwitchReusesOnlyMatchingSubtrees without keeping paths from the old root', async () => {
  setHttpHandler(async ({ url }) => {
    const u = new URL(url), object = u.pathname.split('/').pop();
    if (u.pathname === '/repos/example/repo') return { body: { id: 1, visibility: 'public' } };
    if (u.pathname.includes('/git/commits/')) return { body: { sha: object, tree: { sha: object === sha(1) ? sha(2) : sha(8) } } };
    if (object === sha(4)) return { body: { sha: object, truncated: false, tree: [entry('shared.ts')] } };
    return { body: { sha: object, truncated: u.searchParams.has('recursive'), tree: u.searchParams.has('recursive') ? [] : [entry('same', 'tree', 4), entry(object === sha(2) ? 'old.ts' : 'new.ts')] } };
  });
  codePage(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  expect(paths()).toContain('old.ts'); requests.length = 0;
  codePage('', 'dev', sha(9)); await vi.waitFor(() => expect(paths()).toContain('new.ts'));
  await vi.waitFor(() => expect(status()).toContain('Complete'));
  expect(requests.filter(r => new URL(r.url).pathname.endsWith('/git/trees/' + sha(4)))).toHaveLength(0);
  await search('shared.ts'); expect(paths()).toContain('same/shared.ts');
  await search('old.ts'); expect(paths()).not.toContain('old.ts');
});
it('a late commit-cache result cannot replace a newer branch', async () => {
  await storage.writeCommitTree(context, await readAuthScope());
  const entered = deferred<void>(), release = deferred<void>();
  const read = storage.readCommitTree;
  vi.spyOn(storage, 'readCommitTree').mockImplementation(async (current, scope) => {
    const result = await read(current, scope);
    if (current.commitSha === sha(1)) { entered.resolve(); await release.promise; }
    return result;
  });
  setHttpHandler(async ({ url }) => {
    const path = new URL(url).pathname;
    if (path === '/repos/example/repo') return { body: { id: 1, visibility: 'public' } };
    if (path.includes('/git/commits/')) return { body: { sha: sha(9), tree: { sha: sha(8) } } };
    return { body: { sha: sha(8), truncated: false, tree: [entry('new.ts')] } };
  });
  codePage(); const starting = startApplication();
  try {
    await entered.promise; codePage('', 'dev', sha(9));
    await vi.waitFor(() => expect(paths()).toContain('new.ts'));
  } finally { release.resolve(); app = await starting; }
  await search('new.ts'); expect(paths()).toContain('new.ts');
  expect(requests.filter(r => new URL(r.url).pathname.endsWith('/git/trees/' + sha(2)))).toHaveLength(0);
});
it('commit and block cache I/O failure still permits usable network-loaded paths', async () => {
  const get = GM.getValue, set = GM.setValue;
  vi.spyOn(GM, 'getValue').mockImplementation(async <T>(key: string, fallback?: T): Promise<T> => {
    if (key.startsWith('ogt:cache:v2:')) throw new Error('cache read unavailable');
    return get(key, fallback);
  });
  vi.spyOn(GM, 'setValue').mockImplementation(async (key, value) => {
    if (key.startsWith('ogt:cache:v2:')) throw new Error('cache write unavailable');
    return set(key, value);
  });
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  await search('help.md'); expect(paths()).toContain('docs/help.md');
  expect(requests.filter(r => r.url.includes('/git/commits/'))).toHaveLength(1);
  expect(requests.filter(r => r.url.includes('/git/trees/'))).toHaveLength(1);
  expect([...values.keys()].some(key => key.startsWith('ogt:cache:v2:'))).toBe(false);
});
it('oversizedSnapshotRemainsUsableInMemory', async () => {
  codePage(); const entries = Array.from({ length: 10000 }, (_, i) => entry('f' + i + '-' + 'x'.repeat(900)));
  expect(new TextEncoder().encode(JSON.stringify({ sha: sha(2), truncated: false, tree: entries })).byteLength).toBeGreaterThan(16 * 1024 * 1024);
  setHttpHandler(async ({ url }) => url.includes('/git/trees/') ? { body: { sha: sha(2), truncated: false, tree: entries } } : url.includes('/git/commits/') ? { body: { sha: sha(1), tree: { sha: sha(2) } } } : { body: { id: 1, visibility: 'public' } });
  app = await startApplication(); await vi.waitFor(() => expect(status()).toMatch(/persistent.cache budget/i)); expect(status()).toContain('Complete'); expect(status()).toMatch(/memory/i);
  expect([...values.keys()].some(key => key.startsWith('ogt:data:v1:["tree",') || key.startsWith('ogt:cache:v2:["tree",'))).toBe(false);
  await search('f9999-'); expect(paths()).toEqual(['f9999-' + 'x'.repeat(900)]);
});
it('initial deep-file positioning never overrides a saved collapsed preference', async () => {
  await writeSettings({ ...defaultSettings, collapsed: true }); codePage('src/auth/file00.ts'); api();
  app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  expect(root().querySelector('.shell')?.classList.contains('collapsed')).toBe(true);
  menus.get('OpsGitTrees: Open file navigation')!();
  expect(paths()).toContain('src/auth/file00.ts');
});
it('leaving a repository for account settings restores the original layout', async () => {
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  history.replaceState(null, '', '/settings/profile'); document.dispatchEvent(new Event('turbo:load'));
  await vi.waitFor(() => expect(document.querySelector('#opsgittrees')).toBeNull());
  expect(document.body.style.marginLeft).toBe('');
});
it('reattaches after GitHub replaces page nodes without losing the current search or index', async () => {
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  await search('auth'); root().querySelector<HTMLButtonElement>('[data-path="src/auth"]')!.click();
  document.getElementById('opsgittrees')!.remove();
  codePage('src/auth/file00.ts'); document.dispatchEvent(new Event('turbo:load'));
  await vi.waitFor(() => expect(document.querySelector('#opsgittrees')).not.toBeNull());
  await vi.waitFor(() => expect(root().querySelector('.current')?.getAttribute('data-path')).toBe('src/auth/file00.ts'));
  expect(query().value).toBe('auth'); expect(requests.filter(r => r.url.includes('/git/trees/'))).toHaveLength(1);
});

it('a Token configured in another tab is used for public API requests without an extra preference', async () => {
  values.set('ogt:settings:v1', { ...defaultSettings, useTokenForPublic: false }); codePage();
  setHttpHandler(async options => {
    if (options.headers?.Authorization !== 'Bearer public-test-token') return { status: 403, headers: 'x-ratelimit-remaining: 0\nx-ratelimit-reset: ' + Math.ceil(Date.now() / 1000 + 3600), body: {} };
    if (options.url.endsWith('/user')) return { body: { id: 1, login: 'api-user' } };
    if (options.url.endsWith('/repo')) return { body: { id: 1, visibility: 'public' } };
    if (options.url.includes('/git/commits/')) return { body: { sha: sha(1), tree: { sha: sha(2) } } };
    return { body: { sha: sha(2), truncated: false, tree: [entry('available.ts')] } };
  });
  app = await startApplication(); expect(status()).toContain('paused');
  const message = root().querySelector<HTMLElement>('.tree-message');
  expect(message?.hidden).toBe(false); expect(message?.textContent || '').toMatch(/rate limit/i);
  expect(root().querySelector<HTMLElement>('.tree-auth-hint')?.hidden).toBe(false);
  expect(root().querySelector<HTMLButtonElement>('.resume')?.disabled).toBe(true);
  await configureToken('public-test-token');
  await vi.waitFor(() => expect(paths()).toContain('available.ts'));
  expect(root().querySelector('.identity')?.textContent).toContain('@api-user');
  app.stop(); app = await startApplication();
  await vi.waitFor(() => expect(paths()).toContain('available.ts'));
  await clearToken();
  await vi.waitFor(() => expect(status()).toContain('paused'));
  expect(paths()).not.toContain('available.ts');
});
it('a quota notice preserves loaded paths and hides anonymous advice once a Token is present', () => {
  sidebar = mountSidebar(defaultSettings); sidebar.setContext({ kind: 'code', context });
  sidebar.setIndex({ ...data(), state: 'paused', reason: 'Request quota is low', canResume: true, resumeAt: Date.now() + 60000 });
  const message = root().querySelector<HTMLElement>('.tree-message');
  expect(message?.textContent || '').toContain('Request quota is low'); expect(message?.hidden).toBe(false);
  expect(root().querySelector<HTMLElement>('.tree-retry-time')?.hidden).toBe(false);
  expect(viewport().getAttribute('aria-busy')).toBe('false');
  root().querySelector<HTMLButtonElement>('[data-path="docs"]')!.click(); expect(paths()).toContain('docs/help.md');
  sidebar.setAuth({ id: 'token-user', login: 'api-user', authenticated: true });
  expect(root().querySelector<HTMLElement>('.tree-auth-hint')?.hidden).toBe(true);
  root().querySelector<HTMLButtonElement>('[aria-label="Open navigation settings"]')!.click();
  expect(root().querySelector<HTMLElement>('.tree-area')?.hidden).toBe(true);
});
it('a rate-limit retry stays disabled until the advertised recovery time', () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(1800000000000);
    sidebar = mountSidebar(defaultSettings); sidebar.setContext({ kind: 'code', context });
    sidebar.setIndex({ entries: new Map(), children: new Map(), state: 'paused', pending: 0, reason: 'API rate limit reached', canResume: true, resumeAt: Date.now() + 60000 });
    const resume = root().querySelector<HTMLButtonElement>('.resume');
    expect(root().querySelector<HTMLElement>('.tree-message')?.hidden).toBe(false);
    expect(resume?.disabled).toBe(true); vi.advanceTimersByTime(59999); expect(resume?.disabled).toBe(true);
    vi.advanceTimersByTime(1); expect(resume?.disabled).toBe(false);
  } finally { vi.useRealTimers(); }
});

it('a local shortcut and page exit cannot overwrite another tab’s unrelated preferences', async () => {
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  GM_setValue('ogt:settings:v1', { ...defaultSettings, shortcutsEnabled: false, width: 340 });
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', altKey: true, shiftKey: true }));
  window.dispatchEvent(new Event('pagehide'));
  await vi.waitFor(async () => expect(await readSettings()).toMatchObject({ collapsed: true, shortcutsEnabled: false, width: 340 }));
  app.stop(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  expect(root().querySelector('.shell')!.classList.contains('collapsed')).toBe(true);
});

it('leaving an untouched tab does not roll back a newly saved global preference', async () => {
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  GM_setValue('ogt:settings:v1', { ...defaultSettings, shortcutsEnabled: false });
  window.dispatchEvent(new Event('pagehide'));
  expect((await readSettings()).shortcutsEnabled).toBe(false);
});

it('browser Chinese, saved English and remote language changes preserve the current file search', async () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN', 'en-US']);
  codePage(); api(); app = await startApplication();
  await vi.waitFor(() => expect(status()).toContain('完整'));
  expect(query().placeholder).toBe('查找文件或路径…');
  await search('auth');
  const before = [...paths()], requestCount = requests.length;
  const language = root().querySelector<HTMLSelectElement>('select')!;
  language.value = 'en'; language.dispatchEvent(new Event('change'));
  await vi.waitFor(async () => expect((await readSettings()).language).toBe('en'));
  expect(query().placeholder).toBe('Find a file or path…');
  expect(query().value).toBe('auth'); expect(paths()).toEqual(before);
  await writeSettings({ language: 'zh-CN' });
  await vi.waitFor(() => expect(query().placeholder).toBe('查找文件或路径…'));
  await vi.waitFor(() => expect(menus.has('OpsGitTrees：管理 Token…')).toBe(true));
  expect(menus.has('OpsGitTrees: Manage Token…')).toBe(false);
  expect(query().value).toBe('auth'); expect(paths()).toEqual(before); expect(requests).toHaveLength(requestCount);
  app.stop(); app = await startApplication();
  await vi.waitFor(() => expect(status()).toContain('完整'));
  expect(query().value).toBe('auth'); expect(root().querySelector<HTMLSelectElement>('select')!.value).toBe('zh-CN');
});

it('an existing API failure is translated without another request when switching language', async () => {
  codePage(); setHttpHandler(async () => ({ status: 404, body: {} })); app = await startApplication();
  const language = root().querySelector<HTMLSelectElement>('select')!, requestCount = requests.length;
  language.value = 'zh-CN'; language.dispatchEvent(new Event('change'));
  expect(status()).toContain('仓库或对象不存在'); expect(status()).toContain('失败');
  language.value = 'en'; language.dispatchEvent(new Event('change'));
  expect(status()).toContain('Repository or object not found'); expect(requests).toHaveLength(requestCount);
});

it.each([[200, 'success'], [404, 'error']] as const)('repository check HTTP %i reports inside the Token dialog', async (httpStatus, kind) => {
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  if (httpStatus === 404) setHttpHandler(async () => ({ status: 404, body: {} }));
  root().querySelector<HTMLButtonElement>('[aria-label="Open navigation settings"]')!.click();
  root().querySelector<HTMLButtonElement>('[aria-label="Open Token configuration dialog"]')!.click();
  const dialog = document.querySelector('#opsgittrees-credentials')!.shadowRoot!;
  [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Check current repository')!.click();
  await vi.waitFor(() => expect(dialog.querySelector('.result')?.getAttribute('data-kind')).toBe(kind));
  expect(dialog.querySelector('.result')!.textContent).toContain(httpStatus === 200 ? 'Repository read access verified' : 'Repository or object not found');
  expect(dialog.querySelector<HTMLElement>('.result')!.hidden).toBe(false);
  expect(root().querySelector('.connection-status')!.textContent).toBe('');
});

it('closing the Token dialog cancels a repository check and its late response cannot update a reopened dialog', async () => {
  codePage(); api(); app = await startApplication(); await vi.waitFor(() => expect(status()).toContain('Complete'));
  const reply = deferred<{ body: unknown }>(); setHttpHandler(() => reply.promise);
  root().querySelector<HTMLButtonElement>('[aria-label="Open navigation settings"]')!.click();
  root().querySelector<HTMLButtonElement>('[aria-label="Open Token configuration dialog"]')!.click();
  const dialog = document.querySelector('#opsgittrees-credentials')!.shadowRoot!;
  const before = requests.length;
  [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Check current repository')!.click();
  await vi.waitFor(() => expect(requests.length).toBe(before + 1));
  dialog.querySelector<HTMLButtonElement>('.close')!.click();
  root().querySelector<HTMLButtonElement>('[aria-label="Open Token configuration dialog"]')!.click();
  reply.resolve({ body: { id: 1, visibility: 'public' } });
  await new Promise(done => setTimeout(done, 0));
  const reopened = document.querySelector('#opsgittrees-credentials')!.shadowRoot!;
  expect(reopened.querySelector<HTMLElement>('.result')!.hidden).toBe(true);
  expect(requests).toHaveLength(before + 1);
});

it('the header settings round trip keeps the filtered tree and its reading position', async () => {
  sidebar = mountSidebar(defaultSettings); sidebar.setContext({ kind: 'code', context }); sidebar.setIndex(data());
  await search('auth');
  root().querySelector('[data-path="src/auth"] svg')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  viewport().scrollTop = 48; viewport().dispatchEvent(new Event('scroll')); await new Promise(done => setTimeout(done, 0));
  const before = sidebar.getView();
  root().querySelector<HTMLButtonElement>('[aria-label="Open navigation settings"]')!.click();
  expect(viewport().hidden).toBe(true);
  root().querySelector<HTMLButtonElement>('button[aria-label="Close navigation settings"]')!.click();
  expect(viewport().hidden).toBe(false); expect(query().value).toBe('auth');
  expect(root().querySelector<HTMLElement>('.search-bar')!.hidden).toBe(false);
  expect(sidebar.getView()).toEqual(before); expect(viewport().scrollTop).toBe(48);
});

it('on-demand search keeps active filters visible and Escape restores browsing before closing', async () => {
  sidebar = mountSidebar(defaultSettings); sidebar.setContext({ kind: 'code', context }); sidebar.setIndex(data());
  sidebar.restoreView({ browsing: { expanded: ['docs'], scrollTop: 24, anchorPath: 'docs/help.md', anchorOffset: 0 }, search: null });
  const bar = root().querySelector<HTMLElement>('.search-bar')!;
  expect(bar.hidden).toBe(true);
  sidebar.focusSearch(); expect(bar.hidden).toBe(false); expect(root().activeElement).toBe(query());
  await search('auth');
  const toggle = root().querySelector<HTMLButtonElement>('button[aria-label="Find a file or path"]')!;
  toggle.click(); expect(bar.hidden).toBe(false); expect(query().value).toBe('auth');
  query().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(query().value).toBe(''); expect(sidebar.getView().search).toBeNull();
  expect(paths()).toContain('docs/help.md'); expect(viewport().scrollTop).toBe(24); expect(bar.hidden).toBe(false);
  query().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(bar.hidden).toBe(true); expect(root().activeElement).toBe(toggle);
  toggle.click(); expect(bar.hidden).toBe(false); expect(root().activeElement).toBe(query());
  toggle.click(); expect(bar.hidden).toBe(true);
});

it('repository navigation follows code and empty contexts and clears stale unresolved links', () => {
  sidebar = mountSidebar(defaultSettings); sidebar.setContext({ kind: 'code', context });
  const links = () => [...root().querySelectorAll<HTMLAnchorElement>('.repository-bar a[href]')].map(link => ({ text: link.textContent, href: link.getAttribute('href') }));
  expect(links()).toEqual([{ text: 'example', href: '/example' }, { text: 'repo', href: '/example/repo' }]);
  sidebar.setContext({ kind: 'code', context: { ...context, owner: 'another-org', repo: 'another-repo', refName: 'feature/navigation' } });
  setLanguage('zh-CN');
  expect(links()).toEqual([{ text: 'another-org', href: '/another-org' }, { text: 'another-repo', href: '/another-org/another-repo' }]);
  sidebar.setContext({ kind: 'empty', owner: 'another-org', repo: 'empty-repo' });
  expect(links()).toEqual([{ text: 'another-org', href: '/another-org' }, { text: 'empty-repo', href: '/another-org/empty-repo' }]);
  sidebar.setContext({ kind: 'unresolved', message: 'Resolving repository' });
  expect(links()).toEqual([]);
});

it('an older settings acknowledgement cannot re-collapse a sidebar that was just reopened', async () => {
  const firstStarted = deferred<void>(), secondStarted = deferred<void>(), releaseFirst = deferred<void>(), releaseSecond = deferred<void>();
  const original = GM.setValue; let writes = 0;
  vi.spyOn(GM, 'setValue').mockImplementation(async (key, value) => {
    if (key === 'ogt:settings:v1') {
      if (++writes === 1) { firstStarted.resolve(); await releaseFirst.promise; }
      else if (writes === 2) { secondStarted.resolve(); await releaseSecond.promise; }
    }
    await original(key, value);
  });
  codePage(); api(); app = await startApplication();
  root().querySelector<HTMLButtonElement>('[aria-label="Collapse file navigation"]')!.click();
  window.dispatchEvent(new Event('pagehide')); await firstStarted.promise;
  try {
    root().querySelector<HTMLButtonElement>('[aria-label="Open file navigation"]')!.click();
    window.dispatchEvent(new Event('pagehide')); releaseFirst.resolve(); await secondStarted.promise;
    expect(root().querySelector('.shell')!.classList.contains('collapsed')).toBe(false);
  } finally {
    releaseFirst.resolve(); releaseSecond.resolve();
    await vi.waitFor(async () => expect((await readSettings()).collapsed).toBe(false));
  }
});

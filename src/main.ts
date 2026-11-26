import { GM } from '$';
import { getGitHubClient, isAbortError as isAbort, isAuthScopeCurrent, observeAuthScope, readAuthScope } from './credentials';
import { createCredentialManager } from './credential-window';
import { ApiError, createGitHubClient } from './github';
import { observePage, readPage } from './page';
import { startPreload } from './preload';
import { mountSidebar } from './sidebar';
import { observeSettings, purgePrivateData, readSettings, readTree, readView, StorageLimitError, writeSettings, writeTree, writeView } from './storage';
import { TreeIndex } from './tree-index';
import type { AuthScope, GitHubClient, IndexView, PageState, RepoContext, Settings, SidebarHandle } from './types';
import { msg, observeLanguage, renderText, setLanguage, t, type MessageKey, type Text } from './i18n';

interface Active {
  context: RepoContext;
  scope: AuthScope;
  client: GitHubClient;
  controller: AbortController;
  preload?: ReturnType<typeof startPreload>;
  index?: IndexView;
}
const safeMessage = (error: unknown): Text => error instanceof ApiError || error instanceof StorageLimitError ? error.detail : msg('The operation failed. Check the network and userscript manager storage permissions.');

export async function startApplication(): Promise<{ stop(): void }> {
  let settings = await readSettings();
  setLanguage(settings.language);
  let auth = await readAuthScope();
  let sidebar: SidebarHandle | null = null, active: Active | null = null;
  let generation = 0, lastUrl = '', verifiedUrl = '', stopped = false;
  let resolving = new AbortController();
  let saveTimer: ReturnType<typeof setTimeout> | undefined, settingsTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingSettings: Partial<Settings> = {};
  let writingSettings = false;
  let authenticatedClient: { id: string; client: GitHubClient } | null = null;
  const anonymousClient = createGitHubClient(null);
  const memory = new Map<string, IndexView>();
  const memoryKey = (context: RepoContext, scope: AuthScope) => context.repoId + ':' + context.rootTreeSha + ':' + (context.visibility === 'public' ? 'public' : scope.id);
  function notice(message: Text) { if (sidebar) sidebar.setConnectionStatus(message); else void GM.notification({ title: 'OpsGitTrees', text: renderText(message), timeout: 8000 }); }
  const credentials = createCredentialManager(notice, checkConnection);
  function flushSettings(): void {
    clearTimeout(settingsTimer);
    if (writingSettings || !Object.keys(pendingSettings).length) return;
    const changes = { ...pendingSettings }; writingSettings = true;
    void writeSettings(changes).catch(() => { if (!stopped) notice(msg('Settings could not be saved.')); }).finally(() => {
      for (const key of Object.keys(changes) as (keyof Settings)[]) if (pendingSettings[key] === changes[key]) delete pendingSettings[key];
      writingSettings = false; flushSettings();
    });
  }
  function applySettings(next: Settings): void {
    settings = next; setLanguage(next.language); sidebar?.setSettings(next);
  }
  function flushView(): void {
    clearTimeout(saveTimer);
    if (!active || !sidebar) return;
    const current = active, view = sidebar.getView();
    void writeView(current.context, current.scope, view).catch(error => { if (!isAbort(error) && active === current) sidebar?.setConnectionStatus(msg('Reading position could not be saved. Check manager storage.')); });
  }
  function detach(save = true): void { if (save) flushView(); else clearTimeout(saveTimer); active?.controller.abort(); active = null; sidebar?.destroy(); sidebar = null; }
  function ensureSidebar(): SidebarHandle {
    if (sidebar) { sidebar.reconnect(); return sidebar; }
    const handle = mountSidebar(settings); sidebar = handle; handle.setAuth(auth);
    handle.onViewChange(() => { clearTimeout(saveTimer); saveTimer = setTimeout(flushView, 300); });
    handle.onSettingsChange(next => {
      const immediate = settings.shortcutsEnabled !== next.shortcutsEnabled || settings.language !== next.language;
      if (settings.collapsed !== next.collapsed) pendingSettings.collapsed = next.collapsed;
      if (settings.width !== next.width) pendingSettings.width = next.width;
      if (settings.shortcutsEnabled !== next.shortcutsEnabled) pendingSettings.shortcutsEnabled = next.shortcutsEnabled;
      if (settings.language !== next.language) pendingSettings.language = next.language;
      applySettings(next); clearTimeout(settingsTimer);
      if (immediate) flushSettings(); else settingsTimer = setTimeout(flushSettings, 300);
    });
    handle.onResumePreload(() => { if (active?.preload) active.preload.resume(); else void navigate(true); });
    handle.onVisiblePaths(paths => active?.preload?.prioritize(paths));
    handle.onManageToken(credentials.open);
    return handle;
  }
  async function authClient(scope: AuthScope): Promise<GitHubClient> {
    if (authenticatedClient?.id === scope.id) return authenticatedClient.client;
    const client = await getGitHubClient(scope); authenticatedClient = { id: scope.id, client }; return client;
  }
  function live(ticket: number): boolean { return !stopped && ticket === generation; }
  async function navigate(force = false): Promise<void> {
    const url = new URL(location.href);
    if (!force && url.href === lastUrl) { sidebar?.reconnect(); return; }
    lastUrl = url.href;
    const ticket = ++generation;
    resolving.abort(); resolving = new AbortController(); const signal = resolving.signal;
    verifiedUrl = '';
    let page = readPage(document, url);
    if (page.kind === 'outside') { detach(); return; }
    let handle = ensureSidebar();
    const retainedView = active ? handle.getView() : null;
    if (page.kind === 'unresolved') {
      flushView();
      handle.setContext(page);
      handle.setIndex({ entries: new Map(), children: new Map(), state: 'loading', pending: 0 });
    }
    try {
      if (page.kind === 'unresolved') {
        const response = await fetch(url.href, { signal, credentials: 'same-origin', headers: { Accept: 'text/html' } });
        if (!live(ticket)) return;
        if (!response.ok || new URL(response.url).origin !== url.origin) throw new ApiError('invalid', msg('Could not read the current GitHub page context.'));
        page = readPage(new DOMParser().parseFromString(await response.text(), 'text/html'), url);
        if (page.kind === 'unresolved' || page.kind === 'outside') throw new ApiError('invalid', msg('GitHub page context is not recognized. No branch or commit was guessed.'));
        if (!live(ticket)) return;
      }
      verifiedUrl = url.href;
      if (page.kind === 'code' && active && (active.preload || active.index) && active.context.owner === page.context.owner && active.context.repo === page.context.repo && active.context.refKind === page.context.refKind && active.context.refName === page.context.refName && active.context.commitSha === page.context.commitSha && !force) {
        active.context = { ...active.context, ...page.context };
        handle.setContext(page);
        if (retainedView) handle.restoreView(retainedView);
        if (active.index) handle.setIndex(active.index);
        handle.setCurrentPath(page.context.path);
        return;
      }
      if (retainedView) handle.restoreView(retainedView);
      detach();
      handle = ensureSidebar(); handle.setContext(page);
      const scope = await readAuthScope(); if (!live(ticket)) return;
      auth = scope; handle.setAuth(scope);
      const pageOwner = page.kind === 'code' ? page.context.owner : page.owner;
      const pageRepo = page.kind === 'code' ? page.context.repo : page.repo;
      const client = scope.authenticated ? await authClient(scope) : anonymousClient;
      const metadata = await client.getRepository(pageOwner, pageRepo, signal);
      if (!live(ticket)) return;
      if (metadata.visibility !== 'public' && !scope.authenticated) throw new ApiError('auth', msg('Configure a fine-grained read-only PAT in Settings → API authentication to read this repository.'));
      if (page.kind === 'empty') { handle.setContext(page); handle.setIndex({ entries: new Map(), children: new Map(), state: 'empty', pending: 0 }); return; }
      const context = await client.resolveTree(page.context, metadata, signal);
      if (!live(ticket)) return;
      if (metadata.visibility !== 'public' && (await readAuthScope()).id !== scope.id) return;
      const controller = new AbortController();
      const current: Active = { context, scope, client, controller }; active = current;
      const saved = await readView(context, scope);
      if (!live(ticket) || active !== current) return;
      if (saved) handle.restoreView(saved);
      const key = memoryKey(context, scope);
      let cached = memory.get(key);
      if (!cached) {
        const entries = await readTree(context, scope);
        if (!live(ticket) || active !== current) return;
        if (entries) { const index = new TreeIndex(); index.add(entries); cached = index.view('complete'); }
      }
      if (context.visibility !== 'public' && !isAuthScopeCurrent(scope)) { controller.abort(); return; }
      if (!live(ticket) || active !== current) return;
      if (cached) { current.index = cached; memory.delete(key); memory.set(key, cached); while (memory.size > 2) memory.delete(memory.keys().next().value!); handle.setIndex(cached); handle.setCurrentPath(context.path); return; }
      handle.setCurrentPath(context.path);
      current.preload = startPreload(context, scope, client, view => {
        if (controller.signal.aborted || active !== current || stopped) return;
        current.index = view;
        if (verifiedUrl === location.href) handle.setIndex(view);
        if (view.state === 'complete') {
          memory.delete(key); memory.set(key, view); while (memory.size > 2) memory.delete(memory.keys().next().value!);
          void writeTree(context, scope, [...view.entries.values()]).catch(error => { if (active === current && verifiedUrl === location.href && !controller.signal.aborted && !isAbort(error)) handle.setIndex({ ...view, reason: error instanceof StorageLimitError ? error.detail : msg('Persistent cache unavailable; index remains usable in memory.') }); });
        } else if (view.state === 'failed' && !view.canResume && context.visibility !== 'public') {
          controller.abort(); current.index = undefined; handle.setIndex({ entries: new Map(), children: new Map(), state: 'failed', pending: 0, reason: view.reason }); memory.delete(key);
        }
      }, controller.signal);
    } catch (error) {
      if (!live(ticket) || isAbort(error)) return;
      active?.controller.abort(); active = null;
      const canResume = error instanceof ApiError && (error.kind === 'network' || error.kind === 'rate');
      handle.setIndex({ entries: new Map(), children: new Map(), state: error instanceof ApiError && error.kind === 'rate' ? 'paused' : 'failed', pending: 0, reason: safeMessage(error), canResume, resumeAt: error instanceof ApiError ? error.resumeAt || undefined : undefined });
    }
  }
  async function checkConnection(cancelSignal: AbortSignal): Promise<Text> {
    const page = readPage(document, new URL(location.href));
    if (page.kind !== 'code' && page.kind !== 'empty') throw new ApiError('invalid', msg('Current GitHub context is unresolved. Reload the page and try again.'));
    const ticket = generation, signal = AbortSignal.any([cancelSignal, resolving.signal]);
    const scope = await readAuthScope(); const client = scope.authenticated ? await authClient(scope) : anonymousClient;
    if (scope.authenticated) await client.getIdentity(signal);
    const metadata = await client.getRepository(page.kind === 'code' ? page.context.owner : page.owner, page.kind === 'code' ? page.context.repo : page.repo, signal);
    if (page.kind === 'code') { const context = await client.resolveTree(page.context, metadata, signal); await client.getTree(context, context.rootTreeSha, false, signal); }
    if (!live(ticket) || signal.aborted || !isAuthScopeCurrent(scope)) throw new DOMException('Repository check cancelled', 'AbortError');
    return msg(page.kind === 'empty' ? 'Repository metadata access verified. Empty repository: Contents permission was not exercised.' : 'Repository read access verified.');
  }
  async function authorizationChanged(next: AuthScope): Promise<void> {
    if (next.id === auth.id && next.authenticated === auth.authenticated) return;
    auth = next; generation++; resolving.abort(); detach(false); authenticatedClient = null;
    for (const key of memory.keys()) if (!key.endsWith(':public')) memory.delete(key);
    await purgePrivateData();
    if (!stopped) await navigate(true);
  }
  const stopAuth = observeAuthScope(scope => { void authorizationChanged(scope).catch(() => notice(msg('Authorization changed; private data stopped. Storage cleanup failed.'))); });
  const stopSettings = observeSettings(next => applySettings({ ...next, ...pendingSettings }));
  const menuCommands: [MessageKey, () => void][] = [
    ['OpsGitTrees: Manage Token…', credentials.open],
    ['OpsGitTrees: Open file navigation', () => { if (sidebar) sidebar.setCollapsed(false); else void navigate(true); }],
  ];
  let menuIds: (string | number)[] = [], menuUpdate = Promise.resolve();
  function updateMenus(): void {
    menuUpdate = menuUpdate.then(async () => {
      for (const id of menuIds) await GM.unregisterMenuCommand(id);
      menuIds = [];
      if (!stopped) for (const [key, action] of menuCommands) menuIds.push(await GM.registerMenuCommand(t(key), action));
    }).catch(() => { if (!stopped) notice(msg('Script menu could not be updated.')); });
  }
  const stopLanguage = observeLanguage(updateMenus); updateMenus();
  const shortcut = (event: KeyboardEvent) => {
    if (!sidebar || !settings.shortcutsEnabled || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.composedPath().some(target => target instanceof HTMLElement && (target.matches('input,textarea,select,[role="textbox"]') || target.isContentEditable))) return;
    if (event.code === 'KeyO') { sidebar.setCollapsed(!settings.collapsed); event.preventDefault(); }
    if (event.code === 'KeyF') { sidebar.focusSearch(); event.preventDefault(); }
  };
  const pageHide = () => { credentials.close(); flushView(); flushSettings(); };
  window.addEventListener('keydown', shortcut); window.addEventListener('pagehide', pageHide);
  const stopPage = observePage(() => { void navigate(); });
  void purgePrivateData().catch(() => notice(msg('Cache cleanup failed. Check manager storage.')));
  applySettings({ ...await readSettings(), ...pendingSettings });
  await navigate();
  return { stop() { stopped = true; generation++; resolving.abort(); credentials.close(); detach(); stopPage(); stopAuth(); stopSettings(); stopLanguage(); updateMenus(); flushSettings(); window.removeEventListener('keydown', shortcut); window.removeEventListener('pagehide', pageHide); } };
}

export const application = window.top === window.self ? startApplication().catch(() => { void GM.notification({ title: 'OpsGitTrees', text: t('Could not start. Check userscript manager permissions and storage.'), timeout: 8000 }); return null; }) : Promise.resolve(null);

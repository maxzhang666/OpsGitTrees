import type { AuthScope, IndexView, PageContext, PageState, Settings, SidebarHandle, TreeViewState, ViewState } from './types';
import { fileUrl, observeTheme, parentDirectoryUrl, reservePageSpace } from './page';
import { filterTree, visiblePaths } from './search';
import { ancestors } from './tree-index';
import { createTranslations, getLanguage, msg, observeLanguage, renderText, t, type MessageKey, type Text } from './i18n';
import css from './style.css?inline';

const rowHeight = 24;
const emptySnapshot = (): TreeViewState => ({ expanded: [], scrollTop: 0, anchorPath: null, anchorOffset: 0 });
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; return node;
}
function button(text: string, label: string, className = ''): HTMLButtonElement { const node = element('button', className, text); node.type = 'button'; node.setAttribute('aria-label', label); node.title = label; return node; }
function subscribe<T>(listeners: Set<(value: T) => void>, listener: (value: T) => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
const iconPaths = {
  settings: 'm9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  back: 'm14 6-6 6 6 6', down: 'm7 10 5 5 5-5', right: 'm10 7 5 5-5 5',
  branch: 'M6 7v10M18 7v2a5 5 0 0 1-5 5H6M8 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  folder: 'M3 7V5h7l2 2h9v12H3Z', file: 'M6 3h8l4 4v14H6ZM14 3v5h4',
  link: 'M10 4h10v10M20 4 9 15M5 9H3v12h12v-2',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-2 4 6 6',
  locate: 'M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM12 2v5m0 10v5M2 12h5m10 0h5',
  close: 'm6 6 12 12M18 6 6 18',
} as const;
function svgIcon(name: keyof typeof iconPaths, className = ''): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', className);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', iconPaths[name]); svg.append(path); return svg;
}

export function mountSidebar(initialSettings: Settings): SidebarHandle {
  let settings = { ...initialSettings };
  const translations = createTranslations();
  function text<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, key: MessageKey): HTMLElementTagNameMap[K] { return translations.bind(element(tag, className), msg(key)); }
  function action(text: MessageKey | null, label: MessageKey, className = ''): HTMLButtonElement {
    const node = button('', '', className);
    if (text) translations.bind(node, msg(text));
    translations.bind(node, msg(label), 'aria-label'); translations.bind(node, msg(label), 'title'); return node;
  }
  function iconButton(icon: keyof typeof iconPaths, label: MessageKey, className = 'icon-button'): HTMLButtonElement { const node = action(null, label, className); node.append(svgIcon(icon)); return node; }
  const host = element('aside'); host.id = 'opsgittrees'; translations.bind(host, msg('OpsGitTrees repository navigation'), 'aria-label'); host.lang = getLanguage();
  host.style.cssText = 'position:fixed;left:0;top:0;bottom:0;z-index:100;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = element('style'); style.textContent = css;
  const shell = element('div', 'shell');
  const panel = element('div', 'panel');
  const header = element('header', 'header');
  const collapse = iconButton('back', 'Collapse file navigation');
  const owner = element('a', 'owner'); owner.hidden = true;
  const separator = element('span', 'repository-separator', '/'); separator.hidden = true;
  const repository = element('a', 'repository', t('Repository'));
  const refLabel = element('div', 'ref-label');
  const repositoryBar = element('div', 'repository-bar'); repositoryBar.append(owner, separator, repository);
  const searchBar = element('div', 'search-bar'); searchBar.id = 'ogt-search'; searchBar.hidden = true;
  const search = element('input'); search.type = 'search'; translations.bind(search, msg('Find a file or path…'), 'placeholder'); translations.bind(search, msg('Find a file or path'), 'aria-label'); search.autocomplete = 'off'; search.spellcheck = false;
  const clear = iconButton('close', 'Clear search', 'clear icon-button');
  const locate = iconButton('locate', 'Locate current file');
  searchBar.append(search, clear);
  const openSearch = iconButton('search', 'Find a file or path', 'icon-button search-toggle'); openSearch.setAttribute('aria-controls', searchBar.id); openSearch.setAttribute('aria-expanded', 'false');
  const openSettings = button('', '', 'icon-button settings-toggle'); openSettings.append(svgIcon('settings'));
  const repositoryRow = element('div', 'repository-row'); repositoryRow.append(repositoryBar, openSettings);
  const refRow = element('div', 'ref-row'); refRow.append(svgIcon('branch', 'ref-icon'), refLabel, openSearch, locate);
  header.append(repositoryRow, refRow);
  const status = element('div', 'status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const footer = element('footer', 'footer'); footer.append(status, collapse);
  const resume = action('Continue loading', 'Continue directory loading', 'resume'); resume.hidden = true;
  const viewport = element('div', 'viewport'); viewport.setAttribute('role', 'tree'); translations.bind(viewport, msg('Repository files'), 'aria-label'); viewport.tabIndex = 0;
  const canvas = element('div', 'canvas'); viewport.append(canvas);
  const noResults = element('div', 'no-results');
  const settingsPanel = element('section', 'settings'); settingsPanel.hidden = true;
  const languageLabel = element('label', 'language-option'); languageLabel.append(text('span', '', 'Language'));
  const language = element('select'); translations.bind(language, msg('Interface language'), 'aria-label');
  for (const [value, label] of [['auto', ''], ['zh-CN', '简体中文'], ['en', 'English']]) {
    const option = element('option', '', label); option.value = value!; if (value === 'auto') translations.bind(option, msg('Follow browser')); language.append(option);
  }
  language.value = settings.language; languageLabel.append(language); settingsPanel.append(languageLabel);
  const shortcutsLabel = element('label', 'option'), shortcuts = element('input'); shortcuts.type = 'checkbox'; shortcuts.checked = settings.shortcutsEnabled;
  translations.bind(shortcuts, msg('Keyboard shortcuts'), 'aria-label'); translations.bind(shortcuts, msg('Enable Alt+Shift+O / Alt+Shift+F'), 'title'); shortcuts.setAttribute('role', 'switch');
  shortcutsLabel.append(translations.bind(document.createTextNode(''), msg('Keyboard shortcuts')), shortcuts); settingsPanel.append(shortcutsLabel);
  const authHeading = text('h2', '', 'GitHub API authentication');
  const identity = element('p', 'identity');
  const manageToken = action('Manage Token…', 'Open Token configuration dialog');
  const connectionStatus = element('p', 'connection-status'); connectionStatus.setAttribute('role', 'status');
  settingsPanel.append(authHeading, identity, manageToken, connectionStatus);
  panel.append(header, searchBar, viewport, noResults, settingsPanel, resume, footer);
  const rail = action('FILES ›', 'Open file navigation', 'rail');
  const resize = element('div', 'resize'); resize.tabIndex = 0; resize.setAttribute('role', 'separator'); translations.bind(resize, msg('Resize file navigation'), 'aria-label'); resize.setAttribute('aria-orientation', 'vertical'); resize.setAttribute('aria-valuemin', '200'); resize.setAttribute('aria-valuemax', '480');
  shell.append(panel, rail, resize); shadow.append(style, shell); document.body.append(host);
  let space = reservePageSpace(settings.collapsed ? 24 : settings.width);
  const stopTheme = observeTheme(dark => host.setAttribute('data-theme', dark ? 'dark' : 'light'));
  const viewListeners = new Set<(state: ViewState) => void>();
  const settingsListeners = new Set<(value: Settings) => void>();
  const resumeListeners = new Set<(value: void) => void>();
  const manageListeners = new Set<(value: void) => void>();
  const visibleListeners = new Set<(value: readonly string[]) => void>();
  let view: ViewState = { browsing: emptySnapshot(), search: null };
  let searchOpen = false;
  let index: IndexView = { entries: new Map(), children: new Map(), state: 'loading', pending: 0 };
  let context: PageContext | null = null, contextKey = '', currentPath = '';
  let contextMessage: Text = '', connectionMessage: Text = '';
  let auth: AuthScope = { id: 'anonymous', login: null, authenticated: false };
  function renderAuth() { identity.textContent = auth.authenticated ? t('Token saved · @{login}', { login: auth.login || '' }) : t('No Token configured.'); }
  function renderStatus() {
    const state = index.state === 'complete' ? t('Complete') : t('Index incomplete — {state}', { state: msg(index.state) });
    status.textContent = contextMessage && index.state === 'loading' ? renderText(contextMessage) : index.state === 'empty' ? t('This repository is empty.') : index.state === 'loading' ? t('Loading repository index…') : t('{count} paths · {state}', { count: index.entries.size, state }) + (index.pending ? ' · ' + t('{count} pending', { count: index.pending }) : '') + (index.reason ? '\n' + renderText(index.reason) : '');
  }
  let filtered: ReturnType<typeof filterTree> | null = null;
  let paths: readonly string[] = [], expanded = new Set<string>();
  let positionEstablished = false;
  let scrollFrame = 0, lastStart = -1, lastEnd = -1;
  let searchTimer: ReturnType<typeof setTimeout> | undefined, resumeTimer: ReturnType<typeof setTimeout> | undefined;
  const snapshot = () => view.search?.view || view.browsing;
  function capture() { if (!host.isConnected || settings.collapsed || viewport.hidden || !settingsPanel.hidden) return; const current = snapshot(); if (current.anchorPath && !index.entries.has(current.anchorPath) && index.state !== 'complete') return; const row = Math.floor(viewport.scrollTop / rowHeight); current.scrollTop = viewport.scrollTop; current.anchorPath = paths[row] || null; current.anchorOffset = viewport.scrollTop % rowHeight; }
  function changed() { for (const listener of viewListeners) listener(view); }
  function renderSettingsToggle() {
    const open = !settingsPanel.hidden, label = t(open ? 'Close navigation settings' : 'Open navigation settings');
    openSettings.setAttribute('aria-label', label); openSettings.title = label; openSettings.setAttribute('aria-pressed', String(open));
    openSettings.querySelector('path')!.setAttribute('d', iconPaths[open ? 'close' : 'settings']);
  }
  function renderSearch() { searchBar.hidden = !settingsPanel.hidden || !searchOpen; openSearch.setAttribute('aria-expanded', String(!searchBar.hidden)); }
  function setSearchOpen(open: boolean) { if (searchOpen === open) return; capture(); searchOpen = open; renderSearch(); restorePosition(); renderWindow(true); }
  function focusSearch() { setCollapsed(false); showSettings(false); setSearchOpen(true); search.focus(); }
  function updateLayout() { host.style.width = (settings.collapsed ? 24 : settings.width) + 'px'; shell.classList.toggle('collapsed', settings.collapsed); resize.setAttribute('aria-valuenow', String(settings.width)); space.setWidth(settings.collapsed ? 24 : settings.width); if (!settings.collapsed) { restorePosition(); renderWindow(true); } }
  function settingsChanged() { for (const listener of settingsListeners) listener({ ...settings }); }
  function setCollapsed(collapsed: boolean) { if (settings.collapsed === collapsed) return; if (collapsed) capture(); settings.collapsed = collapsed; updateLayout(); settingsChanged(); }
  function renderWindow(force = false) {
    if (settings.collapsed) return;
    const start = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - 8);
    const end = Math.min(paths.length, Math.ceil((viewport.scrollTop + (viewport.clientHeight || 480)) / rowHeight) + 8);
    if (!force && start === lastStart && end === lastEnd) return;
    lastStart = start; lastEnd = end;
    const focused = (shadow.activeElement as HTMLElement | null)?.dataset.path;
    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const path = paths[i]!, entry = index.entries.get(path)!;
      const row = entry.type === 'tree' ? button('', entry.name) : element('a');
      row.className = 'tree-row' + (path === currentPath ? ' current' : ''); row.dataset.path = path;
      const depth = path.split('/').length;
      row.style.top = i * rowHeight + 'px'; row.style.paddingLeft = (8 + (depth - 1) * 12) + 'px';
      row.setAttribute('role', 'treeitem'); row.setAttribute('aria-level', String(depth)); row.setAttribute('aria-selected', String(path === currentPath)); row.title = path;
      const guides = element('span', 'indent-guides'); guides.setAttribute('aria-hidden', 'true'); guides.style.width = (depth - 1) * 12 + 'px'; row.append(guides);
      const expander = element('span', 'expander'); if (entry.type === 'tree') expander.append(svgIcon(expanded.has(path) ? 'down' : 'right'));
      const icon = svgIcon(entry.type === 'tree' ? 'folder' : entry.type === 'commit' || entry.mode === '120000' ? 'link' : 'file', 'file-icon' + (entry.type === 'tree' ? ' folder-icon' : ''));
      const name = element('span', 'file-name', entry.name); row.append(expander, icon, name);
      if (entry.type === 'tree') {
        row.setAttribute('aria-expanded', String(expanded.has(path)));
        row.addEventListener('click', () => toggle(path));
      } else {
        (row as HTMLAnchorElement).href = context ? entry.type === 'commit' ? parentDirectoryUrl(context, path) : fileUrl(context, path) : '#';
        if (entry.type === 'commit') row.setAttribute('aria-label', t('{name} (submodule; open parent directory on GitHub)', { name: entry.name }));
        row.addEventListener('click', () => { capture(); changed(); });
      }
      fragment.append(row);
    }
    canvas.replaceChildren(fragment);
    if (focused) { const target = [...canvas.querySelectorAll<HTMLElement>('[data-path]')].find(el => el.dataset.path === focused); target?.focus({ preventScroll: true }); }
    const visible = paths.slice(start, end); for (const listener of visibleListeners) listener(visible);
  }
  function restorePosition() { const state = snapshot(); const anchor = state.anchorPath ? paths.indexOf(state.anchorPath) : -1; viewport.scrollTop = anchor >= 0 ? anchor * rowHeight + state.anchorOffset : state.scrollTop; }
  function rebuild(recompute = false) {
    if (recompute) filtered = view.search ? filterTree(index, view.search.query) : null;
    expanded = new Set(view.browsing.expanded);
    if (view.search) { for (const path of filtered?.autoExpanded || []) expanded.add(path); for (const path of view.search.view.expanded) expanded.add(path); for (const path of view.search.collapsed) expanded.delete(path); }
    paths = visiblePaths(index, filtered?.included || null, expanded);
    canvas.style.height = paths.length * rowHeight + 'px';
    noResults.textContent = paths.length ? '' : view.search ? index.state === 'complete' ? t('No matching paths.') : t('No loaded paths match. The index is incomplete.') : index.state === 'complete' ? t('No files in this version.') : '';
    noResults.hidden = !noResults.textContent || !settingsPanel.hidden;
    restorePosition(); renderWindow(true);
  }
  function toggle(path: string) {
    capture();
    if (view.search) { const manual = new Set(view.search.view.expanded), closed = new Set(view.search.collapsed); if (expanded.has(path)) { manual.delete(path); closed.add(path); } else { manual.add(path); closed.delete(path); } view.search.view.expanded = [...manual]; view.search.collapsed = [...closed]; }
    else { const open = new Set(view.browsing.expanded); if (open.has(path)) open.delete(path); else open.add(path); view.browsing.expanded = [...open]; }
    rebuild(); changed();
  }
  function queryChanged() {
    capture(); const query = search.value.trim();
    if (!query) view.search = null;
    else if (view.search) view.search.query = query;
    else view.search = { query, view: emptySnapshot(), collapsed: [] };
    if (query) searchOpen = true;
    renderSearch();
    rebuild(true); changed();
  }
  function positionCurrent(reveal: boolean) {
    if (reveal) { setCollapsed(false); showSettings(false); }
    capture(); clearTimeout(searchTimer); view.search = null; search.value = ''; if (reveal) searchOpen = false; renderSearch();
    view.browsing.expanded = [...new Set([...view.browsing.expanded, ...ancestors(currentPath)])];
    rebuild(true);
    const i = paths.indexOf(currentPath);
    if (i >= 0) {
      const top = Math.max(0, i * rowHeight - (viewport.clientHeight || 480) / 3);
      view.browsing.scrollTop = top; view.browsing.anchorPath = paths[Math.floor(top / rowHeight)] || null; view.browsing.anchorOffset = top % rowHeight;
      restorePosition();
    }
    renderWindow(true); positionEstablished = true; changed();
  }
  function locateCurrent() { positionCurrent(true); }
  function setIndex(next: IndexView) {
    index = next;
    if (next.state === 'complete') {
      const keep = (values: string[]) => values.filter(p => index.entries.has(p));
      view.browsing.expanded = keep(view.browsing.expanded);
      if (view.search) { view.search.view.expanded = keep(view.search.view.expanded); view.search.collapsed = keep(view.search.collapsed); }
    }
    renderStatus();
    clearTimeout(resumeTimer); resume.hidden = !next.canResume; resume.disabled = !!next.resumeAt && next.resumeAt > Date.now();
    if (resume.disabled && next.resumeAt) resumeTimer = setTimeout(() => { resume.disabled = false; }, Math.min(2147483647, Math.max(0, next.resumeAt - Date.now())));
    rebuild(true);
    if (!positionEstablished && !view.search && currentPath && index.entries.has(currentPath)) positionCurrent(false);
  }
  search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(queryChanged, 80); });
  clear.addEventListener('click', () => { clearTimeout(searchTimer); search.value = ''; queryChanged(); search.focus(); });
  search.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation(); clearTimeout(searchTimer);
    if (search.value || view.search) { search.value = ''; queryChanged(); }
    else { setSearchOpen(false); openSearch.focus(); }
  });
  openSearch.addEventListener('click', () => {
    if (settingsPanel.hidden && searchOpen && !search.value.trim()) {
      clearTimeout(searchTimer); search.value = ''; if (view.search) queryChanged(); setSearchOpen(false); openSearch.focus();
    } else focusSearch();
  });
  locate.addEventListener('click', locateCurrent); collapse.addEventListener('click', () => setCollapsed(true)); rail.addEventListener('click', () => setCollapsed(false));
  function showSettings(open: boolean) {
    if (open) capture();
    settingsPanel.hidden = !open; viewport.hidden = open; noResults.hidden = open || !noResults.textContent; renderSettingsToggle(); renderSearch();
    if (!open) { restorePosition(); renderWindow(true); }
  }
  openSettings.addEventListener('click', () => showSettings(settingsPanel.hidden !== false));
  shortcuts.addEventListener('change', () => { settings.shortcutsEnabled = shortcuts.checked; settingsChanged(); });
  language.addEventListener('change', () => { settings.language = language.value as Settings['language']; settingsChanged(); });
  resume.addEventListener('click', () => { for (const listener of resumeListeners) listener(); });
  manageToken.addEventListener('click', () => { for (const listener of manageListeners) listener(); });
  viewport.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; capture(); renderWindow(); changed(); }); }, { passive: true });
  const resizeObserver = new ResizeObserver(() => renderWindow(true)); resizeObserver.observe(viewport);
  let dragging = false;
  const setWidth = (width: number) => { settings.width = Math.round(Math.max(200, Math.min(480, width))); updateLayout(); settingsChanged(); };
  resize.addEventListener('pointerdown', event => { if (event.button !== 0) return; dragging = true; resize.setPointerCapture(event.pointerId); event.preventDefault(); });
  resize.addEventListener('pointermove', event => { if (dragging) setWidth(event.clientX); });
  resize.addEventListener('pointerup', () => { dragging = false; }); resize.addEventListener('lostpointercapture', () => { dragging = false; });
  resize.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { setWidth(settings.width + (event.key === 'ArrowLeft' ? -20 : 20)); event.preventDefault(); } });
  const stopLanguage = observeLanguage(() => { translations.refresh(); host.lang = getLanguage(); if (!repository.hasAttribute('href')) { repository.textContent = t('Repository'); repositoryBar.title = t('Repository'); } renderSettingsToggle(); renderStatus(); renderAuth(); connectionStatus.textContent = renderText(connectionMessage); rebuild(); });
  renderSettingsToggle(); renderAuth(); renderStatus();
  updateLayout();
  return {
    reconnect() {
      if (host.isConnected) return;
      space.destroy(); document.body.append(host);
      space = reservePageSpace(settings.collapsed ? 24 : settings.width);
      restorePosition(); renderWindow(true);
    },
    setContext(state: PageState) {
      contextMessage = state.kind === 'unresolved' ? state.message : '';
      if (state.kind === 'code') {
        const key = state.context.owner + '/' + state.context.repo + ':' + state.context.refKind + ':' + state.context.refName;
        if (key !== contextKey) { clearTimeout(searchTimer); contextKey = key; view = { browsing: emptySnapshot(), search: null }; search.value = ''; searchOpen = false; renderSearch(); filtered = null; positionEstablished = false; }
        context = state.context; currentPath = context.path;
      } else context = null;
      const repo = state.kind === 'code' ? state.context : state.kind === 'empty' ? state : null;
      owner.hidden = separator.hidden = !repo; owner.textContent = repo?.owner || '';
      repository.textContent = repo?.repo || t('Repository');
      if (repo) { const ownerPath = '/' + encodeURIComponent(repo.owner); owner.href = ownerPath; repository.href = ownerPath + '/' + encodeURIComponent(repo.repo); }
      else { owner.removeAttribute('href'); repository.removeAttribute('href'); }
      repositoryBar.title = repo ? repo.owner + ' / ' + repo.repo : t('Repository');
      refLabel.textContent = state.kind === 'code' ? state.context.refName : ''; refLabel.title = refLabel.textContent;
      renderStatus();
    },
    setSettings(next: Settings) {
      const layoutChanged = settings.collapsed !== next.collapsed || settings.width !== next.width;
      if (next.collapsed && !settings.collapsed) capture();
      settings = { ...next }; shortcuts.checked = settings.shortcutsEnabled; language.value = settings.language;
      if (layoutChanged) updateLayout();
    },
    setCollapsed, setIndex,
    setCurrentPath(path) { currentPath = path; if (!view.search) { view.browsing.expanded = [...new Set([...view.browsing.expanded, ...ancestors(path)])]; rebuild(); } else renderWindow(true); },
    focusSearch,
    locateCurrent,
    getView() { capture(); return structuredClone(view); },
    restoreView(state) { view = structuredClone(state); search.value = view.search?.query || ''; searchOpen = !!view.search; renderSearch(); positionEstablished = true; rebuild(true); },
    onViewChange: listener => subscribe(viewListeners, listener),
    onSettingsChange: listener => subscribe(settingsListeners, listener),
    onResumePreload: listener => subscribe(resumeListeners, listener),
    onManageToken: listener => subscribe(manageListeners, listener),
    onVisiblePaths: listener => subscribe(visibleListeners, listener),
    setAuth(scope: AuthScope) { auth = scope; renderAuth(); },
    setConnectionStatus(message) { connectionMessage = message; connectionStatus.textContent = renderText(message); },
    destroy() { clearTimeout(searchTimer); clearTimeout(resumeTimer); cancelAnimationFrame(scrollFrame); resizeObserver.disconnect(); stopTheme(); stopLanguage(); space.destroy(); host.remove(); viewListeners.clear(); settingsListeners.clear(); resumeListeners.clear(); manageListeners.clear(); visibleListeners.clear(); },
  };
}

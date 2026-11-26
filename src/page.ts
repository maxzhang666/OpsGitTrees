import type { PageContext, PageState } from './types';
import { msg } from './i18n';

const embeddedSelector = 'react-app[app-name="code-view"] script[data-target="react-app.embeddedData"]';
const shaPattern = /^[a-f0-9]{40}$/i;
const normalPath = (path: string) => decodeURIComponent(path).replace(/\/$/, '');
const reservedRoots = new Set(['settings', 'orgs', 'organizations', 'users', 'search', 'marketplace', 'collections', 'topics', 'explore', 'login', 'logout', 'join', 'signup', 'features', 'enterprise', 'pricing', 'sponsors', 'notifications', 'account', 'customer-stories', 'solutions', 'security', 'about', 'site', 'readme', 'apps', 'codespaces', 'discussions', 'events', 'contact', 'education', 'resources']);

export function readPage(doc: Document, url: URL): PageState {
  if (url.origin !== 'https://github.com') return { kind: 'outside' };
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2 || (parts.length > 2 && parts[2] !== 'tree' && parts[2] !== 'blob')) return { kind: 'outside' };
  let owner: string, repo: string;
  try { owner = decodeURIComponent(parts[0]!); repo = decodeURIComponent(parts[1]!); } catch { return { kind: 'unresolved', message: msg('Invalid repository URL') }; }
  if (reservedRoots.has(owner.toLowerCase())) return { kind: 'outside' };
  const unresolved: PageState = { kind: 'unresolved', message: msg('Waiting for GitHub repository context…') };
  const script = doc.querySelector(embeddedSelector);
  try {
    const payload = JSON.parse(script?.textContent || '{}').payload;
    const layout = payload?.codeViewLayoutRoute;
    const repository = layout?.repo;
    if (repository?.ownerLogin?.toLowerCase() !== owner.toLowerCase() || repository?.name?.toLowerCase() !== repo.toLowerCase()) {
      const nwo = doc.querySelector('meta[name="octolytics-dimension-repository_nwo"]')?.getAttribute('content');
      const empty = [...doc.querySelectorAll('h3')].some(el => el.textContent?.trim() === 'This repository is empty.');
      return parts.length === 2 && empty && nwo?.toLowerCase() === (owner + '/' + repo).toLowerCase() ? { kind: 'empty', owner, repo } : unresolved;
    }
    if (repository.isEmpty === true && parts.length === 2) return { kind: 'empty', owner, repo };
    const view = parts.length === 2 ? 'root' : parts[2] as 'tree' | 'blob';
    const route = view === 'root' ? payload.codeViewRepoRoute : view === 'tree' ? payload.codeViewTreeRoute : payload.codeViewBlobLayoutRoute;
    const ref = route?.refInfo;
    if (typeof route?.path !== 'string' || typeof ref?.name !== 'string' || !shaPattern.test(ref?.currentOid || '')) return unresolved;
    const path = route.path === '/' ? '' : route.path;
    const refKind = ref.refType === 'branch' || ref.refType === 'tag' || ref.refType === 'commit' ? ref.refType : ref.name === ref.currentOid ? 'commit' : null;
    if (!refKind) return unresolved;
    const context: PageContext = { owner, repo, refName: ref.name, commitSha: ref.currentOid, refKind, path, view };
    const expected = view === 'root' ? '/' + owner + '/' + repo : '/' + owner + '/' + repo + '/' + view + '/' + ref.name + (path ? '/' + path : '');
    if (normalPath(url.pathname) !== expected.replace(/\/$/, '')) return unresolved;
    return { kind: 'code', context };
  } catch { return unresolved; }
}

export function fileUrl(context: PageContext, path: string): string {
  const base = 'https://github.com/' + encodeURIComponent(context.owner) + '/' + encodeURIComponent(context.repo);
  return base + '/blob/' + encodeURIComponent(context.refName) + '/' + path.split('/').map(encodeURIComponent).join('/');
}

export function parentDirectoryUrl(context: PageContext, path: string): string {
  const parent = path.slice(0, Math.max(0, path.lastIndexOf('/')));
  return 'https://github.com/' + encodeURIComponent(context.owner) + '/' + encodeURIComponent(context.repo) + '/tree/' + encodeURIComponent(context.refName) + (parent ? '/' + parent.split('/').map(encodeURIComponent).join('/') : '');
}

export function observePage(onChange: () => void): () => void {
  let frame = 0;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; onChange(); }); };
  const events = ['turbo:render', 'turbo:load', 'pjax:end'];
  events.forEach(event => document.addEventListener(event, schedule));
  window.addEventListener('popstate', schedule);
  const observer = new MutationObserver(records => {
    if (records.some(r => [...r.removedNodes].some(n => n instanceof Element) || [...r.addedNodes].some(n => n instanceof Element && n.id !== 'opsgittrees'))) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => { observer.disconnect(); cancelAnimationFrame(frame); events.forEach(e => document.removeEventListener(e, schedule)); window.removeEventListener('popstate', schedule); };
}

export function observeTheme(listener: (dark: boolean) => void): () => void {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const update = () => { const mode = document.documentElement.getAttribute('data-color-mode'); listener(mode === 'dark' || (mode !== 'light' && media.matches)); };
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode', 'data-light-theme', 'data-dark-theme'] });
  media.addEventListener('change', update);
  update();
  return () => { observer.disconnect(); media.removeEventListener('change', update); };
}

export function reservePageSpace(width: number): { setWidth(width: number): void; destroy(): void } {
  const body = document.body;
  const value = body.style.getPropertyValue('margin-left');
  const priority = body.style.getPropertyPriority('margin-left');
  const originalMargin = getComputedStyle(body).marginLeft;
  const setWidth = (next: number) => body.style.setProperty('margin-left', 'calc(' + originalMargin + ' + ' + next + 'px)', 'important');
  setWidth(width);
  return { setWidth, destroy: () => { if (value) body.style.setProperty('margin-left', value, priority); else body.style.removeProperty('margin-left'); } };
}

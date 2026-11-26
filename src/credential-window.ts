import { GM_info } from '$';
import { clearToken, configureToken, CredentialError, getGitHubClient, isAbortError, isAuthScopeCurrent, observeAuthScope, readAuthScope, readSavedToken } from './credentials';
import { ApiError } from './github';
import { observeTheme } from './page';
import { createTranslations, getLanguage, msg, observeLanguage, renderText, t, type Text } from './i18n';
import type { AuthScope } from './types';
import css from './credential-window.css?inline';

function isolationRestriction(): Text | null {
  const info = GM_info as unknown as { scriptHandler?: string; sandboxMode?: string; injectInto?: string; scriptMetaStr?: string };
  if (info.scriptHandler === 'Tampermonkey' && info.sandboxMode === 'dom') return null;
  if (info.scriptHandler === 'Violentmonkey' && info.injectInto === 'content') return null;
  // ScriptCat enforces content metadata, but 1.5.2 does not report the actual world in GM_info.
  if (info.scriptHandler === 'ScriptCat' && /^\/\/\s*@inject-into\s+content\s*$/m.test(info.scriptMetaStr || '')) return null;
  return msg('Token input is unavailable in this execution context. Reinstall the current script with content / DOM isolation enabled, then reload GitHub. No Token was requested.');
}
function failure(error: unknown): Text {
  if (error instanceof CredentialError) return msg('{stage} stage: {error}', { stage: msg(error.stage), error: error.detail });
  if (error instanceof ApiError) return msg('API check: {error}', { error: error.detail });
  if (isAbortError(error)) return msg('Cancelled or authorization changed. Candidate not saved.');
  return msg('Userscript storage could not be accessed. Check the manager before retrying.');
}

export function createCredentialManager(notice: (message: Text) => void, checkRepository: (signal: AbortSignal) => Promise<Text>): { open(): void; close(): void } {
  let dialog: HTMLDialogElement | null = null;
  let dispose: (() => void) | null = null;
  let cancel: (() => void) | null = null;
  let result: ((message: Text, kind?: string) => void) | null = null;
  async function clear(): Promise<void> {
    cancel?.();
    try {
      await clearToken();
      const message = msg('Local Token cleared. Private cache is invalidated. Revoke the Token separately on GitHub if needed.');
      result?.(message, 'success'); notice(message);
    } catch (error) { const message = failure(error); result?.(message, 'error'); notice(message); }
  }
  function close(): void { dispose?.(); }
  function open(): void {
    if (dialog?.isConnected) { dialog.querySelector('input')?.focus(); return; }
    dispose?.();
    const restriction = isolationRestriction();
    if (restriction) { notice(restriction); return; }
    const doc = document;
    const host = doc.createElement('div'); host.id = 'opsgittrees-credentials';
    const shadow = host.attachShadow({ mode: 'open' });
    const translations = createTranslations(); host.lang = getLanguage();
    function node<K extends keyof HTMLElementTagNameMap>(tag: K, text: Text = '', className = ''): HTMLElementTagNameMap[K] {
      const element = doc.createElement(tag); if (typeof text === 'string') element.textContent = text; else translations.bind(element, text); element.className = className; return element;
    }
    function button(text: Text): HTMLButtonElement { const element = node('button', text); element.type = 'button'; return element; }
    const modal = node('dialog'); modal.setAttribute('aria-labelledby', 'token-title');
    dialog = modal;
    const main = node('main');
    const done = button('×'); done.className = 'close'; translations.bind(done, msg('Close Token configuration'), 'aria-label');
    const title = node('h1', msg('Token management')); title.id = 'token-title';
    const header = node('header'); header.append(title, done);
    const summary = node('div', '', 'summary');
    const stored = node('span', '', 'stored'), account = node('span');
    summary.append(stored, account);
    const form = node('form');
    const label = node('label', 'Token'); label.htmlFor = 'token';
    const input = node('input'); input.id = 'token'; input.type = 'password'; input.required = true; input.autocomplete = 'off'; input.spellcheck = false; input.autocapitalize = 'none';
    const field = node('div', '', 'token-field');
    const reveal = button(''); reveal.className = 'reveal';
    const icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
    const eye = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); eye.setAttribute('d', 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z');
    const slash = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); slash.setAttribute('d', 'M3 3l18 18'); slash.classList.add('slash');
    icon.append(eye, slash); reveal.append(icon); field.append(input, reveal);
    function setRevealed(show: boolean) {
      input.type = show ? 'text' : 'password'; reveal.setAttribute('aria-pressed', String(show));
      const text = t(show ? 'Hide Token' : 'Show Token'); reveal.setAttribute('aria-label', text); reveal.title = text;
    }
    setRevealed(false);
    const save = button(msg('Verify & save')); save.type = 'submit'; save.className = 'primary';
    const stop = button(msg('Cancel check')); stop.hidden = true;
    const actions = node('div', '', 'actions'); actions.append(save, stop);
    form.append(label, field, actions);
    let lastResult: Text = '';
    const status = node('p', '', 'result'); status.hidden = true; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const check = button(msg('Check saved Token')), repository = button(msg('Check current repository')), remove = button(msg('Clear local Token')); remove.className = 'danger';
    const secondary = node('div', '', 'actions'); secondary.append(check, repository, remove);
    const guide = node('section', '', 'guide');
    const create = node('a', msg('Create a fine-grained Token ↗')); create.href = 'https://github.com/settings/personal-access-tokens/new'; create.target = '_blank'; create.rel = 'noopener noreferrer';
    const revoke = node('a', msg('Manage / revoke on GitHub ↗')); revoke.href = 'https://github.com/settings/personal-access-tokens'; revoke.target = '_blank'; revoke.rel = 'noopener noreferrer';
    guide.append(node('h2', msg('Minimum access')), node('p', msg('Contents: Read-only · Metadata: Read-only')), create, revoke);
    const privacy = node('p', msg('This page can read the Token. Clearing locally does not revoke it on GitHub.'), 'privacy');
    main.append(header, summary, form, status, secondary, guide, privacy);
    modal.append(main); shadow.append(node('style', css), modal); doc.body.append(host);
    const stopTheme = observeTheme(dark => host.setAttribute('data-theme', dark ? 'dark' : 'light'));
    let scope: AuthScope | null = null, operation: AbortController | null = null, clearing = false, disposed = false, edited = false;
    const live = () => !disposed && dialog === modal && host.isConnected;
    const report = (message: Text, kind = 'info') => { if (live()) { lastResult = message; status.textContent = renderText(message); status.hidden = false; status.dataset.kind = kind; } };
    result = report;
    function controls() { const busy = !!operation || clearing; input.disabled = busy; save.disabled = busy; stop.hidden = !operation; check.disabled = busy || !scope?.authenticated; repository.disabled = busy; remove.disabled = clearing || !scope?.authenticated && !operation; }
    function renderSummary() {
      stored.textContent = t(scope?.authenticated ? 'Token saved' : 'Not configured');
      account.textContent = scope?.authenticated ? '@' + scope.login : '';
      summary.dataset.authenticated = String(!!scope?.authenticated);
      summary.title = t(scope?.authenticated ? 'Token · public and private repositories' : 'Anonymous');
    }
    const stopLanguage = observeLanguage(() => { translations.refresh(); host.lang = getLanguage(); renderSummary(); status.textContent = renderText(lastResult); setRevealed(input.type === 'text'); });
    async function refresh() {
      try {
        const next = await readAuthScope();
        const token = next.authenticated ? await readSavedToken(next) : null;
        if (!live() || !isAuthScopeCurrent(next)) return; scope = next;
        if (!edited) input.value = token || '';
        renderSummary(); controls();
      } catch (error) { if (!isAbortError(error)) report(failure(error), 'error'); }
    }
    cancel = () => { operation?.abort(); input.value = ''; edited = false; setRevealed(false); };
    const stopObserve = observeAuthScope(() => { input.value = ''; edited = false; setRevealed(false); void refresh(); });
    dispose = () => {
      if (disposed) return; disposed = true; operation?.abort(); input.value = ''; stopObserve();
      stopTheme(); stopLanguage(); modal.close(); host.remove(); result = null; cancel = null; dispose = null; dialog = null;
    };
    modal.addEventListener('cancel', event => { event.preventDefault(); close(); });
    modal.addEventListener('close', () => { if (live()) close(); });
    modal.addEventListener('click', event => {
      if (event.target !== modal) return;
      const box = modal.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    });
    input.addEventListener('input', () => { edited = true; });
    reveal.addEventListener('click', () => setRevealed(input.type === 'password'));
    stop.addEventListener('click', () => { cancel?.(); report(msg('Cancelling the check…')); });
    done.addEventListener('click', close);
    remove.addEventListener('click', () => { clearing = true; controls(); void clear().finally(() => { clearing = false; if (live()) { controls(); void refresh(); } }); });
    form.addEventListener('submit', event => {
      event.preventDefault(); if (operation || clearing) return;
      const candidate = input.value; input.value = ''; edited = false; setRevealed(false);
      const controller = new AbortController(); operation = controller; controls(); report(msg('Checking identity with GitHub. Candidate is not saved yet…'));
      void configureToken(candidate, controller.signal).then(next => { if (!live() || controller.signal.aborted) return; report(msg('Saved and read back from userscript storage. API account: @{login}. Repository permissions are checked separately.', { login: next.login || '' }), 'success'); notice(msg('Token saved. API requests now use @{login}.', { login: next.login || '' })); }).catch(error => report(failure(error), 'error')).finally(() => { if (operation === controller) operation = null; if (live()) { controls(); void refresh(); } });
    });
    check.addEventListener('click', () => {
      if (operation || clearing || !scope?.authenticated) return;
      const checked = scope, controller = new AbortController(); operation = controller; controls(); report(msg('Checking saved Token identity…'));
      void getGitHubClient(checked).then(client => client.getIdentity(controller.signal)).then(identity => { if (live() && !controller.signal.aborted && isAuthScopeCurrent(checked)) report(msg('Identity verified: @{login}.', { login: identity.login }), 'success'); }).catch(error => report(failure(error), 'error')).finally(() => { if (operation === controller) operation = null; if (live()) controls(); });
    });
    repository.addEventListener('click', () => {
      if (operation || clearing) return;
      const controller = new AbortController(); operation = controller; controls(); report(msg('Checking identity and repository access…'));
      void checkRepository(controller.signal).then(message => { if (live() && !controller.signal.aborted) report(message, 'success'); }).catch(error => report(failure(error), 'error')).finally(() => { if (operation === controller) operation = null; if (live()) controls(); });
    });
    controls(); void refresh(); modal.showModal(); input.focus();
  }
  return { open, close };
}

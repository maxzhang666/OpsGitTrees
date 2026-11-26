import { GM, GM_getValue } from '$';
import { ApiError, createGitHubClient } from './github';
import { msg, renderText, type Text } from './i18n';
import type { AuthScope, GitHubClient } from './types';

const key = 'ogt:credentials:v1';
interface Credential { id: string; token: string | null; login: string | null }
const empty: Credential = { id: 'anonymous', token: null, login: null };
async function current(): Promise<Credential> { return await GM.getValue<Credential>(key, empty); }
const scopeOf = (value: Credential): AuthScope => ({ id: value.id, login: value.login, authenticated: !!value.token });
export function isAbortError(error: unknown): boolean { return error !== null && typeof error === 'object' && 'name' in error && error.name === 'AbortError'; }
export async function readAuthScope(): Promise<AuthScope> { return scopeOf(await current()); }
export async function readSavedToken(scope: AuthScope): Promise<string | null> {
  const value = await current();
  if (scope.id !== value.id || scope.authenticated !== !!value.token) throw new DOMException('Authorization changed', 'AbortError');
  return value.token;
}
export function isAuthScopeCurrent(scope: AuthScope): boolean { const value = GM_getValue<Credential>(key, empty); return scope.id === value.id && scope.authenticated === !!value.token; }
export function withAuthLock<T>(operation: () => Promise<T>): Promise<T> {
  return navigator.locks.request('opsgittrees:authorization', operation);
}
export async function getGitHubClient(scope: AuthScope): Promise<GitHubClient> {
  const value = await current();
  if (scope.id !== value.id || scope.authenticated !== !!value.token) throw new DOMException('Authorization changed', 'AbortError');
  return createGitHubClient(value.token);
}
export function observeAuthScope(listener: (scope: AuthScope) => void): () => void {
  let stopped = false;
  const registration = Promise.resolve(GM.addValueChangeListener<Credential>(key, (_name, _old, value) => { if (!stopped) listener(scopeOf(value || empty)); }));
  return () => { stopped = true; void registration.then(id => GM.removeValueChangeListener(id)); };
}
export class CredentialError extends Error {
  constructor(public readonly stage: 'input' | 'identity' | 'storage', public readonly detail: Text) { super(renderText(detail)); this.name = 'CredentialError'; }
}
export async function configureToken(input: string, signal: AbortSignal = new AbortController().signal): Promise<AuthScope> {
  const token = input.trim();
  if (!token) throw new CredentialError('input', msg('Enter a Token to verify and save.'));
  const before = await current();
  let identity: { login: string };
  try { identity = await createGitHubClient(token).getIdentity(signal); }
  catch (error) {
    if (signal.aborted || isAbortError(error)) throw new DOMException('Token check cancelled', 'AbortError');
    throw new CredentialError('identity', msg('{error} Existing credential kept.', { error: error instanceof ApiError ? error.detail : msg('Identity request could not be completed.') }));
  }
  return withAuthLock(async () => {
    const latest = await current();
    if (signal.aborted || latest.id !== before.id) throw new DOMException('Token check cancelled or authorization changed; candidate not saved', 'AbortError');
    const value: Credential = { id: crypto.randomUUID(), token, login: identity.login };
    try {
      await GM.setValue(key, value);
      const stored = await current();
      if (signal.aborted) {
        await GM.setValue(key, { ...before, id: crypto.randomUUID() });
        throw new DOMException('Token save cancelled', 'AbortError');
      }
      if (stored.id !== value.id) throw new CredentialError('storage', msg('Stored credential could not be confirmed. Check the userscript manager.'));
    } catch (error) {
      if (isAbortError(error) || error instanceof CredentialError) throw error;
      throw new CredentialError('storage', msg('Could not confirm the credential write. Check the userscript manager storage before retrying.'));
    }
    return scopeOf(value);
  });
}
export async function clearToken(): Promise<void> {
  await withAuthLock(async () => { await GM.setValue(key, { id: crypto.randomUUID(), token: null, login: null } satisfies Credential); });
}

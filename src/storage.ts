import { GM, GM_setValue } from '$';
import { isAuthScopeCurrent, readAuthScope, withAuthLock } from './credentials';
import { parseTreeResponse } from './github';
import { msg, renderText } from './i18n';
import type { AuthScope, CommitContext, RepoContext, Settings, TreeCacheValue, TreeEntry, TreeResponse, ViewState } from './types';

export const defaultSettings: Settings = { collapsed: false, width: 280, shortcutsEnabled: true, language: 'auto' };
const settingsKey = 'ogt:settings:v1';
const prefix = 'ogt:data:v1:';
const cachePrefix = 'ogt:cache:v2:';
const storageLock = 'opsgittrees:storage';
const objectSha = /^[0-9a-f]{40}$/i;
const encoder = new TextEncoder();
const totalLimit = 16 * 1024 * 1024;
interface CacheEnvelope { schema: 2; repoId: number; scope: string; private: boolean; usedAt: number; treeSha: string }
type CacheRecord = CacheEnvelope & ({ kind: 'commit'; commitSha: string } | { kind: 'response'; recursive: boolean; response: TreeResponse } | { kind: 'split'; recursive: true });
interface RecordValue { schema: 1; scope: string; private: boolean; usedAt: number; entries?: readonly TreeEntry[]; view?: ViewState }
export class StorageLimitError extends Error {
  readonly detail = msg('Persistent-cache budget exceeded; loaded paths remain available in memory.');
  constructor() { super(); this.message = renderText(this.detail); }
}
const cacheScope = (context: CommitContext, scope: AuthScope) => context.visibility === 'public' ? 'public' : scope.id;
const treeKey = (context: RepoContext, scope: AuthScope) => prefix + JSON.stringify(['tree', context.repoId, context.rootTreeSha, cacheScope(context, scope)]);
const viewKey = (context: RepoContext, scope: AuthScope) => prefix + JSON.stringify(['view', context.repoId, context.refKind, context.refName, cacheScope(context, scope)]);
const commitKey = (context: CommitContext, scope: AuthScope) => cachePrefix + JSON.stringify(['commit', context.repoId, context.commitSha, cacheScope(context, scope)]);
const blockKey = (context: RepoContext, scope: AuthScope, sha: string, recursive: boolean) => cachePrefix + JSON.stringify(['tree', context.repoId, sha, recursive, cacheScope(context, scope)]);
async function allowed(context: CommitContext, scope: AuthScope): Promise<boolean> {
  if (context.visibility === 'public') return true;
  const now = await readAuthScope();
  return scope.authenticated && now.authenticated && now.id === scope.id && isAuthScopeCurrent(scope);
}
function parse(value: unknown): RecordValue | null {
  if (typeof value !== 'string') return null;
  try { const record = JSON.parse(value) as RecordValue | null; return record?.schema === 1 && typeof record.scope === 'string' && typeof record.private === 'boolean' && typeof record.usedAt === 'number' ? record : null; } catch { return null; }
}
function parseCache(key: string, value: unknown): CacheRecord | null {
  if (!key.startsWith(cachePrefix) || typeof value !== 'string') return null;
  try {
    const record = JSON.parse(value) as (Partial<CacheEnvelope> & { kind?: unknown; commitSha?: unknown; recursive?: unknown; response?: unknown }) | null;
    const identity: unknown = JSON.parse(key.slice(cachePrefix.length));
    if (!record || !Array.isArray(identity) || record.schema !== 2 || typeof record.repoId !== 'number' || !Number.isSafeInteger(record.repoId) || record.repoId <= 0 ||
      typeof record.scope !== 'string' || !record.scope || typeof record.private !== 'boolean' || record.private !== (record.scope !== 'public') ||
      typeof record.usedAt !== 'number' || !Number.isFinite(record.usedAt) || record.usedAt < 0 || typeof record.treeSha !== 'string' || !objectSha.test(record.treeSha) || identity[1] !== record.repoId) return null;
    if (record.kind === 'commit') {
      if (identity.length !== 4 || identity[0] !== 'commit' || identity[2] !== record.commitSha || identity[3] !== record.scope || typeof record.commitSha !== 'string' || !objectSha.test(record.commitSha)) return null;
      return record as CacheRecord;
    }
    if (identity.length !== 5 || identity[0] !== 'tree' || identity[2] !== record.treeSha || identity[3] !== record.recursive || identity[4] !== record.scope || typeof record.recursive !== 'boolean') return null;
    if (record.kind === 'split') return record.recursive && !('response' in record) ? record as CacheRecord : null;
    if (record.kind !== 'response') return null;
    const response = parseTreeResponse(record.response, record.treeSha);
    if (!response) return null;
    record.response = response;
    return record as CacheRecord;
  } catch { return null; }
}
async function readCacheRecord(key: string, context: CommitContext, scope: AuthScope): Promise<CacheRecord | null> {
  if (!await allowed(context, scope)) return null;
  const record = parseCache(key, await GM.getValue(key));
  if (!record || record.scope !== cacheScope(context, scope) || record.private !== (context.visibility !== 'public') || !await allowed(context, scope)) return null;
  return record;
}
// Callers hold storage before taking authorization; helpers never reacquire storage.
async function deleteUnchanged(key: string, raw: unknown, scope: AuthScope): Promise<boolean> {
  return withAuthLock(async () => {
    if (!isAuthScopeCurrent(scope)) return false;
    const current = await GM.getValue(key);
    if (!isAuthScopeCurrent(scope) || current !== raw) return false;
    await GM.deleteValue(key);
    return true;
  });
}
async function readRecord(key: string, context: RepoContext, scope: AuthScope): Promise<RecordValue | null> {
  if (!await allowed(context, scope)) return null;
  const record = parse(await GM.getValue(key));
  if (!record || record.scope !== cacheScope(context, scope) || record.private !== (context.visibility !== 'public') || !await allowed(context, scope)) return null;
  return record;
}
async function trim(): Promise<void> {
  const scope = await readAuthScope();
  const records: { key: string; raw: string; bytes: number; usedAt: number }[] = [];
  for (const key of await GM.listValues()) {
    if (!key.startsWith(prefix) && !key.startsWith(cachePrefix)) continue;
    const raw = await GM.getValue<unknown>(key);
    if (!isAuthScopeCurrent(scope)) return;
    const record = key.startsWith(cachePrefix) ? parseCache(key, raw) : parse(raw);
    if (!record || (record.private && (!scope.authenticated || record.scope !== scope.id))) {
      await deleteUnchanged(key, raw, scope);
      continue;
    }
    if (key.startsWith(cachePrefix)) continue;
    records.push({ key, raw: raw as string, bytes: encoder.encode(raw as string).byteLength, usedAt: record.usedAt });
  }
  let size = records.reduce((n, r) => n + r.bytes, 0);
  records.sort((a, b) => a.usedAt - b.usedAt);
  for (const record of records) {
    if (size <= totalLimit || !isAuthScopeCurrent(scope)) break;
    if (await deleteUnchanged(record.key, record.raw, scope)) size -= record.bytes;
  }
}
function serialize(record: RecordValue | CacheRecord): string {
  const value = JSON.stringify(record);
  if (encoder.encode(value).byteLength > totalLimit) throw new StorageLimitError();
  return value;
}
async function finishWrite(key: string, serialized: string, context: CommitContext, scope: AuthScope): Promise<void> {
  const authorized = await allowed(context, scope);
  if (authorized) await trim();
  if (!authorized || !await allowed(context, scope)) {
    await deleteUnchanged(key, serialized, await readAuthScope());
    throw new DOMException('Authorization changed', 'AbortError');
  }
}
async function writeRecord(key: string, context: CommitContext, scope: AuthScope, record: RecordValue | CacheRecord): Promise<void> {
  await navigator.locks.request(storageLock, async () => {
    if (!await allowed(context, scope)) throw new DOMException('Authorization changed', 'AbortError');
    const serialized = serialize(record);
    await GM.setValue(key, serialized);
    await finishWrite(key, serialized, context, scope);
  });
}
function normalizeSettings(value?: Partial<Settings> | null): Settings {
  return { collapsed: typeof value?.collapsed === 'boolean' ? value.collapsed : false, width: typeof value?.width === 'number' && Number.isFinite(value.width) ? Math.max(200, Math.min(480, value.width)) : 280, shortcutsEnabled: value?.shortcutsEnabled !== false, language: value?.language === 'en' || value?.language === 'zh-CN' ? value.language : 'auto' };
}
export async function readSettings(): Promise<Settings> { return normalizeSettings(await GM.getValue<Partial<Settings>>(settingsKey, {})); }
export async function writeSettings(changes: Partial<Settings>): Promise<void> {
  await navigator.locks.request('opsgittrees:settings', async () => { await GM.setValue(settingsKey, { ...await readSettings(), ...changes }); });
}
export function observeSettings(listener: (settings: Settings) => void): () => void {
  let stopped = false;
  const registration = Promise.resolve(GM.addValueChangeListener<Partial<Settings>>(settingsKey, (_name, _old, value) => { if (!stopped) listener(normalizeSettings(value)); }));
  return () => { stopped = true; void registration.then(id => GM.removeValueChangeListener(id)); };
}
export async function readCommitTree(context: CommitContext, scope: AuthScope): Promise<string | null> {
  const record = await readCacheRecord(commitKey(context, scope), context, scope);
  return record?.kind === 'commit' ? record.treeSha : null;
}
export async function writeCommitTree(context: RepoContext, scope: AuthScope): Promise<void> {
  if (!Number.isSafeInteger(context.repoId) || context.repoId <= 0 || !objectSha.test(context.commitSha) || !objectSha.test(context.rootTreeSha)) throw new TypeError('Invalid commit cache identity');
  await writeRecord(commitKey(context, scope), context, scope, { schema: 2, kind: 'commit', repoId: context.repoId, scope: cacheScope(context, scope), private: context.visibility !== 'public', usedAt: Date.now(), commitSha: context.commitSha, treeSha: context.rootTreeSha });
}
export async function readTreeBlock(context: RepoContext, scope: AuthScope, sha: string, recursive: boolean): Promise<TreeCacheValue | null> {
  const record = await readCacheRecord(blockKey(context, scope, sha, recursive), context, scope);
  return record?.kind === 'response' ? { kind: 'response', response: record.response } : record?.kind === 'split' ? { kind: 'split' } : null;
}
export async function writeTreeBlock(context: RepoContext, scope: AuthScope, sha: string, recursive: boolean, response: TreeResponse): Promise<void> {
  const validated = parseTreeResponse(response, sha);
  if (!validated || !Number.isSafeInteger(context.repoId) || context.repoId <= 0 || typeof recursive !== 'boolean') throw new TypeError('Invalid tree cache response');
  await writeRecord(blockKey(context, scope, sha, recursive), context, scope, { schema: 2, kind: 'response', repoId: context.repoId, scope: cacheScope(context, scope), private: context.visibility !== 'public', usedAt: Date.now(), treeSha: sha, recursive, response: validated });
}
export async function readTree(context: RepoContext, scope: AuthScope): Promise<readonly TreeEntry[] | null> {
  const record = await readRecord(treeKey(context, scope), context, scope);
  if (!record?.entries || !Array.isArray(record.entries)) return null;
  void writeTree(context, scope, record.entries).catch(() => undefined);
  return record.entries;
}
export async function writeTree(context: RepoContext, scope: AuthScope, entries: readonly TreeEntry[]): Promise<void> { await writeRecord(treeKey(context, scope), context, scope, { schema: 1, scope: cacheScope(context, scope), private: context.visibility !== 'public', usedAt: Date.now(), entries }); }
export async function readView(context: RepoContext, scope: AuthScope): Promise<ViewState | null> { return (await readRecord(viewKey(context, scope), context, scope))?.view || null; }
export async function writeView(context: RepoContext, scope: AuthScope, view: ViewState): Promise<void> {
  if (context.visibility !== 'public' && (!scope.authenticated || !isAuthScopeCurrent(scope))) throw new DOMException('Authorization changed', 'AbortError');
  const key = viewKey(context, scope);
  const serialized = serialize({ schema: 1, scope: cacheScope(context, scope), private: context.visibility !== 'public', usedAt: Date.now(), view });
  GM_setValue(key, serialized);
  await navigator.locks.request(storageLock, () => finishWrite(key, serialized, context, scope));
}
export async function purgePrivateData(): Promise<void> { await navigator.locks.request(storageLock, trim); }

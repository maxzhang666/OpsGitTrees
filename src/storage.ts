import { GM, GM_setValue } from '$';
import { isAuthScopeCurrent, readAuthScope, withAuthLock } from './credentials';
import { msg, renderText } from './i18n';
import type { AuthScope, RepoContext, Settings, TreeEntry, ViewState } from './types';

export const defaultSettings: Settings = { collapsed: false, width: 280, shortcutsEnabled: true, language: 'auto' };
const settingsKey = 'ogt:settings:v1';
const prefix = 'ogt:data:v1:';
const encoder = new TextEncoder();
const totalLimit = 16 * 1024 * 1024;
const snapshotLimit = 4 * 1024 * 1024;
interface RecordValue { schema: 1; scope: string; private: boolean; usedAt: number; entries?: readonly TreeEntry[]; view?: ViewState }
export class StorageLimitError extends Error {
  readonly detail = msg('Snapshot exceeds the 4 MiB persistent-cache limit; the complete index remains available in memory.');
  constructor() { super(); this.message = renderText(this.detail); }
}
const cacheScope = (context: RepoContext, scope: AuthScope) => context.visibility === 'public' ? 'public' : scope.id;
const treeKey = (context: RepoContext, scope: AuthScope) => prefix + JSON.stringify(['tree', context.repoId, context.rootTreeSha, cacheScope(context, scope)]);
const viewKey = (context: RepoContext, scope: AuthScope) => prefix + JSON.stringify(['view', context.repoId, context.refKind, context.refName, cacheScope(context, scope)]);
async function allowed(context: RepoContext, scope: AuthScope): Promise<boolean> {
  if (context.visibility === 'public') return true;
  const now = await readAuthScope();
  return scope.authenticated && now.authenticated && now.id === scope.id;
}
function parse(value: unknown): RecordValue | null {
  if (typeof value !== 'string') return null;
  try { const record = JSON.parse(value) as RecordValue; return record.schema === 1 && typeof record.scope === 'string' && typeof record.private === 'boolean' && typeof record.usedAt === 'number' ? record : null; } catch { return null; }
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
    if (!key.startsWith(prefix)) continue;
    const raw = await GM.getValue<unknown>(key);
    if (!isAuthScopeCurrent(scope)) return;
    const record = parse(raw);
    if (!record || (record.private && (!scope.authenticated || record.scope !== scope.id))) {
      await withAuthLock(async () => {
        if (!isAuthScopeCurrent(scope) || await GM.getValue(key) !== raw) return;
        await GM.deleteValue(key);
      });
      continue;
    }
    records.push({ key, raw: raw as string, bytes: encoder.encode(raw as string).byteLength, usedAt: record.usedAt });
  }
  let size = records.reduce((n, r) => n + r.bytes, 0);
  records.sort((a, b) => a.usedAt - b.usedAt);
  for (const record of records) {
    if (size <= totalLimit || !isAuthScopeCurrent(scope)) break;
    await withAuthLock(async () => {
      if (!isAuthScopeCurrent(scope) || await GM.getValue(record.key) !== record.raw) return;
      await GM.deleteValue(record.key); size -= record.bytes;
    });
  }
}
function serialize(context: RepoContext, scope: AuthScope, content: Pick<RecordValue, 'entries' | 'view'>): string {
  const value = JSON.stringify({ schema: 1, scope: cacheScope(context, scope), private: context.visibility !== 'public', usedAt: Date.now(), ...content } satisfies RecordValue);
  if (encoder.encode(value).byteLength > snapshotLimit) throw new StorageLimitError();
  return value;
}
async function writeRecord(key: string, context: RepoContext, scope: AuthScope, content: Pick<RecordValue, 'entries' | 'view'>): Promise<void> {
  if (!await allowed(context, scope)) throw new DOMException('Authorization changed', 'AbortError');
  const serialized = serialize(context, scope, content);
  await GM.setValue(key, serialized);
  if (!await allowed(context, scope)) { await GM.deleteValue(key); throw new DOMException('Authorization changed', 'AbortError'); }
  await trim();
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
export async function readTree(context: RepoContext, scope: AuthScope): Promise<readonly TreeEntry[] | null> {
  const record = await readRecord(treeKey(context, scope), context, scope);
  if (!record?.entries || !Array.isArray(record.entries)) return null;
  void writeRecord(treeKey(context, scope), context, scope, { entries: record.entries }).catch(() => undefined);
  return record.entries;
}
export async function writeTree(context: RepoContext, scope: AuthScope, entries: readonly TreeEntry[]): Promise<void> { await writeRecord(treeKey(context, scope), context, scope, { entries }); }
export async function readView(context: RepoContext, scope: AuthScope): Promise<ViewState | null> { return (await readRecord(viewKey(context, scope), context, scope))?.view || null; }
export async function writeView(context: RepoContext, scope: AuthScope, view: ViewState): Promise<void> {
  if (context.visibility !== 'public' && !isAuthScopeCurrent(scope)) throw new DOMException('Authorization changed', 'AbortError');
  const key = viewKey(context, scope);
  GM_setValue(key, serialize(context, scope, { view }));
  if (!await allowed(context, scope)) { await GM.deleteValue(key); throw new DOMException('Authorization changed', 'AbortError'); }
  await trim();
}
export async function purgePrivateData(): Promise<void> { await trim(); }

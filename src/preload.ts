import { isAbortError, isAuthScopeCurrent } from './credentials';
import { ApiError } from './github';
import { msg, type Text } from './i18n';
import { readTreeBlock, StorageLimitError, writeTreeBlock } from './storage';
import { TreeIndex } from './tree-index';
import type { AuthScope, GitHubClient, IndexView, RepoContext, TreeCacheValue, TreeResponse } from './types';

interface Task { sha: string; prefix: string; recursive: boolean }
interface ResponseSlot { promise: Promise<TreeResponse>; settled: boolean }
const emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
export function startPreload(context: RepoContext, scope: AuthScope, client: GitHubClient, onChange: (view: IndexView) => void, signal: AbortSignal): { resume(): void; prioritize(paths: readonly string[]): void } {
  const index = new TreeIndex();
  const queue: Task[] = context.rootTreeSha === emptyTreeSha ? [] : [{ sha: context.rootTreeSha, prefix: '', recursive: true }];
  const missing: Task[] = [];
  const responses = new Map<string, ResponseSlot>();
  const activeKeys = new Map<string, number>();
  let visible = new Set<string>();
  let active = 0, batchRequests = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false, halted = false, terminalIncomplete = false;
  let state: IndexView['state'] = 'loading';
  let reason: Text | undefined, storageReason: Text | undefined;
  let canResume = false;
  let resumeAt: number | undefined;
  const hasPendingKey = (key: string): boolean => queue.some(task => keyOf(task) === key) || missing.some(task => keyOf(task) === key);
  const releaseResponse = (key: string): void => {
    const slot = responses.get(key);
    if (!slot?.settled) return;
    if (!(activeKeys.get(key) || 0) && !hasPendingKey(key)) responses.delete(key);
  };
  const dropSettledResponses = (): void => {
    for (const key of responses.keys()) releaseResponse(key);
  };
  const incompleteReason = msg('GitHub truncated a non-recursive directory listing. Results remain incomplete; this API cannot enumerate all entries.');
  const emit = () => { if (!signal.aborted) onChange({ ...index.view(state, halted ? 0 : queue.length + missing.length + active, reason || (terminalIncomplete ? incompleteReason : storageReason)), canResume, resumeAt }); };
  const keyOf = (task: Task) => task.sha + ':' + task.recursive;
  const priority = (task: Task) => !task.prefix || context.path === task.prefix || context.path.startsWith(task.prefix + '/') ? 0 : visible.has(task.prefix) ? 1 : 2;
  function halt(message: Text): void {
    halted = true; clearTimeout(timer); queue.length = 0; missing.length = 0; responses.clear();
    if (context.visibility !== 'public') { index.entries.clear(); index.children.clear(); }
    state = 'failed'; reason = message; canResume = false; resumeAt = undefined; emit();
  }
  function current(): boolean {
    if (signal.aborted || halted) return false;
    if (context.visibility !== 'public' && !isAuthScopeCurrent(scope)) {
      halt(msg('Authorization changed; private index cleared.')); return false;
    }
    return true;
  }
  function storageFailure(error: unknown): void {
    if (isAbortError(error)) halt(msg('Authorization changed; private index cleared.'));
    else storageReason = error instanceof StorageLimitError ? error.detail : msg('Persistent cache unavailable; index remains usable in memory.');
  }
  async function readCached(task: Task): Promise<TreeCacheValue | null> {
    try { return await readTreeBlock(context, scope, task.sha, task.recursive); }
    catch (error) { if (current()) storageFailure(error); return null; }
  }
  function pause(message: Text, nextState: 'paused' | 'failed', retry: boolean, at?: number): void {
    stopped = true;
    dropSettledResponses();
    const barrier = Math.max(resumeAt || 0, at || 0, client.quota.blockedUntil || 0) || undefined;
    if (retry && resumeAt && resumeAt > Date.now() && (!at || at < resumeAt)) { resumeAt = barrier; emit(); return; }
    state = nextState; reason = message; canResume = retry; resumeAt = barrier; emit();
  }
  function schedule(): void {
    if (!current()) return;
    const quota = client.quota;
    if (quota.resumeAt && Date.now() >= quota.resumeAt) { quota.remaining = null; quota.resumeAt = null; }
    queue.sort((a, b) => priority(a) - priority(b));
    missing.sort((a, b) => priority(a) - priority(b));
    while (active < 2) {
      let task = queue.shift();
      const network = !task;
      if (!task) {
        const shared = missing.findIndex(candidate => responses.has(keyOf(candidate)));
        if (shared >= 0) task = missing.splice(shared, 1)[0];
        else {
          if (!missing.length || stopped) break;
          if (quota.blockedUntil && quota.blockedUntil > Date.now()) { pause(msg('GitHub rate limit remains active.'), 'paused', true, quota.blockedUntil); break; }
          if (quota.remaining !== null && quota.remaining <= 5) {
            pause(msg('GitHub request quota is low. Loaded paths remain usable; continue after the quota resets.'), 'paused', true, quota.resumeAt || undefined); break;
          }
          if (batchRequests >= 40) break;
          task = missing.shift();
        }
      }
      if (!task || !current()) break;
      active++; void run(task, network);
    }
    if (!queue.length && !missing.length && !active) {
      state = terminalIncomplete ? 'partial' : 'complete'; canResume = false; resumeAt = undefined;
      responses.clear(); emit();
    } else if (!active && missing.length && !stopped && batchRequests >= 40 && !timer) {
      timer = setTimeout(() => { timer = undefined; batchRequests = 0; schedule(); }, 0);
    }
  }
  async function run(task: Task, network: boolean): Promise<void> {
    const runKey = keyOf(task);
    activeKeys.set(runKey, (activeKeys.get(runKey) || 0) + 1);
    let publish = false;
    try {
      let data: TreeResponse | undefined;
      if (!network) {
        const cached = await readCached(task);
        if (!current()) return;
        if (cached?.kind === 'response') data = cached.response;
        else if (task.recursive) {
          const enumeration = { ...task, recursive: false };
          const direct = await readCached(enumeration);
          if (!current()) return;
          if (direct?.kind === 'response') { task = enumeration; data = direct.response; }
          else if (cached?.kind === 'split') task = enumeration;
        }
        if (!data) { missing.push(task); return; }
      } else {
        const key = keyOf(task);
        let slot = responses.get(key);
        if (!slot) {
          batchRequests++; publish = true;
          const created: ResponseSlot = { promise: client.getTree(context, task.sha, task.recursive, signal), settled: false };
          responses.set(key, created); slot = created;
          created.promise.then(() => {
            created.settled = true;
            if (responses.get(key) === created) releaseResponse(key);
          }, () => {
            created.settled = true;
            if (responses.get(key) === created) responses.delete(key);
          });
        }
        data = await slot.promise;
        if (!current()) return;
      }
      index.add(data.tree, task.prefix);
      if (task.recursive && data.truncated) queue.push({ ...task, recursive: false });
      else if (!task.recursive) {
        if (data.truncated) terminalIncomplete = true;
        for (const entry of data.tree) if (entry.type === 'tree') queue.push({ sha: entry.sha, prefix: task.prefix ? task.prefix + '/' + entry.path : entry.path, recursive: true });
      }
      if (!stopped) state = 'partial';
      emit(); schedule();
      if (publish && current()) {
        try { await writeTreeBlock(context, scope, task.sha, task.recursive, data); }
        catch (error) { if (current()) storageFailure(error); }
      }
    } catch (error) {
      if (!current()) return;
      if (isAbortError(error)) { halt(msg('Authorization changed; private index cleared.')); return; }
      responses.delete(keyOf(task));
      const failure = error instanceof ApiError ? error : new ApiError('network', msg('Directory request failed.'));
      const retry = failure.kind === 'rate' || failure.kind === 'network';
      if (context.visibility !== 'public' && !retry) { halt(failure.detail); return; }
      missing.unshift(task);
      pause(failure.detail, failure.kind === 'rate' ? 'paused' : 'failed', retry, failure.resumeAt || undefined);
    } finally {
      active--;
      const remaining = (activeKeys.get(runKey) || 1) - 1;
      if (remaining > 0) activeKeys.set(runKey, remaining); else activeKeys.delete(runKey);
      releaseResponse(runKey);
      if (current()) { emit(); schedule(); }
    }
  }
  signal.addEventListener('abort', () => { clearTimeout(timer); queue.length = 0; missing.length = 0; responses.clear(); }, { once: true });
  queueMicrotask(() => { if (current()) { emit(); schedule(); } });
  return {
    resume() {
      if (!current() || !stopped || !canResume || (resumeAt && Date.now() < resumeAt)) return;
      if (client.quota.blockedUntil && client.quota.blockedUntil > Date.now()) return;
      if (client.quota.remaining !== null && client.quota.remaining <= 5 && (!client.quota.resumeAt || Date.now() < client.quota.resumeAt)) return;
      stopped = false; state = 'partial'; reason = undefined; canResume = false; resumeAt = undefined; batchRequests = 0;
      queue.push(...missing.splice(0)); schedule();
    },
    prioritize(paths) { visible = new Set(paths); },
  };
}
